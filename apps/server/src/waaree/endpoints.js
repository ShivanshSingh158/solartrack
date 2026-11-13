const {
  DAY_RAW_CACHE_FILE,
  FLOW_CACHE_TTL_MS,
  EARNINGS_CACHE_TTL_MS,
  DEVICE_LIST_CACHE_TTL_MS,
} = require("../config/env");
const {
  loadJsonFileSafe,
  saveJsonFileSafe,
  loadHistoryCache,
  saveHistoryCache,
} = require("../storage/jsonFileStore");
const {
  completedRawDayCache,
  earningsMemoryCache,
  deviceListMemoryCache,
  getCachedFlow,
  setCachedFlow,
  isBackoffActive,
} = require("../storage/memoryCaches");
const { getISTDateParts } = require("../time/istClock");
const { queuedForwardToWaaree, sleep } = require("./httpClient");

/**
 * Fetch live `/generic/v0/plant/flow/info` telemetry with 30s memory cache.
 * @param {string} stationId
 * @param {string} token
 * @param {boolean} [force=false]
 * @param {number} [maxCacheAgeMs=FLOW_CACHE_TTL_MS]
 */
async function fetchWaareeFlowInternal(
  stationId,
  token,
  force = false,
  maxCacheAgeMs = FLOW_CACHE_TTL_MS
) {
  if (!force && maxCacheAgeMs > 0) {
    const cached = getCachedFlow(stationId, maxCacheAgeMs);
    if (cached) {
      return {
        data: { ...cached.data, cached: true, cacheAgeSec: cached.ageSec },
        fromCache: true,
      };
    }
  }
  const result = await queuedForwardToWaaree(
    "GET",
    `/generic/v0/plant/flow/info?stationID=${encodeURIComponent(stationId)}`,
    null,
    token
  );
  if (result.data && result.data.errno === 0) {
    setCachedFlow(stationId, result.data);
  }
  return { data: result.data, fromCache: Boolean(result.data?.cached) };
}

/**
 * Parse a `YYYY-MM-DD HH:mm[:ss]` IST timestamp string into minutes-since-midnight metadata.
 * @param {string} rawStr
 */
function parseIstUploadTimestamp(rawStr) {
  if (!rawStr || typeof rawStr !== "string") return null;
  const trimmed = rawStr.trim();
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return {
    ymd: m[1],
    hhmm: `${m[2]}:${m[3]}`,
    minutes: hh * 60 + mm,
    label: trimmed,
  };
}

/**
 * Fetch `/c/v0/plant/earnings/detail` with memory cache & backoff fallback.
 * @param {string} stationId
 * @param {string} token
 * @param {boolean} [force=false]
 * @param {number} [maxCacheAgeMs=EARNINGS_CACHE_TTL_MS]
 */
async function fetchWaareePlantEarningsInternal(
  stationId,
  token,
  force = false,
  maxCacheAgeMs = EARNINGS_CACHE_TTL_MS
) {
  if (!stationId || !token) return { data: null, fromCache: false };
  const cached = earningsMemoryCache.get(stationId);
  if (!force && cached && maxCacheAgeMs > 0 && Date.now() - cached.timestamp < maxCacheAgeMs) {
    return { data: cached.data, fromCache: true };
  }
  if (isBackoffActive()) {
    return cached ? { data: cached.data, fromCache: true } : { data: null, fromCache: false };
  }
  const result = await queuedForwardToWaaree(
    "GET",
    `/c/v0/plant/earnings/detail?stationID=${encodeURIComponent(stationId)}`,
    null,
    token
  );
  if (result.data && result.data.errno === 0 && result.data.result) {
    earningsMemoryCache.set(stationId, {
      timestamp: Date.now(),
      data: result.data,
    });
    return { data: result.data, fromCache: false };
  }
  if (cached) {
    return { data: cached.data, fromCache: true };
  }
  return { data: result.data || null, fromCache: false };
}

