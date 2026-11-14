/** Read the Host's live-preferred logical corpus without opening or mutating Sessions. */
import { resolve as resolvePath } from 'node:path';

const COVERAGE = '改动统计仅包含会话中能确认已执行的文件工具结果；终端命令、外部修改及未持久化的工作区快照可能不完整，不代表全部 Git 改动或净增删行数。';

function textOf(message) {
  return (Array.isArray(message?.content) ? message.content : [])
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text).join('\n');
}

function jsonArguments(value) {
  if (typeof value !== 'string') return {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch { return {}; }
}

function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function inRange(time, range) { return Number.isFinite(time) && time >= range.startMs && time < range.endMs; }
function abort(signal) { signal?.throwIfAborted(); }
function sameFilePath(left, right, cwd) { return left === right || (cwd && resolvePath(cwd, left) === resolvePath(cwd, right)); }
function recordedArguments(call) {
  return typeof call?.data?.arguments === 'string' && call.data.arguments.length
    ? `\n调用参数（原始记录，仅供引用）：\n${call.data.arguments}` : '';
}

/** Provider call ids can repeat in later requests; never let a future call replace a historical one. */
function pairToolEvents(events) {
  const pending = new Map(), callsByResult = new Map(), resultsByCall = new Map();
  const coordinate = event => Number.isInteger(event.data?.turn) && Number.isInteger(event.data?.step)
    ? `${event.data.turn}:${event.data.step}` : undefined;
  for (const event of events) {
    if (event.type === 'tool/call' && typeof event.data?.callId === 'string') {
      const list = pending.get(event.data.callId) ?? [];
      list.push(event); pending.set(event.data.callId, list);
    } else if (event.type === 'tool/result') {
      const message = event.data?.message;
      const callId = message?.toolCallId ?? message?.source?.callId;
      const list = pending.get(callId);
      if (!list?.length) continue;
      const position = coordinate(event);
      let index = position === undefined ? list.length - 1 : list.findIndex(call => coordinate(call) === position);
      if (index < 0) index = list.findLastIndex(call => coordinate(call) === undefined);
      if (index < 0) continue;
      const [call] = list.splice(index, 1);
      callsByResult.set(event, call); resultsByCall.set(call, event);
    }
  }
  return { callsByResult, resultsByCall };
}

/** A conservative section locator, used only after a result confirms the corresponding path. */
function patchSections(input, cwd) {
  const sections = new Map();
  const remember = (filePath, section) => {
    sections.set(filePath, section);
    if (cwd) sections.set(resolvePath(cwd, filePath), section);
  };
  let current;
  for (const line of (typeof input === 'string' ? input : '').split('\n')) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header) {
      current = { path: header[2], operation: { Add: 'create', Update: 'update', Delete: 'delete' }[header[1]], lines: [] };
      remember(current.path, current);
    } else if (current && line.startsWith('*** Move to: ')) {
      current.operation = 'move'; current.destination = line.slice(13); remember(current.destination, current);
    } else if (current && !line.startsWith('*** End Patch')) current.lines.push(line);
  }
  return sections;
}

function appliedDiffs(meta) {
  return (Array.isArray(meta.diffs) ? meta.diffs : []).filter(diff =>
    diff && typeof diff.path === 'string' && (diff.oldText === null || typeof diff.oldText === 'string')
      && typeof diff.newText === 'string');
}

function changeText(operation, path, diffs, fallback) {
  const label = { create: '创建', update: '修改', delete: '删除', move: '移动', write: '已执行写入', edit: '已执行编辑' }[operation] ?? '修改';
  const body = diffs.length
    ? diffs.map(diff => `改动前（已记录片段）：\n${diff.oldText ?? ''}\n改动后（已记录片段）：\n${diff.newText}`).join('\n\n')
    : fallback;
  return `${label}文件 ${path}${body ? `\n${body}` : '\n（该记录未包含文件内容差异）'}`;
}

