import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerJournal } from '../index.js';
import { ReportStore } from '../lib/report-store.js';

const development = fileURLToPath(new URL('../.dev/', import.meta.url));
const selection = { start: '2026-11-14', end: '2026-11-14', timeZone: 'Asia/Singapore', preset: 'day' };
const inside = Date.parse('2026-11-14T03:00:00Z');
const PRIVATE_TEXT = 'SYNTHETIC-PRIVATE-EVIDENCE-ONLY-IN-REPORT';

function user(time = inside) {
  return { type: 'user/message', time, seq: 1, data: { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: PRIVATE_TEXT }] } };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t, { events = [user()], model, reportModel } = {}) {
  await mkdir(development, { recursive: true });
  const root = await mkdtemp(join(development, 'api-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const routes = new Map();
  const cleanups = [];
  const store = new ReportStore(root);
  let reads = 0;
  const ctx = {
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path); } } },
    effect(effect) { const dispose = effect(); if (typeof dispose === 'function') cleanups.push(dispose); return dispose; },
    sessionQuery: {
      async listSessions() { return [{ header: { id: 'session-one', createdAt: 1, cwd: '/example' } }]; },
      async readSession() { reads++; return { session: { id: 'session-one', cwd: '/example' }, inheritedEventCount: 0, events }; },
    },
  };
  if (model) {
    ctx.agentDefaultModel = { currentSelection: () => ({ provider: 'test', model: 'fixture' }) };
    ctx.llm = { listProviders: () => [{ id: 'test' }], async *stream(options) {
      const result = await model(options);
      if (result.throw) throw result.throw;
      if (result.text !== undefined) yield { type: 'text-delta', text: result.text };
      if (result.reason) yield { type: 'finish', reason: result.reason };
    } };
  }
  registerJournal(ctx, { store, reportModel });
  const dispose = () => cleanups.forEach(cleanup => cleanup());
  t.after(dispose);
  async function request(path, { method = 'GET', body, raw, signal } = {}) {
    const routePath = `/api/dsh-journal/${path.split('?')[0]}`;
    const route = routes.get(routePath);
    assert.ok(route, `registered route ${routePath}`);
    const request = new Request(`http://127.0.0.1/api/dsh-journal/${path}`, {
      method, signal,
      ...(body === undefined && raw === undefined ? {} : {
        body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json' },
      }),
    });
    const response = await route.fetch(request);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, body: await response.json() };
  }
  return { ctx, store, routes, request, dispose, get reads() { return reads; } };
}

test('registers every native route with buffered bodies, including GET routes', async t => {
  const api = await fixture(t);
  assert.ok(api.routes.size > 0);
  for (const route of api.routes.values()) {
    assert.equal(route.requestBody, 'buffered', `${route.path} must avoid the rc.3 streaming GET-body carrier`);
  }
});

test('validates JSON, calendar range and mode before reading session data', async t => {
  const api = await fixture(t);
  const cases = [
    { raw: '{', code: 'INVALID_JSON' },
    { raw: '[]', code: 'INVALID_JSON' },
    { body: { ...selection, start: '2026-02-29', mode: 'local' }, code: 'INVALID_RANGE' },
    { body: { ...selection, mode: 'publish' }, code: 'INVALID_MODE' },
  ];
  for (const { body, raw, code } of cases) {
    const result = await api.request('generate', { method: 'POST', body, raw });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, code);
  }
  assert.equal(api.reads, 0);
  assert.deepEqual(await api.store.list(), []);
});

test('preview exposes range, counts and source metadata without conversation bodies', async t => {
  const api = await fixture(t);
  const result = await api.request('preview', { method: 'POST', body: selection });
  assert.equal(result.status, 200);
  assert.equal(result.body.stats.sessionCount, 1);
  assert.equal(result.body.stats.messageCount, 1);
  assert.equal(result.body.sessions[0].id, 'session-one');
  assert.equal(result.body.evidence, undefined);
  assert.ok(!JSON.stringify(result.body).includes(PRIVATE_TEXT));
  assert.deepEqual(await api.store.list(), []);
});

test('local generation, metadata listing, retrieval and editing work without an LLM', async t => {
  const api = await fixture(t);
  const generated = await api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } });
  assert.equal(generated.status, 200);
  assert.match(generated.body.markdown, new RegExp(PRIVATE_TEXT));
  const report = generated.body;
  const state = await api.request('state');
  assert.equal(state.status, 200);
  assert.equal(state.body.model.available, false);
  assert.equal(state.body.reports.length, 1);
  assert.equal(state.body.reports[0].id, report.id);
  assert.equal(state.body.reports[0].markdown, undefined);
  assert.equal(state.body.reports[0].sources, undefined);
  assert.ok(!JSON.stringify(state.body).includes(PRIVATE_TEXT));
  const loaded = await api.request(`report?id=${report.id}`);
  assert.deepEqual(loaded.body, report);
  const edited = await api.request('report', { method: 'PUT', body: { id: report.id, markdown: '# 手动修订', sources: [], range: null } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.markdown, '# 手动修订');
  assert.deepEqual(edited.body.sources, report.sources);
  assert.deepEqual(edited.body.range, report.range);
  assert.equal(edited.body.createdAt, report.createdAt);
  assert.equal((await api.store.get(report.id)).markdown, '# 手动修订');
});

