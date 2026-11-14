import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function problem(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function checkedId(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw problem(400, 'INVALID_REPORT_ID', '报告编号无效。');
  return id.toLowerCase();
}

function metadata(report) {
  const result = {};
  for (const key of ['id', 'title', 'createdAt', 'updatedAt', 'range', 'stats', 'mode', 'modelId']) {
    if (report[key] !== undefined) result[key] = report[key];
  }
  return result;
}

function validMarkdown(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report) || typeof report.markdown !== 'string') {
    throw problem(400, 'INVALID_REPORT', '报告正文须为 Markdown 文本。');
  }
}

export class ReportStore {
  constructor(root) {
    if (typeof root !== 'string' || !root) throw new TypeError('ReportStore requires its own data directory.');
    this.root = resolve(root);
  }

  async list() {
    let entries;
    try {
      entries = await readdir(this.root, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const reports = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json') || !UUID.test(entry.name.slice(0, -5))) continue;
      reports.push(metadata(await this.get(entry.name.slice(0, -5))));
    }
    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  async get(id) {
    id = checkedId(id);
    let text;
    try {
      text = await readFile(join(this.root, `${id}.json`), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') throw problem(404, 'REPORT_NOT_FOUND', '找不到这份报告。');
      throw error;
    }
    try {
      const report = JSON.parse(text);
      if (!report || report.id !== id || typeof report.markdown !== 'string' || typeof report.createdAt !== 'string') throw new Error();
      return report;
    } catch {
      throw problem(500, 'CORRUPT_REPORT', `本地报告 ${id} 无法读取，请保留文件并检查数据备份。`);
    }
  }

  async save(report) {
    validMarkdown(report);
    const now = new Date().toISOString();
    const saved = { ...report, id: randomUUID(), createdAt: now, updatedAt: now };
    await this.#write(saved);
    return saved;
  }

  async update(id, changes) {
    validMarkdown(changes);
    const report = await this.get(id);
    const saved = { ...report, markdown: changes.markdown, updatedAt: new Date().toISOString() };
    await this.#write(saved);
    return saved;
  }

  async #write(report) {
    let json;
    try {
      json = JSON.stringify(report, null, 2);
    } catch {
      throw problem(400, 'INVALID_REPORT', '报告包含无法保存的数据。');
    }
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = join(this.root, `${report.id}.json`);
    const temporary = join(this.root, `.${report.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${json}\n`, { flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
}
