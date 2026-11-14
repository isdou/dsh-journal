import { fileURLToPath } from 'node:url';
import { collectActivity } from './lib/collector.js';
import { normalizeRange } from './lib/range.js';
import { createReport, modelState } from './lib/report.js';
import { ReportStore } from './lib/report-store.js';
import { loadReportModel } from './lib/preferences.js';
import { prepareReportStorage, resolveReportRoot } from './lib/storage-location.js';

export const inject = ['connection', 'sessionQuery'];

const LEGACY_DATA = fileURLToPath(new URL('./data/reports/', import.meta.url));

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
}

async function input(request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error('请求内容须为 JSON 对象。'), { status: 400, code: 'INVALID_JSON' });
  }
}

export function registerJournal(ctx, { store = new ReportStore(resolveReportRoot()), reportModel } = {}) {
  const lifecycle = new AbortController();
  let generating = false;
  ctx.effect(() => () => lifecycle.abort());
  function route(path, methods, handler) {
    ctx.connection.fetch.register({
      path: `/api/dsh-journal/${path}`, methods,
      requestBody: 'buffered',
      fetch: async request => {
        try {
          const signal = AbortSignal.any([request.signal, lifecycle.signal]);
          signal.throwIfAborted();
          return json(await handler(request, signal));
        } catch (error) {
          if (request.signal.aborted || lifecycle.signal.aborted || error.name === 'AbortError') {
            return json({ error: '操作已取消。', code: 'ABORTED' }, 499);
          }
          return json({ error: error.message || '日记操作失败，请重试。', code: error.code || 'JOURNAL_ERROR' }, error.status || 500);
        }
      },
    });
  }
  route('state', ['GET'], async () => ({ reports: await store.list(), model: modelState(ctx, reportModel) }));
  route('preview', ['POST'], async (request, signal) => {
    const range = normalizeRange(await input(request));
    const { evidence: _evidence, ...preview } = await collectActivity(ctx, range, { signal });
    return preview;
  });
  route('generate', ['POST'], async (request, signal) => {
    const args = await input(request);
    const range = normalizeRange(args);
    if (args.mode !== 'local' && args.mode !== 'ai') {
      throw Object.assign(new Error('请选择 AI 总结或本地整理。'), { status: 400, code: 'INVALID_MODE' });
    }
    if (generating) throw Object.assign(new Error('已有一份报告正在生成，请稍后重试。'), { status: 409, code: 'GENERATING' });
    generating = true;
    try {
      const activity = await collectActivity(ctx, range, { signal });
      const report = await createReport(ctx, activity, args.mode, { signal, reportModel });
      signal.throwIfAborted();
      return await store.save(report);
    } finally {
      generating = false;
    }
  });
  route('report', ['GET', 'PUT'], async request => {
    if (request.method === 'GET') return store.get(new URL(request.url).searchParams.get('id'));
    const args = await input(request);
    return store.update(args.id, { markdown: args.markdown });
  });
}

export async function apply(ctx) {
  const { root } = await prepareReportStorage({ legacyRoot: LEGACY_DATA });
  const store = new ReportStore(root);
  const reportModel = await loadReportModel(store.root);
  registerJournal(ctx, { store, reportModel });
}