test('empty periods and missing models produce useful errors without saving reports', async t => {
  const empty = await fixture(t, { events: [user(inside - 86400000)] });
  const result = await empty.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } });
  assert.equal(result.status, 422);
  assert.equal(result.body.code, 'NO_ACTIVITY');
  assert.deepEqual(await empty.store.list(), []);
  const noModel = await fixture(t);
  const aiResult = await noModel.request('generate', { method: 'POST', body: { ...selection, mode: 'ai' } });
  assert.equal(aiResult.status, 422);
  assert.equal(aiResult.body.code, 'MODEL_UNAVAILABLE');
  assert.deepEqual(await noModel.store.list(), []);
});

test('model truncation, provider errors and invalid references never save a report', async t => {
  const cases = [
    { text: '未完成。[S1]', reason: { kind: 'max-tokens' }, code: 'MODEL_OUTPUT_TRUNCATED', status: 422 },
    { text: '未完成。[S1]', reason: { kind: 'error', failure: { message: 'fixture failure' } }, code: 'MODEL_FAILED', status: 502 },
    { text: '未完成。[S1]', reason: undefined, code: 'MODEL_INCOMPLETE', status: 502 },
    { text: '没有来源。', reason: { kind: 'stop' }, code: 'MISSING_SOURCE', status: 502 },
    { text: '虚构来源。[S999]', reason: { kind: 'stop' }, code: 'INVALID_SOURCE', status: 502 },
  ];
  for (const output of cases) {
    const api = await fixture(t, { model: () => output });
    const result = await api.request('generate', { method: 'POST', body: { ...selection, mode: 'ai' } });
    assert.equal(result.status, output.status);
    assert.equal(result.body.code, output.code);
    assert.deepEqual(await api.store.list(), []);
    // The generation lock must also be released on model failure.
    const retry = await api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } });
    assert.equal(retry.status, 200);
  }
});

test('validates report IDs and Markdown edits without changing stored reports', async t => {
  const api = await fixture(t);
  assert.equal((await api.request('report?id=../outside')).status, 400);
  assert.equal((await api.request('report?id=73309f32-991b-482e-a43b-165165e2a47e')).status, 404);
  const report = (await api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } })).body;
  const edited = await api.request('report', { method: 'PUT', body: { id: report.id, markdown: 1 } });
  assert.equal(edited.status, 400);
  assert.deepEqual(await api.store.get(report.id), report);
});

test('rejects simultaneous generation with 409 and releases the lock after success', async t => {
  const api = await fixture(t);
  const started = deferred();
  const release = deferred();
  const original = api.ctx.sessionQuery.readSession;
  api.ctx.sessionQuery.readSession = async (...args) => {
    started.resolve();
    await release.promise;
    return original(...args);
  };
  const first = api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } });
  await started.promise;
  const second = await api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'GENERATING');
  release.resolve();
  assert.equal((await first).status, 200);
  assert.equal((await api.store.list()).length, 1);
  assert.equal((await api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } })).status, 200);
  assert.equal((await api.store.list()).length, 2);
});

test('request cancellation during collection prevents saving and releases the lock', async t => {
  const api = await fixture(t);
  const started = deferred();
  const release = deferred();
  const original = api.ctx.sessionQuery.readSession;
  api.ctx.sessionQuery.readSession = async (...args) => {
    started.resolve();
    await release.promise;
    return original(...args);
  };
  const controller = new AbortController();
  const pending = api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' }, signal: controller.signal });
  await started.promise;
  controller.abort();
  release.resolve();
  const result = await pending;
  assert.equal(result.status, 499);
  assert.equal(result.body.code, 'ABORTED');
  assert.deepEqual(await api.store.list(), []);
  const retry = await api.request('generate', { method: 'POST', body: { ...selection, mode: 'local' } });
  assert.equal(retry.status, 200);
});

test('plugin disposal aborts generation during model streaming before saving', async t => {
  const started = deferred();
  const release = deferred();
  const api = await fixture(t, { model: async () => {
    started.resolve();
    await release.promise;
    return { text: '已生成但不应保存。[S1]', reason: { kind: 'stop' } };
  } });
  const pending = api.request('generate', { method: 'POST', body: { ...selection, mode: 'ai' } });
  await started.promise;
  api.dispose();
  release.resolve();
  const result = await pending;
  assert.equal(result.status, 499);
  assert.equal(result.body.code, 'ABORTED');
  assert.deepEqual(await api.store.list(), []);
});

test('the displayed report model is the route actually used while the host default stays unchanged', async t => {
  const calls = [];
  const api = await fixture(t, {
    reportModel: { provider: 'test', model: 'report-fast' },
    model: options => { calls.push(options); return { text: '已完成整理。[S1]', reason: { kind: 'stop' } }; },
  });
  api.ctx.llm.resolveModelInfo = async (provider, model) => ({ provider, id: model,
    context: { contextWindow: 200000 }, reasoning: { efforts: [{ id: 'off' }, { id: 'high' }] } });
  const state = await api.request('state');
  assert.deepEqual(state.body.model, { available: true, provider: 'test', model: 'report-fast' });
  const result = await api.request('generate', { method: 'POST', body: { ...selection, mode: 'ai' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.modelId, 'test/report-fast');
  assert.equal(calls[0].model, 'report-fast');
  assert.equal(calls[0].reasoningEffort, 'off');
  assert.equal(api.ctx.agentDefaultModel.currentSelection().model, 'fixture');
});
