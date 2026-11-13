const {
  API_HOST,
  FLOW_CACHE_TTL_MS,
} = require("../config/env");

const inFlightWeatherFetches = new Map();
const inFlightDayWeatherFetches = new Map();
const historicalBackfillDone = new Map();
const inFlightBackfills = new Map();
const inFlightAnnualBaselines = new Map();

const flowMemoryCache = new Map();
const lastKnownFallbackCache = new Map();
const completedRawDayCache = new Map();
const stationSyncState = new Map();
const inFlightSyncs = new Map();
const sseSubscribers = new Map();
const intelligenceCache = new Map();
const earningsMemoryCache = new Map();
const deviceListMemoryCache = new Map();

const emptyWeatherCache = () => ({
  data: null,
  timestamp: 0,
  lat: null,
  lon: null,
  tilt: null,
  azimuth: null,
  dateYmd: null,
});

let weatherCache = emptyWeatherCache();
let backoffUntil = 0;
let backoffReason = "";

function getWeatherCache() {
  return weatherCache;
}

function setWeatherCache(next) {
  weatherCache = next;
}

function clearWeatherCache() {
  weatherCache = emptyWeatherCache();
}

function clearModelCaches({ clearWeather = false } = {}) {
  if (clearWeather) {
    clearWeatherCache();
    historicalBackfillDone.clear();
  }
  inFlightAnnualBaselines.clear();
  intelligenceCache.clear();
}

function getCachedFlow(stationId, maxAgeMs = FLOW_CACHE_TTL_MS) {
  if (!stationId) return null;
  const entry = flowMemoryCache.get(stationId);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age < maxAgeMs) {
    return {
      data: entry.data,
      ageSec: Math.floor(age / 1000),
      remainingSec: Math.ceil((maxAgeMs - age) / 1000),
    };
  }
  return null;
}

function setCachedFlow(stationId, data) {
  if (!stationId || !data) return;
  flowMemoryCache.set(stationId, {
    timestamp: Date.now(),
    data,
  });
}

function triggerAutoBackoff(minutes = 10, reason = "Rate Limit or Server Anomaly") {
  backoffUntil = Date.now() + minutes * 60 * 1000;
  backoffReason = reason;
  console.warn(`\n⚠️  [AUTO-BACKOFF TRIGGERED] Pausing all outbound calls to ${API_HOST} for ${minutes} min.`);
  console.warn(`   Resuming at: ${new Date(backoffUntil).toLocaleTimeString()} (IST)`);
  console.warn(`   Reason: ${reason}\n`);
}

function isBackoffActive() {
  return Date.now() < backoffUntil;
}

function getBackoffRemainingSec() {
  return Math.max(0, Math.ceil((backoffUntil - Date.now()) / 1000));
}

function getBackoffReason() {
  return backoffReason || null;
}

function saveLastKnown(endpointKey, data) {
  if (!endpointKey || !data) return;
  lastKnownFallbackCache.set(endpointKey, { data, savedAt: Date.now() });
}

function getLastKnown(endpointKey) {
  return lastKnownFallbackCache.get(endpointKey) || null;
}

module.exports = {
  inFlightWeatherFetches,
  inFlightDayWeatherFetches,
  historicalBackfillDone,
  inFlightBackfills,
  inFlightAnnualBaselines,
  flowMemoryCache,
  lastKnownFallbackCache,
  completedRawDayCache,
  stationSyncState,
  inFlightSyncs,
  sseSubscribers,
  intelligenceCache,
  earningsMemoryCache,
  deviceListMemoryCache,
  getWeatherCache,
  setWeatherCache,
  clearWeatherCache,
  clearModelCaches,
  getCachedFlow,
  setCachedFlow,
  triggerAutoBackoff,
  isBackoffActive,
  getBackoffRemainingSec,
  getBackoffReason,
  saveLastKnown,
  getLastKnown,
};
