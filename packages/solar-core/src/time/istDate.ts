export interface IstClockParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hours: number; // 0..23
  minutes: number; // 0..59
  seconds: number; // 0..59
  totalMinutes: number; // 0..1439
  ymd: string; // "YYYY-MM-DD"
  ym: string; // "YYYY-MM"
  daysInMonth: number;
  monthShort: string; // "Nov"
  monthUpper: string; // "NOVEMBER"
  monthFull: string; // "November"
  shortLabel: string; // "Nov 11"
  upperLabel: string; // "NOV 11"
  indianShortLabel: string; // "11 Nov"
  indianMediumLabel: string; // "11 Nov 2026"
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function buildParts(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): IstClockParts {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const monthShort = SHORT_MONTHS[month - 1] || 'Nov';
  const monthFull = FULL_MONTHS[month - 1] || 'November';
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    totalMinutes: hours * 60 + minutes,
    ymd: `${year}-${mm}-${dd}`,
    ym: `${year}-${mm}`,
    daysInMonth,
    monthShort,
    monthUpper: monthFull.toUpperCase(),
    monthFull,
    shortLabel: `${monthShort} ${day}`,
    upperLabel: `${monthShort.toUpperCase()} ${day}`,
    indianShortLabel: `${dd} ${monthShort}`,
    indianMediumLabel: `${dd} ${monthShort} ${year}`,
  };
}

/**
 * Returns deterministic wall-clock date/time components in Asia/Kolkata (IST, UTC+5:30),
 * immune to browser timezone offsets and midnight–05:30 AM UTC lag.
 */
export function getIstClockParts(date: Date = new Date()): IstClockParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  const year = parseInt(map.year || '2026', 10);
  const month = parseInt(map.month || '11', 10);
  const day = parseInt(map.day || '11', 10);
  const hours = parseInt(map.hour || '0', 10) % 24;
  const minutes = parseInt(map.minute || '0', 10);
  const seconds = parseInt(map.second || '0', 10);

  return buildParts(year, month, day, hours, minutes, seconds);
}

/**
 * Shifts an IST calendar date by `deltaDays` cleanly across month/year boundaries.
 */
export function shiftIstDays(deltaDays: number, baseDate: Date = new Date()): IstClockParts {
  const now = getIstClockParts(baseDate);
  const shifted = new Date(Date.UTC(now.year, now.month - 1, now.day + deltaDays));
  return buildParts(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    now.hours,
    now.minutes,
    now.seconds
  );
}

/**
 * Shifts an explicit "YYYY-MM-DD" IST calendar date by `deltaDays` cleanly across month/year boundaries.
 */
