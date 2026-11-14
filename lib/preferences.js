import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function invalid() {
  return Object.assign(new Error('简报模型偏好无效，请检查 preferences.json 中的 provider 和 model。'), {
    status: 400, code: 'INVALID_PREFERENCES',
  });
}

/** This file stores model identifiers only; credentials remain owned by DSH. */
export async function loadReportModel(reportRoot) {
  let text;
  try { text = await readFile(join(reportRoot, 'preferences.json'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  let preferences;
  try { preferences = JSON.parse(text); }
  catch { throw invalid(); }
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw invalid();
  const model = preferences.reportModel;
  if (model === undefined || model === null) return undefined;
  if (typeof model !== 'object' || Array.isArray(model)
    || Object.keys(model).some(key => key !== 'provider' && key !== 'model')
    || typeof model.provider !== 'string' || !model.provider.trim()
    || typeof model.model !== 'string' || !model.model.trim()) throw invalid();
  return Object.freeze({ provider: model.provider.trim(), model: model.model.trim() });
}
