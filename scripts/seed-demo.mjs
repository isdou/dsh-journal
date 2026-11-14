#!/usr/bin/env node
/** Explicit, repeatable synthetic fixtures. Never reads or writes the user's ~/.dsh. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { constants, zstdCompressSync } from 'node:zlib';

const app = '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness';
if (!process.versions.electron) {
  const child = spawnSync(app, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit',
  });
  if (child.error) throw new Error('无法启动本机 DSH 的 Node 运行时。');
  process.exit(child.status ?? 1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoHome = path.join(root, '.dev', 'dsh-home');
async function ensureInsideDirectory(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('拒绝写入插件目录之外。');
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await fs.mkdir(current); stat = await fs.lstat(current); }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('拒绝通过符号链接或非目录写入演示数据。');
  }
}
await ensureInsideDirectory(demoHome);
const host = '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/';
const { sessionFormatCatalog: catalog } = await import(host + 'dsh-session-format-catalog/lib/index.js');
if (catalog.currentVersion !== 4) throw new Error('此演示夹具仅针对已验证的 DSH 会话格式 v4。');

// Client date and timezone are intentional, independent of the execution host's clock.
const day = Date.parse('2026-11-14T00:00:00+08:00');
const at = (hours, minutes = 0, seconds = 0) => day + ((hours * 60 + minutes) * 60 + seconds) * 1000;
const plain = text => ({ type: 'text', text });

function fixture({ suffix, title, hour, prompt, assistantText, tool, args, output, meta, failed = false, final }) {
  const id = `session-00000000-0000-4000-8000-000000000${suffix}`;
  const cwd = path.join(demoHome, 'demo-projects', suffix === '101' ? 'journal-api' : 'journal-interface');
  const header = { version: 4, id, createdAt: day - 4 * 86400000, cwd, isSeeded: false, delegationDepth: 0 };
  const callId = `demo-${suffix}-call`;
  const argumentsText = JSON.stringify(args);
  const model = { kind: 'model', provider: 'demo', model: 'synthetic-no-model-call' };
  const events = [];
  const add = (type, data, seconds, surface = false) => events.push({ type, seq: events.length,
    time: at(hour, 0, seconds), data, ...(surface ? { surfaceOp: 'append' } : {}) });
  add('session/title', { title, messageSeqs: [], source: { kind: 'user' } }, 0);
  add('turn/start', { turn: 1 }, 1);
  add('step/start', { turn: 1, step: 1 }, 2);
  add('user/message', { id: `demo-${suffix}-user`, role: 'user', source: { kind: 'user' }, content: [plain(prompt)] }, 3, true);
  add('assistant/message', { turn: 1, step: 1, stream: [], message: { id: `demo-${suffix}-assistant-1`, role: 'assistant', source: model,
    content: [plain(assistantText), { type: 'tool-call', id: callId, name: tool, arguments: argumentsText }] } }, 4, true);
  add('tool/call', { turn: 1, step: 1, callId, name: tool, arguments: argumentsText }, 5);
  add('tool/result', { turn: 1, step: 1, message: { id: `demo-${suffix}-result`, role: 'tool', source: { kind: 'tool', callId },
    toolCallId: callId, content: [plain(output)], ...(failed ? { isError: true } : {}) }, ...(meta ? { meta } : {}) }, 6, true);
  add('step/end', { turn: 1, step: 1 }, 7);
  add('step/start', { turn: 1, step: 2 }, 8);
  add('assistant/message', { turn: 1, step: 2, stream: [], message: { id: `demo-${suffix}-assistant-2`, role: 'assistant', source: model, content: [plain(final)] } }, 9, true);
  add('step/end', { turn: 1, step: 2 }, 10);
  add('turn/end', { turn: 1, reason: { kind: 'completed' } }, 11);
  return { header, events };
}

const fixtures = [
  fixture({ suffix: '101', title: '演示 · 报告接口与时间筛选', hour: 9,
    prompt: '为演示项目增加报告接口，按操作发生时间筛选。',
    assistantText: '先实现时间范围过滤，并保留会话来源。', tool: 'edit',
    args: { file_path: 'src/report.js', old_string: 'return allEvents;', new_string: 'return allEvents.filter(inRange);' },
    output: '<path>src/report.js</path>\n<type>file</type>\n<content>Updated file</content>',
    meta: { path: 'src/report.js', diffs: [{ path: 'src/report.js', oldText: 'return allEvents;', newText: 'return allEvents.filter(inRange);' }] },
    final: '演示代码已增加时间筛选。接口联调仍需继续，不代表生产发布。' }),
  fixture({ suffix: '102', title: '演示 · 日记界面与待办', hour: 14,
    prompt: '整理日报界面的布局，并验证导出操作。', assistantText: '先验证导出流程，之后再完成界面调整。', tool: 'bash',
    args: { command: 'npm run test:export' }, output: '演示测试失败：尚未实现导出处理。', failed: true,
    final: '导出验证未通过，导出处理与界面调整仍是待办。此会话没有已确认的文件改动。' }),
];

function projectKey(cwd) {
  let value = '', separatorRun = false;
  for (let i = 0; i < cwd.length; i++) {
    const ch = cwd[i];
    if (ch === '/' || ch === '\\' || ch === ':') { if (!separatorRun) value += '-'; separatorRun = true; }
    else { value += ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch) ? ch : '~' + cwd.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'); separatorRun = false; }
  }
  return `--${(value.replace(/^-+/, '') || 'root').slice(0, 251)}--`;
}

for (const { header, events } of fixtures) {
  const physicalHeader = catalog.encodeCurrentHeader(header, 0);
  const rows = events.map(event => catalog.encodeCurrentEvent(event));
  // Host-owned current-format decoder validates lifecycle, sources, framing, and replay before any write.
  const restore = catalog.createRestore(physicalHeader, { recovery: 'strict', validation: 'current' });
  for (const row of rows) restore.decodeRow(row);
  const restored = restore.finish();
  if (restored.events.length !== events.length) throw new Error('演示事件还原数量不一致。');
  const contents = Buffer.from([physicalHeader, ...rows].map(row => JSON.stringify(row)).join('\n') + '\n');
  const compress = value => zstdCompressSync(value, { params: { [constants.ZSTD_c_checksumFlag]: 1 } });
  // The Host lists only the first independent frame, which must hold exactly one header line.
  const compressed = Buffer.concat([
    compress(Buffer.from(JSON.stringify(physicalHeader) + '\n')),
    compress(Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n')),
  ]);
  const directory = path.join(demoHome, 'sessions', projectKey(header.cwd), header.id);
  await ensureInsideDirectory(directory);
  await ensureInsideDirectory(header.cwd);
  const file = path.join(directory, 'session.v4.jsonl.zstd');
  try { await fs.writeFile(file, compressed, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = await fs.readFile(file);
    if (!existing.equals(compressed)) {
      // Upgrade only this script's exact previous synthetic framing, never unrelated data.
      if (!existing.equals(compress(contents))) throw new Error('已存在的演示会话内容不同，拒绝覆盖。');
      const temporary = file + '.demo-upgrade';
      await fs.writeFile(temporary, compressed, { flag: 'wx' });
      await fs.rename(temporary, file);
    }
  }
}
console.log('已准备 2 个脱敏演示会话，仅写入本插件 .dev/dsh-home；未调用模型。');