export function shiftIstFromYmd(ymd: string, deltaDays: number): IstClockParts {
  const m = String(ymd || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return shiftIstDays(deltaDays);
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return buildParts(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    0,
    0,
    0
  );
}

/**
 * Pure calendar arithmetic for "YYYY-MM-DD" strings (avoids UTC toISOString shifts).
 */
export function shiftYmdDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return shiftIstDays(deltaDays).ymd;
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate()
  ).padStart(2, '0')}`;
}

/**
 * Returns recent month options ending at the current IST month (plus prior months).
 */
export function getRecentIstMonthOptions(count = 4, baseDate: Date = new Date()): Array<{ value: string; label: string }> {
  const cur = getIstClockParts(baseDate);
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(cur.year, cur.month - 1 - i, 1));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    out.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: `${FULL_MONTHS[m - 1]} ${y}`,
    });
  }
  return out;
}

export function formatIstShortLabel(day: number, monthNum?: number): string {
  const mIdx = (monthNum ?? getIstClockParts().month) - 1;
  return `${SHORT_MONTHS[mIdx] || 'Nov'} ${day}`;
}

export function formatIstUpperLabel(day: number, monthNum?: number): string {
  return formatIstShortLabel(day, monthNum).toUpperCase();
}

export function parseYmdParts(ymd: string): {
  year: number;
  month: number;
  day: number;
  dd: string;
  mm: string;
  monthShort: string;
  monthFull: string;
  ym: string;
  ymd: string;
} | null {
  const m = String(ymd || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    year,
    month,
    day,
    dd,
    mm,
    monthShort: SHORT_MONTHS[month - 1] || 'Nov',
    monthFull: FULL_MONTHS[month - 1] || 'November',
    ym: `${year}-${mm}`,
    ymd: `${year}-${mm}-${dd}`,
  };
}

/**
 * Formats a YYYY-MM-DD string or Date using clean Indian conventions:
 * - 'medium': "11 Nov 2026"
 * - 'short':  "11 Nov"
 * - 'numeric': "11/11/2026" (DD/MM/YYYY)
 * - 'weekday': "Wed, 11 Nov 2026"
 */
export function formatIndianDate(
  input: string | Date,
  style: 'short' | 'medium' | 'numeric' | 'weekday' = 'medium'
): string {
  const parts = input instanceof Date ? getIstClockParts(input) : parseYmdParts(input);
  if (!parts) return String(input || '');
  const dd = 'dd' in parts ? parts.dd : String(parts.day).padStart(2, '0');
  const mm = 'mm' in parts ? parts.mm : String(parts.month).padStart(2, '0');

  if (style === 'short') return `${dd} ${parts.monthShort}`;
  if (style === 'numeric') return `${dd}/${mm}/${parts.year}`;
  if (style === 'weekday') {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const wd = weekdays[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()] || '';
    return `${wd}, ${dd} ${parts.monthShort} ${parts.year}`;
  }
  return `${dd} ${parts.monthShort} ${parts.year}`;
}

export function formatIndianMonthYear(ym: string): string {
  const m = String(ym || '').match(/^(\d{4})-(\d{1,2})/);
  if (!m) return ym;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  return `${FULL_MONTHS[month - 1] || 'November'} ${year}`;
}

export function shiftYm(ym: string, deltaMonths: number): string {
  const m = String(ym || '').match(/^(\d{4})-(\d{1,2})/);
  if (!m) return getIstClockParts().ym;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const shifted = new Date(Date.UTC(y, mo - 1 + deltaMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Exact calendar days in a given IST month (handles 28/29/30/31 & leap years).
 */
export function daysInIstMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Signed integer difference (ymdA - ymdB) in whole calendar days.
 */
export function diffYmdDays(ymdA: string, ymdB: string): number {
  const a = parseYmdParts(ymdA);
  const b = parseYmdParts(ymdB);
  if (!a || !b) return 0;
  const msA = Date.UTC(a.year, a.month - 1, a.day);
  const msB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((msA - msB) / 86400000);
}

/**
 * Generates a Monday-first calendar grid for a "YYYY-MM" month (standard Indian calendar layout).
 */
export function buildMondayFirstMonthGrid(ym: string): Array<{ ymd: string; day: number; inMonth: boolean }> {
  const m = String(ym || '').match(/^(\d{4})-(\d{1,2})/);
  const nowParts = getIstClockParts();
  const year = m ? parseInt(m[1], 10) : nowParts.year;
  const month = m ? parseInt(m[2], 10) : nowParts.month;

  const firstDowUtc = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  const leadingEmpty = (firstDowUtc + 6) % 7; // Convert to Monday=0..Sunday=6
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;

  const cells: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(Date.UTC(year, month - 1, 1 - leadingEmpty + i));
    const cy = dt.getUTCFullYear();
    const cm = dt.getUTCMonth() + 1;
    const cd = dt.getUTCDate();
    cells.push({
      ymd: `${cy}-${String(cm).padStart(2, '0')}-${String(cd).padStart(2, '0')}`,
      day: cd,
      inMonth: cy === year && cm === month,
    });
  }
  return cells;
}