/**
 * Fetch `/generic/v0/device/list` for a token and pick the matching station device.
 * @param {string} stationId
 * @param {string} token
 * @param {boolean} [force=false]
 * @param {number} [maxCacheAgeMs=DEVICE_LIST_CACHE_TTL_MS]
 */
async function fetchWaareeDeviceListInternal(
  stationId,
  token,
  force = false,
  maxCacheAgeMs = DEVICE_LIST_CACHE_TTL_MS
) {
  if (!token) return { devices: [], device: null, fromCache: false };
  const tokenKey = token.slice(-16);
  const pickDevice = (devices) => {
    if (!Array.isArray(devices) || devices.length === 0) return null;
    return devices.find((d) => d && d.stationID === stationId) || devices[0] || null;
  };
  const cached = deviceListMemoryCache.get(tokenKey);
  if (!force && cached && maxCacheAgeMs > 0 && Date.now() - cached.timestamp < maxCacheAgeMs) {
    return { devices: cached.devices, device: pickDevice(cached.devices), fromCache: true };
  }
  if (isBackoffActive()) {
    return cached
      ? { devices: cached.devices, device: pickDevice(cached.devices), fromCache: true }
      : { devices: [], device: null, fromCache: false };
  }
  const result = await queuedForwardToWaaree(
    "POST",
    "/generic/v0/device/list",
    { currentPage: 1, pageSize: 20, condition: { queryDate: { begin: 0, end: 0 } } },
    token
  );
  const devices =
    result.data?.errno === 0 && Array.isArray(result.data?.result?.devices)
      ? result.data.result.devices
      : null;
  if (devices) {
    deviceListMemoryCache.set(tokenKey, {
      timestamp: Date.now(),
      devices,
    });
    return { devices, device: pickDevice(devices), fromCache: false };
  }
  if (cached) {
    return { devices: cached.devices, device: pickDevice(cached.devices), fromCache: true };
  }
  return { devices: [], device: null, fromCache: false };
}

/**
 * Fetch monthly generation report (`month`) with immutable past-month caching and
 * midnight rollover protection when falling back to stale current-month cache.
 * @param {string} stationId
 * @param {number} year
 * @param {number} month
 * @param {string} token
 * @param {boolean} [bypassPastCache=false]
 */
async function fetchWaareeMonthReportInternal(
  stationId,
  year,
  month,
  token,
  bypassPastCache = false
) {
  const payload = {
    stationID: stationId,
    reportType: "month",
    queryDate: { year, month },
    variables: ["generation", "feedin", "gridConsumption", "loads"],
  };
  const cacheKey = `${stationId}_month_${year}_${month}`;
  const cache = loadHistoryCache();
  const istNow = getISTDateParts();
  const isPastMonth = year < istNow.year || (year === istNow.year && month < istNow.month);
  if (isPastMonth && !bypassPastCache && cache[cacheKey]) {
    return cache[cacheKey];
  }

  const res = await queuedForwardToWaaree(
    "POST",
    "/generic/v0/plant/history/report",
    payload,
    token
  );
  if (res.data?.errno === 0 && Array.isArray(res.data.result)) {
    const isCurrentMonth = year === istNow.year && month === istNow.month;
    if (isPastMonth || isCurrentMonth) {
      cache[cacheKey] = res.data.result;
      if (isCurrentMonth) {
        cache[`${cacheKey}_savedYmd`] = istNow.ymd;
      }
      saveHistoryCache(cache);
    }
    return res.data.result;
  }
  if (cache[cacheKey]) {
    const isCurrentMonth = year === istNow.year && month === istNow.month;
    if (
      isCurrentMonth &&
      cache[`${cacheKey}_savedYmd`] &&
      cache[`${cacheKey}_savedYmd`] !== istNow.ymd
    ) {
      return cache[cacheKey].map((s) => ({
        ...s,
        data: s.data ? s.data.filter((d) => Number(d.index) < istNow.day) : [],
      }));
    }
    return cache[cacheKey];
  }
  return [];
}

/**
 * Fetch annual generation report (`year`) from Waaree cloud.
 * @param {string} stationId
 * @param {number} year
 * @param {string} token
 */
