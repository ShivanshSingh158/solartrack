const solarEngine = require("@solar-track/core/intelligence");
const {
  WEATHER_HISTORY_CACHE_FILE,
  DAY_RAW_CACHE_FILE,
} = require("../config/env");
const { buildPhysicsArgsFromSettings } = require("../config/settingsStore");
const { loadJsonFileSafe, loadHistoryCache } = require("../storage/jsonFileStore");
const { stationSyncState, intelligenceCache } = require("../storage/memoryCaches");
const { getISTClockSnapshot } = require("../time/istClock");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const { extractMonthlyDays } = require("../waaree/endpoints");

/**
 * Assemble day atmosphere records, multi-month generation summaries, cached 5-minute raw
 * curves, and current ambient weather inputs for `@solar-track/core/intelligence`.
 */
function gatherLocalSolarEngineInputs({
  stationId,
  lat,
  lon,
  commissioningYmd,
  weather,
  istClock,
  snap,
}) {
  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);

  const dayRecordByYmd = new Map();
  const diskWeather = loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {});
  const prefix = `${latKey}_${lonKey}_`;
  for (const [k, rec] of Object.entries(diskWeather)) {
    if (!k.startsWith(prefix) || !rec) continue;
    const ymd = rec.ymd || rec.dateYmd || k.slice(prefix.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    dayRecordByYmd.set(ymd, { ...rec, ymd });
  }
  if (weather?.dailyAtmosphere) {
    for (const [ymd, rec] of Object.entries(weather.dailyAtmosphere)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !rec) continue;
      dayRecordByYmd.set(ymd, { ...rec, ymd });
    }
  }

  const generationByYmd = {};
  const histCache = loadHistoryCache();
  const startY = parseInt(commissioningYmd.slice(0, 4), 10);
  const startM = parseInt(commissioningYmd.slice(5, 7), 10);
  const endY = istClock.year;
  const endM = istClock.month;

  let curY = startY;
  let curM = startM;
  while (curY < endY || (curY === endY && curM <= endM)) {
    const cacheKey = `${stationId}_month_${curY}_${curM}`;
    let monthDays = extractMonthlyDays(histCache[cacheKey]);
    if (
      curY === endY &&
      curM === endM &&
      Array.isArray(snap?.waaree?.monthlyDays) &&
      snap.waaree.monthlyDays.length > 0
    ) {
      monthDays = snap.waaree.monthlyDays;
    }
    const ymPrefix = `${curY}-${String(curM).padStart(2, "0")}`;
    for (const entry of monthDays) {
      const dayNum = Number(entry.index);
      if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) continue;
      const ymd = `${ymPrefix}-${String(dayNum).padStart(2, "0")}`;
      if (ymd < commissioningYmd || ymd > istClock.ymd) continue;
      const kwh = parseFloat((Number(entry.value) || 0).toFixed(2));
      generationByYmd[ymd] = {
        ymd,
        realKwh: kwh,
        isConfirmed:
          ymd < istClock.ymd
            ? kwh > 0
            : (Boolean(snap?.waaree?.isHardwareLive) || Boolean(snap?.waaree?.todayRaw?.length)) &&
              kwh > 0,
      };
    }
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }

  const todayHasLivePackets = Boolean(
    snap?.waaree?.isHardwareLive ||
      (Array.isArray(snap?.waaree?.todayRaw) && snap.waaree.todayRaw.length > 0) ||
      (Number(snap?.waaree?.summary?.generationToday) || 0) > 0.05
  );
  const todayYieldSnap = snap?.waaree?.summary?.generationToday;
  if (todayHasLivePackets && typeof todayYieldSnap === "number" && todayYieldSnap > 0) {
    generationByYmd[istClock.ymd] = {
      ...(generationByYmd[istClock.ymd] || { ymd: istClock.ymd }),
      realKwh: parseFloat(todayYieldSnap.toFixed(2)),
      isConfirmed: true,
    };
  } else if (generationByYmd[istClock.ymd] && !todayHasLivePackets) {
    generationByYmd[istClock.ymd].realKwh = null;
    generationByYmd[istClock.ymd].isConfirmed = false;
  }

  const diskRaw = loadJsonFileSafe(DAY_RAW_CACHE_FILE, {});
  const rawPrefix = `${stationId}_`;
  for (const [k, series] of Object.entries(diskRaw)) {
    if (!k.startsWith(rawPrefix) || !Array.isArray(series) || series.length === 0) continue;
    const ymd = k.slice(rawPrefix.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || ymd < commissioningYmd) continue;
    if (!generationByYmd[ymd]) {
      generationByYmd[ymd] = { ymd, realKwh: null, isConfirmed: false };
    }
    generationByYmd[ymd].rawSeries = series;
  }
  if (
    Array.isArray(snap?.waaree?.todayRaw) &&
    snap.waaree.todayRaw.length > 0 &&
    generationByYmd[istClock.ymd]
  ) {
    generationByYmd[istClock.ymd].rawSeries = snap.waaree.todayRaw;
  }
  if (
    Array.isArray(snap?.waaree?.yesterdayRaw) &&
    snap.waaree.yesterdayRaw.length > 0 &&
    generationByYmd[istClock.yesterdayYmd]
  ) {
    generationByYmd[istClock.yesterdayYmd].rawSeries = snap.waaree.yesterdayRaw;
  }

  const curW = weather?.current || {};
  const curAq = weather?.airQuality?.current || {};
  const curHourDew = weather?.hourly?.dew_point_2m?.[istClock.hour];
  const currentWeather = {
    temperatureC: typeof curW.temperature_2m === "number" ? curW.temperature_2m : null,
    dewPointC: typeof curHourDew === "number" ? curHourDew : null,
    humidityPct: typeof curW.relative_humidity_2m === "number" ? curW.relative_humidity_2m : null,
    precipitationMm: typeof curW.precipitation === "number" ? curW.precipitation : null,
    windSpeedKmh: typeof curW.wind_speed_10m === "number" ? curW.wind_speed_10m : null,
    cloudCoverPct: typeof curW.cloud_cover === "number" ? curW.cloud_cover : null,
    weatherCode: typeof curW.weather_code === "number" ? curW.weather_code : null,
    pm10: typeof curAq.pm10 === "number" ? curAq.pm10 : null,
    pm25: typeof curAq.pm2_5 === "number" ? curAq.pm2_5 : null,
    dust: typeof curAq.dust === "number" ? curAq.dust : null,
    aod: typeof curAq.aerosol_optical_depth === "number" ? curAq.aerosol_optical_depth : null,
    usAqi: typeof curAq.us_aqi === "number" ? curAq.us_aqi : null,
  };

  return {
    days: Array.from(dayRecordByYmd.values()),
    generationByYmd,
    currentWeather,
    todayHasLivePackets,
  };
}

