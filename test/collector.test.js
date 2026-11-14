import test from 'node:test';
import assert from 'node:assert/strict';
import { collectActivity } from '../lib/collector.js';

const range = { startMs: 100, endMs: 200, start: '2026-11-14', end: '2026-11-14', timeZone: 'Asia/Singapore', preset: 'day', label: '日报' };
function user(time, text, seq = 0) { return { type: 'user/message', time, seq, data: { id: `u${seq}`, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } }; }
function assistant(time, text, seq = 1) { return { type: 'assistant/message', time, seq, data: { message: { id: `a${seq}`, role: 'assistant', source: { kind: 'model', provider: 'host', model: 'test' }, content: [{ type: 'text', text }] } } }; }
function call(time, name, args, id = 'c1', seq = 2) { return { type: 'tool/call', time, seq, data: { turn: 1, step: 1, callId: id, name, arguments: JSON.stringify(args) } }; }
function result(time, { id = 'c1', text = 'ok', isError = false, meta, seq = 3 } = {}) { return { type: 'tool/result', time, seq, data: { turn: 1, step: 1, message: { id: `t${seq}`, role: 'tool', source: { kind: 'tool', callId: id }, toolCallId: id, content: [{ type: 'text', text }], isError }, ...(meta ? { meta } : {}) } }; }
function host(logs) {
  const reads = [];
  return { reads, sessionQuery: {
    async listSessions() { return Object.keys(logs).map(id => ({ header: { id, createdAt: 1, cwd: '/project' }, live: false, persisted: true })); },
    async readSession(id) { reads.push(id); const log = logs[id]; if (log instanceof Error) throw log; return { session: { id, cwd: '/project' }, inheritedEventCount: 0, events: log }; },
  } };
}

test('scans old-created sessions, uses event times and excludes the end boundary', async () => {
  const ctx = host({ old: [user(99, 'before'), user(100, 'start', 1), assistant(199, 'inside', 2), user(200, 'after', 3)] });
  const value = await collectActivity(ctx, range);
  assert.deepEqual(ctx.reads, ['old']);
  assert.deepEqual(value.evidence.map(item => item.text), ['start', 'inside']);
  assert.equal(value.stats.messageCount, 2);
  assert.equal(value.stats.sessionCount, 1);
});

test('matches a call before the range to its successful edit result within it', async () => {
  const ctx = host({ s: [call(90, 'edit', { file_path: 'src/app.js', old_string: 'old', new_string: 'new' }),
    result(110, { meta: { path: '/project/src/app.js', diffs: [{ path: '/project/src/app.js', oldText: 'old', newText: 'new' }] } })] });
  const value = await collectActivity(ctx, range);
  assert.equal(value.stats.toolCount, 1);
  assert.equal(value.stats.changeCount, 1);
  assert.equal(value.evidence.find(item => item.type === 'change').path, '/project/src/app.js');
  assert.match(value.evidence.find(item => item.type === 'change').text, /old[\s\S]*new/);
});

test('does not count failed edits as changes even if they carry a requested path', async () => {
  const value = await collectActivity(host({ s: [call(110, 'edit', { file_path: 'bad.js', old_string: 'a', new_string: 'b' }),
    result(120, { isError: true, text: 'denied', meta: { path: 'bad.js', diffs: [{ path: 'bad.js', oldText: 'a', newText: 'b' }] } })] }), range);
  assert.equal(value.stats.changeCount, 0);
  assert.equal(value.stats.failedToolCount, 1);
  assert.equal(value.evidence[0].status, 'failed');
});

test('does not use a future result to count an in-range call as complete', async () => {
  const value = await collectActivity(host({ s: [call(150, 'write', { file_path: 'a', content: 'new' }), result(201)] }), range);
  assert.equal(value.stats.toolCount, 1);
  assert.equal(value.stats.changeCount, 0);
  assert.equal(value.evidence[0].status, 'unknown');
  assert.ok(value.warnings.some(warning => warning.includes('未得到完成结果')));
});