async function fetchWaareeYearReportInternal(stationId, year, token) {
  const res = await queuedForwardToWaaree(
    "POST",
    "/generic/v0/plant/history/report",
    {
      stationID: stationId,
      reportType: "year",
      queryDate: { year },
      variables: ["generation", "feedin", "gridConsumption", "loads"],
    },
    token
  );
  return Array.isArray(res.data?.result) ? res.data.result : [];
}

/**
 * Multi-Year Lifetime Yield Aggregator (Prevents 2027+ New-Year Rollover Wipe):
 * Sums generation across `[commissioningYear .. currentYear]`, permanently freezing
 * completed past years in history_cache.json so past-year yields require zero extra API calls.
 */
async function fetchMultiYearLifetimeWithMonths(stationId, commissioningYmd, currentYear, token) {
  const parsedCommYear = parseInt(String(commissioningYmd || "2026-10-28").slice(0, 4), 10);
  const startYear = Number.isFinite(parsedCommYear)
    ? Math.max(2020, Math.min(currentYear, parsedCommYear))
    : currentYear;
  const cache = loadHistoryCache();
  let cacheDirty = false;
  let lifetimeTotal = 0;
  let otherYearsTotal = 0;
  let currentYearMonths = Array.isArray(cache[`${stationId}_year_months_${currentYear}`])
    ? cache[`${stationId}_year_months_${currentYear}`]
    : [];

  for (let y = startYear; y <= currentYear; y++) {
    const frozenKey = `${stationId}_year_total_${y}`;
    const monthsKey = `${stationId}_year_months_${y}`;
    if (y < currentYear && typeof cache[frozenKey] === "number" && cache[frozenKey] > 0) {
      lifetimeTotal += cache[frozenKey];
      otherYearsTotal += cache[frozenKey];
      continue;
    }

    let yearSum = null;
    if (!isBackoffActive() && token) {
      const series = await fetchWaareeYearReportInternal(stationId, y, token);
      const genYear = series.find((v) => v.variable === "generation");
      if (genYear?.data && Array.isArray(genYear.data)) {
        const mappedMonths = genYear.data.map((d) => ({
          index: Number(d.index),
          value: parseFloat((parseFloat(d.value) || 0).toFixed(2)),
        }));
        yearSum = mappedMonths.reduce((s, d) => s + (d.value || 0), 0);
        if (yearSum > 0) {
          cache[frozenKey] = parseFloat(yearSum.toFixed(2));
          cache[monthsKey] = mappedMonths;
          if (y === currentYear) {
            currentYearMonths = mappedMonths;
          }
          cacheDirty = true;
        }
      }
      if (y < currentYear) {
        await sleep(250);
      }
    }

    if (yearSum === null && typeof cache[frozenKey] === "number") {
      yearSum = cache[frozenKey];
    }
    const yrVal = Number(yearSum) || 0;
    lifetimeTotal += yrVal;
    if (y < currentYear) otherYearsTotal += yrVal;
  }

  if (cacheDirty) {
    saveHistoryCache(cache);
  }
  return {
    lifetimeTotal: parseFloat(lifetimeTotal.toFixed(2)),
    otherYearsTotal: parseFloat(otherYearsTotal.toFixed(2)),
    currentYearMonths,
  };
}

/**
 * Convenience wrapper returning only the summed multi-year lifetime kWh total.
 */
async function fetchMultiYearLifetimeKwh(stationId, commissioningYmd, currentYear, token) {
  const res = await fetchMultiYearLifetimeWithMonths(stationId, commissioningYmd, currentYear, token);
  return res.lifetimeTotal;
}

/**
 * Fetch 5-minute raw telemetry series for one IST calendar day, with memory + disk caching
 * for completed past days (and guard against partial overwrite of richer disk snapshots).
 */
