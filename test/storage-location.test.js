import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareReportStorage, resolveReportRoot } from '../lib/storage-location.js';

const development = fileURLToPath(new URL('../.dev/', import.meta.url));
const FIRST = '73309f32-991b-482e-a43b-165165e2a47e.json';
const SECOND = '9343d42c-7ada-4ef1-83b6-080099218eae.json';
const THIRD = '4bbef674-c102-43fd-9f54-0d2a62a2cffb.json';

async function fixture(t) {
  await mkdir(development, { recursive: true });
  const base = await mkdtemp(join(development, 'storage-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const env = { DSH_HOME: join(base, 'dsh-home') };
  return { base, env, root: resolveReportRoot(env), legacyRoot: join(base, 'old-package', 'data', 'reports') };
}

async function legacyFiles(root, entries) {
  await mkdir(root, { recursive: true });
  for (const [name, contents] of Object.entries(entries)) await writeFile(join(root, name), contents);
}

test('uses the stable DSH home and preserves an explicit report path verbatim', async t => {
  const { base, env, root } = await fixture(t);
  assert.equal(root, join(env.DSH_HOME, 'storages', 'dsh-journal', 'reports'));
  assert.equal(resolveReportRoot({ ...env, ISDOU_DSH_JOURNAL_DATA_DIR: '' }), root);
  const custom = join(base, ' report folder ');
  assert.equal(resolveReportRoot({ ...env, ISDOU_DSH_JOURNAL_DATA_DIR: custom }), resolve(custom));
  assert.equal(resolveReportRoot({ ...env, ISDOU_DSH_JOURNAL_DATA_DIR: '.dev/relative reports' }), resolve('.dev/relative reports'));
});

test('a missing legacy directory initializes an empty private stable store', async t => {
  const { env, root, legacyRoot } = await fixture(t);
  assert.deepEqual(await prepareReportStorage({ legacyRoot, env }), { root, copiedReports: 0, copiedPreferences: false });
  assert.deepEqual(await readdir(root), []);
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  await assert.rejects(lstat(legacyRoot), { code: 'ENOENT' });
});

test('copies only allowed regular files privately and leaves the originals unchanged', async t => {
  const { base, env, root, legacyRoot } = await fixture(t);
  const original = '{"markdown":"synthetic report content"}\n';
  const preferences = '{"reportModel":{"provider":"test","model":"fixture"}}\n';
  await legacyFiles(legacyRoot, { [FIRST]: original, 'preferences.json': preferences, 'unknown.json': 'skip', 'report.md': 'skip' });
  await legacyFiles(join(legacyRoot, 'benchmarks'), { [SECOND]: 'skip benchmark report' });
  await mkdir(join(legacyRoot, SECOND));
  const outside = join(base, 'synthetic-outside.json');
  await writeFile(outside, 'do not migrate symlink target');
  await symlink(outside, join(legacyRoot, THIRD));
  await writeFile(join(legacyRoot, '73309f32-991b-982e-a43b-165165e2a47e.json'), 'skip invalid UUID');
  const result = await prepareReportStorage({ legacyRoot, env });
  assert.deepEqual(result, { root, copiedReports: 1, copiedPreferences: true });
  assert.deepEqual((await readdir(root)).sort(), [FIRST, 'preferences.json'].sort());
  for (const [name, value] of [[FIRST, original], ['preferences.json', preferences]]) {
    assert.equal(await readFile(join(root, name), 'utf8'), value);
    assert.equal(await readFile(join(legacyRoot, name), 'utf8'), value);
    assert.equal((await stat(join(root, name))).mode & 0o777, 0o600);
  }
  assert.ok((await lstat(join(legacyRoot, THIRD))).isSymbolicLink());
  assert.deepEqual(await prepareReportStorage({ legacyRoot, env }), { root, copiedReports: 0, copiedPreferences: false });
});

test('existing destination reports and preferences always win over legacy copies', async t => {
  const { env, root, legacyRoot } = await fixture(t);
  await legacyFiles(legacyRoot, { [FIRST]: 'legacy first', [SECOND]: 'legacy second', 'preferences.json': 'legacy preferences' });
  await legacyFiles(root, { [FIRST]: 'current first', 'preferences.json': 'current preferences' });
  assert.deepEqual(await prepareReportStorage({ legacyRoot, env }), { root, copiedReports: 1, copiedPreferences: false });
  assert.equal(await readFile(join(root, FIRST), 'utf8'), 'current first');
  assert.equal(await readFile(join(root, SECOND), 'utf8'), 'legacy second');
  assert.equal(await readFile(join(root, 'preferences.json'), 'utf8'), 'current preferences');
  assert.equal(await readFile(join(legacyRoot, FIRST), 'utf8'), 'legacy first');
});

test('explicit overrides initialize isolated storage without copying legacy data', async t => {
  const { base, env, root: defaultRoot, legacyRoot } = await fixture(t);
  await legacyFiles(legacyRoot, { [FIRST]: 'legacy report', 'preferences.json': 'legacy preferences' });
  const override = join(base, 'isolated reports');
  const result = await prepareReportStorage({ legacyRoot, env: { ...env, ISDOU_DSH_JOURNAL_DATA_DIR: override } });
  assert.deepEqual(result, { root: override, copiedReports: 0, copiedPreferences: false });
  assert.deepEqual(await readdir(override), []);
  await assert.rejects(lstat(defaultRoot), { code: 'ENOENT' });
  assert.equal(await readFile(join(legacyRoot, FIRST), 'utf8'), 'legacy report');
});

test('does not copy from the destination itself or a symlink alias', async t => {
  const { base, env, root } = await fixture(t);
  await legacyFiles(root, { [FIRST]: 'already stable', 'preferences.json': 'stable preferences' });
  assert.deepEqual(await prepareReportStorage({ legacyRoot: root, env }), { root, copiedReports: 0, copiedPreferences: false });
  const alias = join(base, 'source-alias');
  await symlink(root, alias);
  assert.deepEqual(await prepareReportStorage({ legacyRoot: alias, env }), { root, copiedReports: 0, copiedPreferences: false });
  assert.deepEqual((await readdir(root)).sort(), [FIRST, 'preferences.json'].sort());
  assert.equal(await readFile(join(root, FIRST), 'utf8'), 'already stable');
});

test('skips symlinked legacy roots and preferences', async t => {
  const { base, env, root, legacyRoot } = await fixture(t);
  const external = join(base, 'external-legacy');
  await legacyFiles(external, { [FIRST]: 'do not follow directory alias', 'preferences.json': 'do not follow preference alias' });
  await mkdir(legacyRoot, { recursive: true });
  await symlink(join(external, 'preferences.json'), join(legacyRoot, 'preferences.json'));
  assert.deepEqual(await prepareReportStorage({ legacyRoot, env }), { root, copiedReports: 0, copiedPreferences: false });
  const alias = join(base, 'external-alias');
  await symlink(external, alias);
  assert.deepEqual(await prepareReportStorage({ legacyRoot: alias, env }), { root, copiedReports: 0, copiedPreferences: false });
  assert.deepEqual(await readdir(root), []);
});

test('concurrent migrations publish complete files once without overwriting or temporary leftovers', async t => {
  const { env, root, legacyRoot } = await fixture(t);
  const contents = 'synthetic content\n'.repeat(1000);
  await legacyFiles(legacyRoot, { [FIRST]: contents, 'preferences.json': '{"reportModel":null}\n' });
  const results = await Promise.all([prepareReportStorage({ legacyRoot, env }), prepareReportStorage({ legacyRoot, env })]);
  assert.equal(results.reduce((total, value) => total + value.copiedReports, 0), 1);
  assert.equal(results.filter(value => value.copiedPreferences).length, 1);
  assert.equal(await readFile(join(root, FIRST), 'utf8'), contents);
  assert.deepEqual((await readdir(root)).sort(), [FIRST, 'preferences.json'].sort());
  assert.equal((await stat(join(root, FIRST))).mode & 0o777, 0o600);
});

test('different installed package versions resolve to one stable report history', async t => {
  const { base, env, root, legacyRoot } = await fixture(t);
  const upgradedLegacy = join(base, 'upgraded-package', 'data', 'reports');
  await legacyFiles(legacyRoot, { [FIRST]: 'saved from first version', 'preferences.json': 'first preference' });
  await legacyFiles(upgradedLegacy, { [FIRST]: 'stale conflicting copy', [SECOND]: 'second report', 'preferences.json': 'stale preference' });
  const first = await prepareReportStorage({ legacyRoot, env });
  const upgraded = await prepareReportStorage({ legacyRoot: upgradedLegacy, env });
  assert.equal(first.root, root);
  assert.equal(upgraded.root, root);
  assert.equal(upgraded.copiedReports, 1);
  assert.equal(upgraded.copiedPreferences, false);
  assert.equal(await readFile(join(root, FIRST), 'utf8'), 'saved from first version');
  assert.equal(await readFile(join(root, SECOND), 'utf8'), 'second report');
  assert.equal(await readFile(join(root, 'preferences.json'), 'utf8'), 'first preference');
});