/** Paths requested by a call are never sufficient proof that an apply_patch operation completed. */
function confirmedChanges(call, result, resultText, warn, cwd) {
  const meta = record(result.data?.meta);
  const args = jsonArguments(call?.data?.arguments);
  const name = call?.data?.name;
  const diffs = appliedDiffs(meta);
  const paths = new Map();
  if (name === 'apply_patch') {
    const sections = patchSections(args.input, cwd);
    let completedBlock = /^Success\. Updated the following files:/m.test(resultText);
    for (const line of resultText.split('\n')) {
      if (line === 'Completed:') { completedBlock = true; continue; }
      if (/^(Failed:|Outcome unknown:|Not executed:)$/.test(line)) { completedBlock = false; continue; }
      const match = completedBlock && /^([AMD]) (.+)$/.exec(line);
      if (match) paths.set(match[2], { operation: { A: 'create', M: 'update', D: 'delete' }[match[1]], status: 'success' });
    }
    // Persisted diffs may also prove a partial move's destination was changed.
    for (const diff of diffs) if (![...paths.keys()].some(filePath => sameFilePath(filePath, diff.path, cwd))) {
      paths.set(diff.path, { operation: 'update', status: meta.stopped ? 'partial' : 'success' });
    }
    if (!paths.size && !/Success\. No operations in patch\./.test(resultText)) warn('补丁工具结果缺少可确认的已完成文件，未将请求中的路径计为成功改动。');
    return [...paths].map(([path, details]) => {
      const section = sections.get(path) ?? (cwd ? sections.get(resolvePath(cwd, path)) : undefined);
      return { path, ...details, text: changeText(section?.operation ?? details.operation, path,
        diffs.filter(diff => sameFilePath(diff.path, path, cwd)), section?.lines.join('\n')) };
    });
  }
  if (name !== 'write' && name !== 'edit') return [];
  const path = typeof meta.path === 'string' ? meta.path
    : diffs[0]?.path ?? (typeof args.file_path === 'string' ? args.file_path : /<path>([^<]+)<\/path>/.exec(resultText)?.[1]);
  if (!path) { warn('文件工具成功结果缺少文件路径，未计为可确认的文件改动。'); return []; }
  const operation = meta.operation === 'create' || /\bCreated file\b/.test(resultText) ? 'create' : 'update';
  const missingComparison = diffs.length === 0 && operation !== 'create';
  if (missingComparison) warn('文件工具已成功执行，但未记录前后差异；已计为文件操作，无法据此判断文件内容是否发生变化。');
  const fallback = name === 'write' && typeof args.content === 'string'
    ? `执行时写入内容：\n${args.content}`
    : name === 'edit' && typeof args.old_string === 'string' && typeof args.new_string === 'string'
      ? `执行时替换片段：\n${args.old_string}\n替换为：\n${args.new_string}` : '';
  return [{ path, status: 'success', text: changeText(missingComparison ? name : operation, path, diffs,
    `${missingComparison ? '前后差异不可用，不能确认内容是否发生变化。\n' : ''}${fallback}`) }];
}

/**
 * Collect all sessions active in the half-open interval [startMs, endMs).
 * Message and result timestamps determine membership, never Session creation time.
 */