async function fetchWaareeRawDayInternal(
  stationId,
  { year, month, day },
  ymdKey,
  token,
  allowCompletedCache = false,
  forceRefresh = false
) {
  const cacheKey = `${stationId}_${ymdKey}`;
  if (allowCompletedCache && !forceRefresh && completedRawDayCache.has(cacheKey)) {
    return completedRawDayCache.get(cacheKey);
  }
  const diskRaw = loadJsonFileSafe(DAY_RAW_CACHE_FILE, {});
  const existingDiskSeries = Array.isArray(diskRaw[cacheKey]) ? diskRaw[cacheKey] : null;
  if (allowCompletedCache && !forceRefresh && existingDiskSeries && existingDiskSeries.length > 0) {
    completedRawDayCache.set(cacheKey, existingDiskSeries);
    return existingDiskSeries;
  }
  if (isBackoffActive() || !token) {
    return existingDiskSeries || [];
  }
  const res = await queuedForwardToWaaree(
    "POST",
    "/generic/v0/plant/history/raw",
    {
      stationID: stationId,
      timespan: "day",
      beginDate: { year, month, day },
      variables: [
        "generationPower",
        "pvPower",
        "feedinPower",
        "gridConsumptionPower",
        "loadsPower",
        "radiation",
      ],
    },
    token
  );
  const series = Array.isArray(res.data?.result) ? res.data.result : [];
  if (allowCompletedCache) {
    const genPoints = series.find((s) => s.variable === "generationPower")?.data || [];
    const existingPts = Array.isArray(existingDiskSeries)
      ? existingDiskSeries.find((s) => s.variable === "generationPower")?.data?.length || 0
      : 0;
    if (genPoints.length > 0 && genPoints.length >= existingPts) {
      completedRawDayCache.set(cacheKey, series);
      diskRaw[cacheKey] = series;
      saveJsonFileSafe(DAY_RAW_CACHE_FILE, diskRaw);
    } else if (existingDiskSeries && existingDiskSeries.length > 0 && genPoints.length < existingPts) {
      return existingDiskSeries;
    }
  }
  return series;
}

/**
 * Extract sorted `{ index, value }` day entries from a Waaree month report.
 */
function extractMonthlyDays(reportResult) {
  const genSeries = Array.isArray(reportResult)
    ? reportResult.find((v) => v.variable === "generation")
    : null;
  if (!genSeries || !Array.isArray(genSeries.data)) return [];
  return genSeries.data.map((d) => ({
    index: Number(d.index),
    value: parseFloat(d.value) || 0,
  }));
}

/**
 * Summarize point count, last timestamp, and first >20W minute for a raw day curve.
 */
function summarizeRawSeries(rawResult) {
  if (!Array.isArray(rawResult)) return { count: 0, lastTime: null, firstActiveMin: null };
  const gen = rawResult.find((v) => v.variable === "generationPower");
  const pts = Array.isArray(gen?.data) ? gen.data : [];
  const lastTime = pts.length > 0 ? pts[pts.length - 1]?.time || null : null;
  let firstActiveMin = null;
  for (const pt of pts) {
    const val = parseFloat(pt?.value) || 0;
    if (val > 0.02) {
      const m = String(pt?.time || "").match(/(\d{1,2}):(\d{2})/);
      if (m) {
        firstActiveMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        break;
      }
    }
  }
  return { count: pts.length, lastTime, firstActiveMin };
}

/**
 * Trapezoidally integrate connected generation segments (`dt <= 25 min`) from raw points.
 */