/**
 * Build canonical cache-key prefix reflecting geometry, cleaning history, and twin settings.
 */
function buildSettingsFingerprintPart(settings, latKey, lonKey, phys) {
  const manualInv =
    phys.inverterTareKw != null
      ? `${phys.inverterTareKw}:${phys.inverterLinearLoss ?? ""}:${phys.inverterQuadLoss ?? ""}`
      : "";
  const gridOff = Array.isArray(settings.manualGridOffDates)
    ? settings.manualGridOffDates.join(",")
    : "";
  return `${settings.lastCleanedDate || ""}:${(settings.cleaningEvents || []).length}:${latKey}_${lonKey}:${phys.arrayTiltDeg}:${phys.arrayAzimuthDeg}:${phys.dcCapacityKwp}:${phys.acInverterCapacityKw}:${phys.mountingType}:${phys.roofAlbedo}:${phys.dcCleanFactor}:${phys.thermalCoeffPerC}:${phys.useCalibratedTwin}:${phys.kSiteOverride ?? ""}:${manualInv}:${gridOff}:`;
}

/**
 * Shared parameter builder for `solarEngine.computeSolarIntelligence`.
 */
function buildSolarEngineParams({
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
}) {
  return {
    todayYmd: istClock.ymd,
    todayHasLivePackets,
    nowMinutesIst: istClock.hour * 60 + istClock.minute,
    commissioningYmd,
    capacityKwp: phys.dcCapacityKwp,
    dcCapacityKwp: phys.dcCapacityKwp,
    acInverterCapacityKw: phys.acInverterCapacityKw,
    tariffPerKwh: Number(settings.tariffPerKwh) || 8.0,
    tiltDegrees: phys.arrayTiltDeg,
    azimuthDegrees: phys.arrayAzimuthDeg,
    latitudeDeg: lat,
    longitudeDeg: lon,
    mountingType: phys.mountingType,
    roofAlbedo: phys.roofAlbedo,
    thermalCoeffPerC: phys.thermalCoeffPerC,
    dcCleanFactor: phys.dcCleanFactor,
    basePrAtStc: phys.basePrAtStc,
    inverterEfficiency: phys.inverterEfficiency,
    useCalibratedTwin: phys.useCalibratedTwin,
    kSiteOverride: phys.kSiteOverride,
    inverterTareKw: phys.inverterTareKw,
    inverterLinearLoss: phys.inverterLinearLoss,
    inverterQuadLoss: phys.inverterQuadLoss,
    washRecommendPct: settings.washRecommendPct,
    rainResetDailyMm: settings.rainResetDailyMm,
    currentWeather,
    days,
    generationByYmd,
    manualCleanEvents: settings.cleaningEvents || [],
    manualGridOffDates: settings.manualGridOffDates || [],
  };
}