export async function collectActivity(ctx, range, { signal } = {}) {
  if (!Number.isFinite(range?.startMs) || !Number.isFinite(range?.endMs) || range.endMs <= range.startMs) {
    throw new Error('报告时间范围无效。');
  }
  const query = ctx.sessionQuery;
  if (!query?.listSessions || !query?.readSession) throw new Error('宿主未提供 sessionQuery，会话读取服务不可用。');
  abort(signal);
  const records = await query.listSessions(signal);
  if (!Array.isArray(records)) throw new Error('宿主会话列表格式无效。');
  const warnings = new Set([COVERAGE]);
  const sessions = [], evidence = [];
  const stats = { sessionCount: 0, messageCount: 0, toolCount: 0, changeCount: 0, failedToolCount: 0 };
  const seen = new Set();
  for (const entry of records) {
    abort(signal);
    const id = entry?.header?.id;
    if (typeof id !== 'string' || !id) { warnings.add('宿主返回了缺少标识的会话，无法读取该条记录。'); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    let snapshot;
    try { snapshot = await query.readSession(id); }
    catch (error) {
      abort(signal);
      // Never expose arbitrary Host errors: they may include message bodies or credentials.
      warnings.add(`会话 ${id} 读取失败，报告覆盖不完整。`);
      continue;
    }
    abort(signal);
    if (!Array.isArray(snapshot?.events)) { warnings.add(`会话 ${id} 的事件格式无效，报告覆盖不完整。`); continue; }
    const events = snapshot.events;
    const inherited = Number.isSafeInteger(snapshot.inheritedEventCount) ? snapshot.inheritedEventCount : 0;
    const ownEvents = events.filter(event => !(Number.isFinite(event.seq) && event.seq < inherited));
    const active = ownEvents.filter(event => inRange(event.time, range));
    if (!active.length) continue;
    const titleEvent = events.findLast(event => event.type === 'session/title' && typeof event.data?.title === 'string');
    const title = titleEvent?.data.title ?? entry.title ?? id;
    const cwd = snapshot.session?.cwd ?? entry.header.cwd ?? '';
    const base = { sessionId: id, sessionTitle: title, cwd };
    const sessionEvidence = [];
    const { callsByResult, resultsByCall } = pairToolEvents(events);
    for (const event of active) {
      if (event.type === 'user/message' || event.type === 'assistant/message') {
        const message = event.type === 'user/message' ? event.data : event.data?.message;
        // Host-injected user-role context is not a human instruction.
        if (event.type === 'user/message' && message?.source?.kind && message.source.kind !== 'user') continue;
        const type = event.type === 'user/message' ? 'user' : 'assistant';
        const text = textOf(message);
        sessionEvidence.push({ ...base, time: event.time, type, text: text || '（非文本消息，未读取附件内容）', seq: event.seq });
        stats.messageCount++;
      }
      if (event.type !== 'tool/result') continue;
      const message = event.data?.message;
      const call = callsByResult.get(event);
      const name = call?.data?.name ?? '未识别工具';
      const resultText = textOf(message);
      const meta = record(event.data?.meta);
      const failed = message?.isError === true || event.data?.error !== undefined;
      const partial = !failed && (meta.stopped === true || /^Patch stopped after /m.test(resultText));
      const status = failed ? 'failed' : partial ? 'partial' : message ? 'success' : 'unknown';
      stats.toolCount++;
      if (failed || partial) stats.failedToolCount++;
      sessionEvidence.push({ ...base, time: event.time, type: 'tool', status, toolName: name,
        text: `${name}（${{ failed: '失败', partial: '部分执行后停止', success: '工具返回成功', unknown: '结果未知' }[status]}）${recordedArguments(call)}${resultText ? `\n执行结果：\n${resultText}` : ''}`, seq: event.seq });
      if (status === 'unknown') warnings.add(`会话 ${id} 存在缺少有效结果的工具记录，未将其视为已完成改动。`);
      if (failed || status === 'unknown') continue;
      for (const change of confirmedChanges(call, event, resultText, warning => warnings.add(`会话 ${id}：${warning}`), cwd)) {
        sessionEvidence.push({ ...base, time: event.time, type: 'change', ...change, seq: event.seq, toolName: name });
        stats.changeCount++;
      }
    }
    for (const event of active) {
      if (event.type !== 'tool/call') continue;
      const result = resultsByCall.get(event);
      if (result && inRange(result.time, range)) continue;
      // A result after endMs must not retroactively make an in-range call successful.
      if (result && result.time < range.startMs) continue;
      stats.toolCount++;
      const name = event.data?.name ?? '未识别工具';
      sessionEvidence.push({ ...base, time: event.time, type: 'tool', status: 'unknown', toolName: name,
        text: `${name}（所选时间范围内没有完成结果，执行状态未知）${recordedArguments(event)}`, seq: event.seq });
      warnings.add(`会话 ${id} 存在所选范围内未得到完成结果的工具调用，未计为已完成改动。`);
    }
    if (!sessionEvidence.length) continue;
    sessionEvidence.sort((a, b) => a.time - b.time || (a.seq ?? 0) - (b.seq ?? 0));
    sessions.push({ id, title, cwd, messageCount: sessionEvidence.filter(item => item.type === 'user' || item.type === 'assistant').length,
      changeCount: sessionEvidence.filter(item => item.type === 'change').length,
      startTime: sessionEvidence[0].time, endTime: sessionEvidence.at(-1).time });
    evidence.push(...sessionEvidence);
  }
  abort(signal);
  stats.sessionCount = sessions.length;
  evidence.sort((a, b) => a.time - b.time || a.sessionId.localeCompare(b.sessionId) || (a.seq ?? 0) - (b.seq ?? 0));
  sessions.sort((a, b) => b.endTime - a.endTime || a.id.localeCompare(b.id));
  return { range, stats, sessions, evidence, warnings: [...warnings] };
}
