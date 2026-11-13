const solarEngine = require("@solar-track/core/intelligence");
const { loadSettings, buildPhysicsArgsFromSettings } = require("../config/settingsStore");
const { loadHistoryCache } = require("../storage/jsonFileStore");
const {
  stationSyncState,
  intelligenceCache,
  isBackoffActive,
} = require("../storage/memoryCaches");
const { getISTClockSnapshot } = require("../time/istClock");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const { fetchWaareeMonthReportInternal } = require("../waaree/endpoints");
const { fetchOpenMeteoWeather } = require("../weather/openMeteoClient");
const { ensureHistoricalAtmosphereBackfill } = require("../weather/historicalBackfill");
const {
  gatherLocalSolarEngineInputs,
  buildSettingsFingerprintPart,
  buildSolarEngineParams,
} = require("./localInputsCollector");

/**
 * Compute (and memoize by fingerprint) the complete solar intelligence payload including
 * calibration, soiling, outage recovery buffers, and reconciled MTD/Lifetime ledger.
 */
async function computeAndServeSolarIntelligence(
  stationIdInput = null,
  {
    force = false,
    weatherOverride = null,
    snapOverride = null,
    settingsOverride = null,
    resolvedOverride = null,
    istClockOverride = null,
  } = {}
) {
  const settings = settingsOverride || loadSettings();
  const resolved = resolvedOverride || getPrimaryStationAndToken(stationIdInput);
  const stationId = resolved.stationId || "default";
  const token = resolved.token || null;
  const commissioningYmd =
    settings.commissioningDateOverride || resolved.commissioningYmd || "";
  const istClock = istClockOverride || getISTClockSnapshot();

  const phys = buildPhysicsArgsFromSettings(settings, parseFloat(resolved.capacity) || 3.0);
  const tariffPerKwh = Number(settings.tariffPerKwh) || 8.0;
  const lat = parseFloat(settings.plantLocation?.lat ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT);
  const lon = parseFloat(settings.plantLocation?.lon ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LON);
  const tiltDegrees = phys.arrayTiltDeg;
  const azimuthDegrees = phys.arrayAzimuthDeg;
  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);

  const snap = snapOverride || stationSyncState.get(stationId)?.lastSnapshot || null;
  const washFp = `${buildSettingsFingerprintPart(settings, latKey, lonKey, phys)}${tariffPerKwh}:${commissioningYmd}:${settings.washRecommendPct ?? 7.0}:${settings.rainResetDailyMm ?? 5.0}:${settings.plantDisplayName || ""}`;
  const snapFp = `${istClock.ymd}:${Boolean(snap?.waaree?.isHardwareLive)}:${snap?.waaree?.summary?.generationToday ?? 0}:${snap?.waaree?.summary?.generationYesterday ?? 0}:${snap?.waaree?.monthlyDays?.length ?? 0}`;
  const fp = `${washFp}|${snapFp}`;

  const cached = intelligenceCache.get(stationId);
  if (!force && cached && cached.fingerprint === fp && Date.now() - cached.computedAt < 180000) {
    return cached.payload;
  }

  let weather = weatherOverride || null;
  if (!weather || force) {
    try {
      const [liveWeather] = await Promise.all([
        fetchOpenMeteoWeather(lat, lon, {
          force,
          tilt: tiltDegrees,
          azimuth: azimuthDegrees,
          dayTtlMin: settings.weatherCacheTtlMin,
        }),
        ensureHistoricalAtmosphereBackfill(
          lat,
          lon,
          commissioningYmd,
          force,
          tiltDegrees,
          azimuthDegrees
        ),
      ]);
      weather = liveWeather;
    } catch (e) {
      console.warn("[SolarIntelligence] Weather fetch fallback to disk cache:", e.message);
    }
  } else {
    ensureHistoricalAtmosphereBackfill(
      lat,
      lon,
      commissioningYmd,
      false,
      tiltDegrees,
      azimuthDegrees
    ).catch(() => null);
  }

  const histCache = loadHistoryCache();
  const startY = parseInt(commissioningYmd.slice(0, 4), 10);
  const startM = parseInt(commissioningYmd.slice(5, 7), 10);
  const endY = istClock.year;
  const endM = istClock.month;
  let curY = startY;
  let curM = startM;
  while (curY < endY || (curY === endY && curM <= endM)) {
    const cacheKey = `${stationId}_month_${curY}_${curM}`;
    const reportArr = histCache[cacheKey];
    if ((!Array.isArray(reportArr) || reportArr.length === 0) && token && !isBackoffActive()) {
      try {
        await fetchWaareeMonthReportInternal(stationId, curY, curM, token, false);
      } catch {
        // Ignore single-month API failures; local aggregator safely skips missing days
      }
    }
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }

  const { days, generationByYmd, currentWeather, todayHasLivePackets } =
    gatherLocalSolarEngineInputs({
      stationId,
      lat,
      lon,
      commissioningYmd,
      weather,
      istClock,
      snap,
    });

  const report = solarEngine.computeSolarIntelligence(
    buildSolarEngineParams({
      settings,
      phys,
      lat,
      lon,
      commissioningYmd,
      istClock,
      todayHasLivePackets,
      currentWeather,
      days,
      generationByYmd,
    })
  );

  const payload = {
    errno: 0,
    stationId,
    plantName:
      settings.plantDisplayName ||
      resolved.plantName ||
      settings.plantLocation?.name ||
      "Solar Station",
    plantLocation: settings.plantLocation,
    inBackoff: isBackoffActive(),
    report,
  };

  intelligenceCache.set(stationId, {
    fingerprint: fp,
    computedAt: Date.now(),
    payload,
  });
  return payload;
}

module.exports = {
  computeAndServeSolarIntelligence,
};
