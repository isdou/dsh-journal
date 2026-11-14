import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadReportModel } from '../lib/preferences.js';
import { ReportStore } from '../lib/report-store.js';

async function rootFor(t) {
  const development = fileURLToPath(new URL('../.dev/', import.meta.url));
  await mkdir(development, { recursive: true });
  const root = await mkdtemp(join(development, 'preferences-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('missing model preference follows the host without writing files', async t => {
  const root = await rootFor(t);
  assert.equal(await loadReportModel(root), undefined);
  assert.deepEqual(await readdir(root), []);
});

test('a private preference contains only model identifiers and is excluded from report history', async t => {
  const root = await rootFor(t);
  await writeFile(join(root, 'preferences.json'), JSON.stringify({ reportModel: { provider: 'fixture', model: 'fast' } }), { mode: 0o600 });
  const selected = await loadReportModel(root);
  assert.deepEqual(selected, { provider: 'fixture', model: 'fast' });
  assert.equal(Object.isFrozen(selected), true);
  assert.deepEqual(await new ReportStore(root).list(), []);
});

test('empty or reset preferences return to host selection', async t => {
  const root = await rootFor(t);
  for (const value of [{}, { reportModel: null }]) {
    await writeFile(join(root, 'preferences.json'), JSON.stringify(value));
    assert.equal(await loadReportModel(root), undefined);
  }
});

test('malformed preferences fail clearly without echoing their contents', async t => {
  const root = await rootFor(t);
  for (const value of ['{BROKEN-CONTENT', '[]', 'null', JSON.stringify({ reportModel: { provider: '', model: 'fast' } }),
    JSON.stringify({ reportModel: { provider: 'fixture', model: 'fast', apiKey: 'SYNTHETIC-PRIVATE-MARKER' } })]) {
    await writeFile(join(root, 'preferences.json'), value);
    await assert.rejects(loadReportModel(root), error => error.code === 'INVALID_PREFERENCES'
      && !error.message.includes('SYNTHETIC-PRIVATE-MARKER') && !error.message.includes('BROKEN-CONTENT'));
  }
});
