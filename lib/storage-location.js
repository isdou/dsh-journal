import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';

const REPORT_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i;

function overridden(env) {
  return typeof env.ISDOU_DSH_JOURNAL_DATA_DIR === 'string' && env.ISDOU_DSH_JOURNAL_DATA_DIR.length > 0;
}

export function resolveReportRoot(env = process.env) {
  return overridden(env)
    ? resolve(env.ISDOU_DSH_JOURNAL_DATA_DIR)
    : join(resolveDshHome(undefined, env), 'storages', 'dsh-journal', 'reports');
}

/** Publish a complete private copy only if the destination does not exist. */
async function copyIfAbsent(source, destination, root) {
  try { await lstat(destination); return false; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let input;
  try {
    input = await open(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ELOOP') return false;
    throw error;
  }
  let contents;
  try {
    if (!(await input.stat()).isFile()) return false;
    contents = await input.readFile();
  } finally {
    await input.close();
  }

  const temporary = join(root, `.migration-${randomUUID()}.tmp`);
  const output = await open(temporary, 'wx', 0o600);
  try {
    await output.writeFile(contents);
    await output.close();
    // Both paths are on the destination filesystem. link() creates the final
    // name atomically and, unlike rename(), cannot replace an existing report.
    await link(temporary, destination);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally {
    await output.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

/** Retain legacy originals; a configured data-directory override never migrates. */
export async function prepareReportStorage({ legacyRoot, env = process.env } = {}) {
  const root = resolveReportRoot(env);
  const result = { root, copiedReports: 0, copiedPreferences: false };
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (overridden(env) || !legacyRoot || resolve(legacyRoot) === root) return result;

  let legacy;
  try { legacy = await lstat(legacyRoot); }
  catch (error) { if (error.code === 'ENOENT') return result; throw error; }
  if (!legacy.isDirectory() || legacy.isSymbolicLink()) return result;
  if (await realpath(legacyRoot) === await realpath(root)) return result;

  for (const entry of await readdir(legacyRoot, { withFileTypes: true })) {
    if (!entry.isFile() || (entry.name !== 'preferences.json' && !REPORT_FILE.test(entry.name))) continue;
    const copied = await copyIfAbsent(join(legacyRoot, entry.name), join(root, entry.name), root);
    if (entry.name === 'preferences.json') result.copiedPreferences = copied;
    else if (copied) result.copiedReports++;
  }
  return result;
}
