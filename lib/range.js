const DAY_MS = 86_400_000;
const PRESETS = { day: '日报', week: '周报', month: '月报', custom: '工作报告' };

function invalid(message) {
  return Object.assign(new Error(message), { status: 400, code: 'INVALID_RANGE' });
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalid('日期格式须为 YYYY-MM-DD。');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw invalid('请选择真实有效的日期。');
  }
  return { value, date, key: year * 10000 + month * 100 + day };
}

function nextCalendarDate(value) {
  const date = new Date(value.date);
  date.setUTCDate(date.getUTCDate() + 1);
  return {
    date,
    key: date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate(),
  };
}

function localDateKey(formatter, milliseconds) {
  const parts = Object.fromEntries(formatter.formatToParts(milliseconds).map(part => [part.type, part.value]));
  const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
  return year * 10000 + Number(parts.month) * 100 + Number(parts.day);
}

// Find the first instant of a calendar date. Midnight is not always an existing
// local time (some zones advance their clocks at 00:00), so do not add 24 hours
// or rely on the host machine's timezone to construct day boundaries.
function dateBoundary(value, formatter) {
  const nominal = value.date.getTime();
  let low = nominal - 2 * DAY_MS;
  let high = nominal + 2 * DAY_MS;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (localDateKey(formatter, middle) < value.key) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function normalizeRange(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('请选择报告时间范围。');
  const start = calendarDate(input.start);
  const end = calendarDate(input.end);
  if (start.key > end.key) throw invalid('开始日期不能晚于结束日期。');

  const preset = input.preset ?? 'custom';
  if (!Object.hasOwn(PRESETS, preset)) throw invalid('不支持的报告类型。');
  const timeZone = input.timeZone ?? 'Asia/Shanghai';
  if (typeof timeZone !== 'string' || !timeZone) throw invalid('请选择有效时区。');
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', era: 'short',
    });
  } catch {
    throw invalid('请选择有效的 IANA 时区。');
  }

  const startMs = dateBoundary(start, formatter);
  const endDayStartMs = dateBoundary(end, formatter);
  if (localDateKey(formatter, startMs) !== start.key || localDateKey(formatter, endDayStartMs) !== end.key) {
    throw invalid('该日期在所选时区不存在，请调整时间范围。');
  }
  const endMs = dateBoundary(nextCalendarDate(end), formatter);
  return {
    start: start.value,
    end: end.value,
    timeZone,
    preset,
    startMs,
    endMs,
    label: `${PRESETS[preset]} · ${start.value}${start.value === end.value ? '' : ` — ${end.value}`}`,
  };
}