function computeRawCurveTrapezoidalKwh(rawResult, dcCap = 3.0, acCap = 3.0) {
  if (!Array.isArray(rawResult)) return 0;
  const gen =
    rawResult.find((v) => v.variable === "generationPower") ||
    rawResult.find((v) => v.variable === "pvPower");
  const rawPts = Array.isArray(gen?.data) ? gen.data : [];
  const ceilingKw = Math.max((Number(acCap) || 3.0) * 1.25, (Number(dcCap) || 3.0) * 1.15, 0.5);
  const parsed = [];
  for (const pt of rawPts) {
    const m = String(pt?.time || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const min = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const val = parseFloat(pt?.value);
    if (!Number.isFinite(val)) continue;
    parsed.push({ min, kw: Math.min(ceilingKw, Math.max(0, val)) });
  }
  parsed.sort((a, b) => a.min - b.min);
  let kwh = 0;
  for (let i = 1; i < parsed.length; i++) {
    const dt = parsed[i].min - parsed[i - 1].min;
    if (dt > 0 && dt <= 25) {
      kwh += 0.5 * (parsed[i - 1].kw + parsed[i].kw) * (dt / 60);
    }
  }
  return parseFloat(kwh.toFixed(2));
}

let alarmsMemoryCache = new Map();

/**
 * Parse an alarm timestamp string into epoch milliseconds (IST timezone).
 * @param {string} timeStr
 * @returns {number}
 */
function parseAlarmTimestampMs(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const m = timeStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+05:30`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Fetch today's official alarms and fault records from the inverter hardware.
 * @param {string} stationId
 * @param {string} token
 * @param {string} [deviceSN=""]
 * @param {number} [maxCacheAgeMs=60000]
 */
async function fetchWaareeAlarmsToday(stationId, token, deviceSN = "", maxCacheAgeMs = 60000) {
  if (!stationId || !token) return { alarms: [], total: 0, fromCache: false };
  const cached = alarmsMemoryCache.get(stationId);
  if (cached && Date.now() - cached.timestamp < maxCacheAgeMs) {
    return { ...cached.data, fromCache: true };
  }

  const payload = {
    stationID: stationId,
    currentPage: 1,
    pageSize: 20,
    condition: { alarmType: 0, deviceSN: deviceSN || "" },
  };

  const res = await queuedForwardToWaaree(
    "POST",
    "/c/v0/plant/alarm/today/detail",
    payload,
    token
  );

  if (res.data?.errno === 0 && res.data.result) {
    const list = Array.isArray(res.data.result.data) ? res.data.result.data : [];
    const now = Date.now();
    const formatted = list.map((a) => {
      const timeMs = parseAlarmTimestampMs(a.time);
      const ageMs = timeMs > 0 ? Math.max(0, now - timeMs) : Infinity;
      const isRecent = ageMs < 15 * 60 * 1000; // occurred within the last 15 minutes
      const isGridDrop =
        String(a.content).toLowerCase().includes("no utility") ||
        String(a.content).toLowerCase().includes("grid") ||
        a.code === 3009;
      return {
        deviceSN: a.deviceSN,
        alarmType: a.alarmType,
        code: a.code,
        content: a.content,
        time: a.time,
        isGridDrop,
        isRecent,
        ageMinutes: Number.isFinite(ageMs) && ageMs !== Infinity ? Math.round(ageMs / 60000) : null,
      };
    });

    // Active grid drop: ONLY an alarm that occurred recently (< 15 mins)
    const activeGridDropAlarm = formatted.find((a) => a.isGridDrop && a.isRecent) || null;
    const latestGridDropToday = formatted.find((a) => a.isGridDrop) || null;

    const data = {
      alarms: formatted,
      total: res.data.result.total || formatted.length,
      hasActiveAlarm: Boolean(activeGridDropAlarm),
      activeGridDropAlarm,
      latestGridDropToday,
    };
    alarmsMemoryCache.set(stationId, { timestamp: Date.now(), data });
    return { ...data, fromCache: false };
  }

  if (cached) return { ...cached.data, fromCache: true };
  return { alarms: [], total: 0, hasActiveAlarm: false, activeGridDropAlarm: null, latestGridDropToday: null, fromCache: false };
}

module.exports = {
  fetchWaareeFlowInternal,
  parseIstUploadTimestamp,
  fetchWaareePlantEarningsInternal,
  fetchWaareeDeviceListInternal,
  fetchWaareeMonthReportInternal,
  fetchWaareeYearReportInternal,
  fetchMultiYearLifetimeWithMonths,
  fetchMultiYearLifetimeKwh,
  fetchWaareeRawDayInternal,
  extractMonthlyDays,
  summarizeRawSeries,
  computeRawCurveTrapezoidalKwh,
  fetchWaareeAlarmsToday,
};
