import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRange } from '../lib/range.js';

test('includes the entire selected end date in the chosen timezone', () => {
  const range = normalizeRange({ start: '2026-11-14', end: '2026-11-16', timeZone: 'Asia/Singapore', preset: 'custom' });
  assert.equal(new Date(range.startMs).toISOString(), '2026-11-13T16:00:00.000Z');
  assert.equal(new Date(range.endMs).toISOString(), '2026-11-16T16:00:00.000Z');
  assert.equal(range.label, '工作报告 · 2026-11-14 — 2026-11-16');
});

test('spring DST calendar day has 23 hours', () => {
  const range = normalizeRange({ start: '2026-03-08', end: '2026-03-08', timeZone: 'America/New_York', preset: 'day' });
  assert.equal(new Date(range.startMs).toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(new Date(range.endMs).toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(range.endMs - range.startMs, 23 * 3600000);
});

test('autumn DST calendar day has 25 hours', () => {
  const range = normalizeRange({ start: '2026-11-01', end: '2026-11-01', timeZone: 'America/New_York', preset: 'day' });
  assert.equal(new Date(range.startMs).toISOString(), '2026-11-01T04:00:00.000Z');
  assert.equal(new Date(range.endMs).toISOString(), '2026-11-02T05:00:00.000Z');
  assert.equal(range.endMs - range.startMs, 25 * 3600000);
});

test('supports a midnight clock jump and a skipped next calendar date', () => {
  const midnightJump = normalizeRange({ start: '2018-11-04', end: '2018-11-04', timeZone: 'America/Sao_Paulo' });
  assert.equal(new Date(midnightJump.startMs).toISOString(), '2018-11-04T03:00:00.000Z');
  assert.equal(midnightJump.endMs - midnightJump.startMs, 23 * 3600000);
  const dateLine = normalizeRange({ start: '2011-12-29', end: '2011-12-29', timeZone: 'Pacific/Apia' });
  assert.equal(new Date(dateLine.endMs).toISOString(), '2011-12-30T10:00:00.000Z');
  assert.throws(() => normalizeRange({ start: '2011-12-30', end: '2011-12-30', timeZone: 'Pacific/Apia' }), { status: 400 });
});

test('validates dates, ordering, preset, timezone, and input type', () => {
  const valid = { start: '2026-11-14', end: '2026-11-14', timeZone: 'Asia/Shanghai' };
  for (const input of [null, [], {}, { ...valid, start: '2026-02-29' }, { ...valid, end: '2026-13-01' },
    { ...valid, start: '2026-11-15' }, { ...valid, start: '2026-1-01' }, { ...valid, start: '0000-01-01' },
    { ...valid, timeZone: 'bad-zone' }, { ...valid, timeZone: {} }, { ...valid, preset: 'year' }]) {
    assert.throws(() => normalizeRange(input), { status: 400, code: 'INVALID_RANGE' });
  }
});

test('defaults timezone and preset while accepting leap dates and long periods', () => {
  const range = normalizeRange({ start: '2024-02-29', end: '2026-11-14' });
  assert.equal(range.timeZone, 'Asia/Shanghai');
  assert.equal(range.preset, 'custom');
  assert.equal(new Date(range.startMs).toISOString(), '2024-02-28T16:00:00.000Z');
  const earlyYear = normalizeRange({ start: '0001-01-01', end: '0001-01-01', timeZone: 'UTC' });
  assert.equal(new Date(earlyYear.startMs).toISOString(), '0001-01-01T00:00:00.000Z');
});