/**
 * Compute or reuse cached surface loss & calibrated site physics parameters synchronously.
 */
function getQuickSiteCalibration(
  settings,
  weather,
  resolvedStation = null,
  istClockArg = null,
  snapArg = null
) {
  const resolved = resolvedStation || getPrimaryStationAndToken(null);
  const stationId = resolved.stationId || "default";
  const commissioningYmd =
    settings.commissioningDateOverride || resolved.commissioningYmd || "";
  const phys = buildPhysicsArgsFromSettings(settings, parseFloat(resolved.capacity) || 3.0);
  const lat = parseFloat(settings.plantLocation?.lat ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT);
  const lon = parseFloat(settings.plantLocation?.lon ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LON);
  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);

  const washFpPrefix = buildSettingsFingerprintPart(settings, latKey, lonKey, phys);
  const cached = intelligenceCache.get(stationId);
  if (
    cached &&
    String(cached.fingerprint || "").startsWith(washFpPrefix) &&
    cached.payload?.report?.siteCalibration
  ) {
    return {
      surfaceLossPct: Number(cached.payload?.report?.soiling?.surfaceLossPct) || 0,
      siteCalibration: cached.payload.report.siteCalibration,
    };
  }

  try {
    const istClock = istClockArg || getISTClockSnapshot();
    const snap = snapArg || stationSyncState.get(stationId)?.lastSnapshot || null;
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
    return {
      surfaceLossPct: Number(report?.soiling?.surfaceLossPct) || 0,
      siteCalibration: report?.siteCalibration || null,
    };
  } catch (err) {
    console.warn("[Soiling/Calibration] Quick compute fallback:", err.message);
    return { surfaceLossPct: 0, siteCalibration: null };
  }
}

/**
 * Convenience helper returning only the quick surface soiling loss percentage.
 */
function computeQuickSurfaceLossPct(settings, weather, resolvedStation = null) {
  return getQuickSiteCalibration(settings, weather, resolvedStation).surfaceLossPct;
}

module.exports = {
  gatherLocalSolarEngineInputs,
  buildSettingsFingerprintPart,
  buildSolarEngineParams,
  getQuickSiteCalibration,
  computeQuickSurfaceLossPct,
};
