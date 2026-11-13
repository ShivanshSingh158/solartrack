const IST_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getISTDateParts(baseDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(baseDate);
  const pick = (t) => parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = pick("hour") % 24;
  const minute = pick("minute");
  const second = pick("second");
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = `${year}-${pad(month)}-${pad(day)}`;
  const ym = `${year}-${pad(month)}`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthShort = IST_MONTH_SHORT[month - 1] || "Jan";
  const monthFull = IST_MONTH_FULL[month - 1] || "January";
  const hour12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    ymd,
    ym,
    daysInMonth,
    monthShort,
    monthUpper: monthFull.toUpperCase(),
    monthFull,
    minutesSinceMidnight: hour * 60 + minute,
    clockLabel: `${pad(hour12)}:${pad(minute)}:${pad(second)} ${ampm} IST`,
  };
}

function shiftISTYmd(deltaDays, baseDate = new Date()) {
  const p = getISTDateParts(baseDate);
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + deltaDays));
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();
  const pad = (n) => String(n).padStart(2, "0");
  const monthShort = IST_MONTH_SHORT[month - 1] || "Jan";
  return {
    year,
    month,
    day,
    ymd: `${year}-${pad(month)}-${pad(day)}`,
    ym: `${year}-${pad(month)}`,
    monthShort,
    shortLabel: `${monthShort} ${day}`,
    upperLabel: `${monthShort.toUpperCase()} ${day}`,
  };
}

function getISTClockSnapshot(baseDate = new Date()) {
  const today = getISTDateParts(baseDate);
  const yesterday = shiftISTYmd(-1, baseDate);
  const tomorrow = shiftISTYmd(1, baseDate);
  return {
    ...today,
    todayShortLabel: `${today.monthShort} ${today.day}`,
    todayUpperLabel: `${today.monthShort.toUpperCase()} ${today.day}`,
    yesterdayYmd: yesterday.ymd,
    yesterdayDay: yesterday.day,
    yesterdayMonth: yesterday.month,
    yesterdayShortLabel: yesterday.shortLabel,
    yesterdayUpperLabel: yesterday.upperLabel,
    tomorrowYmd: tomorrow.ymd,
    tomorrowDay: tomorrow.day,
    tomorrowMonth: tomorrow.month,
    tomorrowShortLabel: tomorrow.shortLabel,
    tomorrowUpperLabel: tomorrow.upperLabel,
  };
}

function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 3600000;
  return new Date(utc + istOffset);
}

function shiftYmdUtc(ymd, deltaDays) {
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function parseYmdToUtcMs(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

function parseClockMins(iso, fallbackMin) {
  if (!iso) return fallbackMin;
  const m = String(iso).match(/T?(\d{1,2}):(\d{2})/);
  if (!m) return fallbackMin;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

module.exports = {
  IST_MONTH_SHORT,
  IST_MONTH_FULL,
  getISTDateParts,
  shiftISTYmd,
  getISTClockSnapshot,
  getISTDate,
  shiftYmdUtc,
  parseYmdToUtcMs,
  parseClockMins,
};
