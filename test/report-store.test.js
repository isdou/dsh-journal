import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReportStore } from '../lib/report-store.js';

const development = fileURLToPath(new URL('../.dev/', import.meta.url));

async function fixture(t) {
  await mkdir(development, { recursive: true });
  const root = await mkdtemp(join(development, 'store-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, store: new ReportStore(root) };
}

test('saves a private report and returns metadata without source records or body', async t => {
  const { root, store } = await fixture(t);
  const source = { title: '示例周报', markdown: '# 工作进展', range: { start: '2026-11-09', end: '2026-11-14' },
    stats: { sessions: 3 }, mode: 'local', sources: [{ id: 'session-demo', text: 'source evidence' }], customField: { a: 1 } };
  const saved = await store.save(source);
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
  assert.deepEqual(await store.get(saved.id), saved);
  assert.deepEqual(saved.sources, source.sources);
  assert.deepEqual(saved.customField, source.customField);
  const [listed] = await store.list();
  assert.equal(listed.id, saved.id);
  assert.equal(listed.title, source.title);
  assert.equal(listed.markdown, undefined);
  assert.equal(listed.sources, undefined);
  assert.equal(listed.customField, undefined);
  assert.equal((await stat(join(root, `${saved.id}.json`))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(root), [`${saved.id}.json`]);
});

test('editing only changes Markdown and the update timestamp', async t => {
  const { store } = await fixture(t);
  const saved = await store.save({ title: 'Original', markdown: 'before', range: { startMs: 1, endMs: 2 }, sources: [{ id: 'original' }] });
  const updated = await store.update(saved.id, { markdown: 'after', id: 'override', title: 'overwrite',
    createdAt: 'bad', range: null, sources: [] });
  assert.equal(updated.markdown, 'after');
  assert.equal(updated.id, saved.id);
  assert.equal(updated.title, saved.title);
  assert.equal(updated.createdAt, saved.createdAt);
  assert.deepEqual(updated.range, saved.range);
  assert.deepEqual(updated.sources, saved.sources);
  assert.deepEqual(await store.get(saved.id), updated);
});

test('rejects traversal and invalid reports; missing files return 404', async t => {
  const { store } = await fixture(t);
  for (const id of ['../outside', '', null, 'a'.repeat(36), '/etc/passwd']) {
    await assert.rejects(store.get(id), { status: 400, code: 'INVALID_REPORT_ID' });
  }
  await assert.rejects(store.get('73309f32-991b-482e-a43b-165165e2a47e'), { status: 404 });
  await assert.rejects(store.save({ markdown: 5 }), { status: 400 });
  const circular = { markdown: 'ok' }; circular.self = circular;
  await assert.rejects(store.save(circular), { status: 400 });
});

test('missing storage reads as empty without creating it', async t => {
  const { root } = await fixture(t);
  const store = new ReportStore(join(root, 'not-created'));
  assert.deepEqual(await store.list(), []);
  assert.deepEqual(await readdir(root), []);
});

test('corrupt reports are reported explicitly while temporary files are ignored', async t => {
  const { root, store } = await fixture(t);
  await writeFile(join(root, '.temporary.tmp'), 'partial');
  await writeFile(join(root, 'other.json'), '{}');
  assert.deepEqual(await store.list(), []);
  const id = '73309f32-991b-482e-a43b-165165e2a47e';
  await writeFile(join(root, `${id}.json`), '{');
  await assert.rejects(store.get(id), { status: 500, code: 'CORRUPT_REPORT' });
  await assert.rejects(store.list(), { status: 500, code: 'CORRUPT_REPORT' });
});