test('pairs repeated provider call ids by turn and step instead of overwriting earlier writes', async () => {
  const write = call(110, 'write', { file_path: 'created.js', content: 'new' });
  const wrote = result(120, { meta: { path: 'created.js', operation: 'create', diffs: [] } });
  const read = call(130, 'read', { file_path: 'created.js' }, 'c1', 4); read.data.turn = 2;
  const readResult = result(140, { seq: 5, text: 'new' }); readResult.data.turn = 2;
  const value = await collectActivity(host({ s: [write, wrote, read, readResult] }), range);
  assert.deepEqual(value.evidence.filter(item => item.type === 'tool').map(item => item.toolName), ['write', 'read']);
  assert.equal(value.stats.toolCount, 2);
  assert.equal(value.stats.changeCount, 1);
});

test('pairs legacy call ids in log order when request coordinates are absent', async () => {
  const events = [call(110, 'write', { file_path: 'created.js', content: 'new' }),
    result(120, { meta: { path: 'created.js', operation: 'create', diffs: [] } }),
    call(130, 'read', { file_path: 'created.js' }, 'c1', 4), result(140, { seq: 5, text: 'new' })];
  for (const event of events) { delete event.data.turn; delete event.data.step; }
  const value = await collectActivity(host({ s: events }), range);
  assert.deepEqual(value.evidence.filter(item => item.type === 'tool').map(item => item.toolName), ['write', 'read']);
  assert.equal(value.stats.changeCount, 1);
  assert.equal(value.stats.toolCount, 2);
});

test('counts successful writes with unavailable diff bases as operations without asserting content changed', async () => {
  const value = await collectActivity(host({ s: [call(110, 'write', { file_path: 'a', content: 'created' }),
    result(120, { meta: { path: '/project/a', operation: 'create', diffs: [] } }),
    call(130, 'write', { file_path: 'b', content: 'same' }, 'c2', 4), result(140, { id: 'c2', seq: 5, meta: { path: 'b', operation: 'update', diffs: [] } })] }), range);
  assert.equal(value.stats.changeCount, 2);
  const changes = value.evidence.filter(item => item.type === 'change');
  assert.match(changes[0].text, /created/);
  assert.equal(changes[1].path, 'b');
  assert.match(changes[1].text, /已执行写入文件/);
  assert.match(changes[1].text, /不能确认内容是否发生变化/);
  assert.ok(value.warnings.some(warning => warning.includes('已计为文件操作')));
});

test('recognizes completed patch additions, edits, deletions and moved destinations', async () => {
  const input = '*** Begin Patch\n*** Add File: a.js\n+created\n*** Update File: b.js\n@@\n-old\n+new\n*** Delete File: c.js\n*** Update File: old.js\n*** Move to: moved.js\n@@\n-a\n+b\n*** End Patch';
  const value = await collectActivity(host({ s: [call(110, 'apply_patch', { input }),
    result(120, { text: 'Success. Updated the following files:\nA a.js\nM b.js\nM moved.js\nD c.js', meta: { diffs: [], stopped: false } })] }), range);
  const changes = value.evidence.filter(item => item.type === 'change');
  assert.deepEqual(changes.map(item => item.path), ['a.js', 'b.js', 'moved.js', 'c.js']);
  assert.match(changes[0].text, /created/);
  assert.match(changes[2].text, /移动文件/);
  assert.match(changes[3].text, /删除文件/);
});

test('partial patches count confirmed completed operations only', async () => {
  const value = await collectActivity(host({ s: [call(110, 'apply_patch', { input: '*** Begin Patch\n*** Add File: a\n+one\n*** Delete File: b\n*** End Patch' }),
    result(120, { text: 'Patch stopped after 1 of 2 operations.\nCompleted:\nA a\nFailed:\n- operation 2 (delete b, patch line 4): denied', meta: { diffs: [], stopped: true } })] }), range);
  assert.equal(value.stats.changeCount, 1);
  assert.equal(value.stats.failedToolCount, 1);
  assert.equal(value.evidence.find(item => item.type === 'tool').status, 'partial');
  assert.equal(value.evidence.find(item => item.type === 'change').path, 'a');
});

test('retains newly created patch content when result paths are absolute and request paths are relative', async () => {
  const value = await collectActivity(host({ s: [call(110, 'apply_patch', { input: '*** Begin Patch\n*** Add File: new.js\n+export const created = true;\n*** End Patch' }),
    result(120, { text: 'Success. Updated the following files:\nA /project/new.js', meta: { diffs: [], stopped: false } })] }), range);
  assert.equal(value.stats.changeCount, 1);
  const change = value.evidence.find(item => item.type === 'change');
  assert.equal(change.path, '/project/new.js');
  assert.match(change.text, /export const created = true/);
});

test('does not count absolute and relative spellings of the same confirmed patch file twice', async () => {
  const value = await collectActivity(host({ s: [call(110, 'apply_patch', { input: '*** Begin Patch\n*** Update File: src/a.js\n@@\n-old\n+new\n*** End Patch' }),
    result(120, { text: 'Success. Updated the following files:\nM /project/src/a.js', meta: { diffs: [{ path: 'src/a.js', oldText: 'old', newText: 'new' }], stopped: false } })] }), range);
  assert.equal(value.stats.changeCount, 1);
  assert.match(value.evidence.find(item => item.type === 'change').text, /old[\s\S]*new/);
});

test('a successful patch with no applied-path metadata never counts requested paths', async () => {
  const value = await collectActivity(host({ s: [call(110, 'apply_patch', { input: '*** Begin Patch\n*** Delete File: a\n*** End Patch' }), result(120)] }), range);
  assert.equal(value.stats.changeCount, 0);
  assert.ok(value.warnings.some(warning => warning.includes('缺少可确认')));
});

test('excludes fork-inherited events and injected user-role context', async () => {
  const ctx = host({ fork: [user(110, 'inherited', 0), user(120, 'own', 1), { ...user(130, 'context', 2), data: { ...user(130, 'context').data, source: { kind: 'subagent', form: 'relay' } } }] });
  const original = ctx.sessionQuery.readSession;
  ctx.sessionQuery.readSession = async id => ({ ...await original(id), inheritedEventCount: 1 });
  const value = await collectActivity(ctx, range);
  assert.deepEqual(value.evidence.map(item => item.text), ['own']);
});

test('reads every session and reports failures without leaking arbitrary errors', async () => {
  const logs = Object.fromEntries(Array.from({ length: 125 }, (_, i) => [`s${i}`, [user(120, 'work')]]));
  logs.bad = new Error('credential=secret-with-private-conversation');
  const ctx = host(logs);
  const value = await collectActivity(ctx, range);
  assert.equal(ctx.reads.length, 126);
  assert.equal(value.stats.sessionCount, 125);
  assert.ok(value.warnings.some(warning => warning.includes('bad') && warning.includes('覆盖不完整')));
  assert.ok(!JSON.stringify(value).includes('secret-with-private'));
});

test('reports coverage limitations for shell modifications and workspace announcement events', async () => {
  const value = await collectActivity(host({ s: [call(110, 'bash', { command: 'rm file.js' }), result(120), { type: 'workspace/changes', seq: 4, time: 130, data: { turn: 0 } }] }), range);
  assert.equal(value.stats.changeCount, 0);
  assert.match(value.warnings.join(' '), /终端命令.*不完整/);
});

test('retains recorded command arguments for both finished and unresolved tool calls', async () => {
  const value = await collectActivity(host({ s: [call(110, 'bash', { command: 'npm run test:collector-marker' }), result(120),
    call(130, 'bash', { command: 'npm run pending-marker' }, 'c2', 4)] }), range);
  const tools = value.evidence.filter(item => item.type === 'tool');
  assert.match(tools[0].text, /npm run test:collector-marker/);
  assert.match(tools[1].text, /npm run pending-marker/);
  assert.equal(tools[1].status, 'unknown');
});

test('missing services, invalid ranges, list failures and cancellation reject', async () => {
  await assert.rejects(collectActivity({}, range), /sessionQuery/);
  await assert.rejects(collectActivity(host({}), { startMs: 2, endMs: 1 }), /时间范围/);
  await assert.rejects(collectActivity({ sessionQuery: { listSessions() { throw new Error('list failed'); }, readSession() {} } }, range), /list failed/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(collectActivity(host({}), range, { signal: controller.signal }), { name: 'AbortError' });
});
