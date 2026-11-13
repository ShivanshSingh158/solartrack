const solarTruth = require("@solar-track/core/physics");
const {
  WEATHER_HISTORY_CACHE_FILE,
  ANNUAL_BASELINE_TTL_MS,
} = require("../config/env");
const {
  clampNumber,
  loadSettings,
  buildPhysicsArgsFromSettings,
} = require("../config/settingsStore");
const { loadJsonFileSafe, saveJsonFileSafe } = require("../storage/jsonFileStore");
const {
  historicalBackfillDone,
  inFlightBackfills,
  inFlightDayWeatherFetches,
  inFlightAnnualBaselines,
  getWeatherCache,
} = require("../storage/memoryCaches");
const {
  getISTDateParts,
  shiftISTYmd,
  shiftYmdUtc,
  parseYmdToUtcMs,
} = require("../time/istClock");
const {
  OPEN_METEO_FORECAST_HOURLY,
  OPEN_METEO_DAILY_FIELDS,
  httpGetJson,
  mapWmoCondition,
  normalizeEnsembleOpenMeteoResponse,
  indexAndExtractAtmosphereDays,
  fetchOpenMeteoWeather,
} = require("./openMeteoClient");

/**
 * Hydrate up to 31 trailing days of enriched hourly atmosphere + AQI data when disk cache
 * has gaps, deduplicated once per IST calendar day per site geometry.
 */
async function ensureHistoricalAtmosphereBackfill(
  lat,
  lon,
  commissioningYmd = "2026-10-28",
  force = false,
  tiltArg = null,
  azimuthArg = null
) {
  const currentIstYmd = getISTDateParts().ymd;
  const yesterdayYmd = shiftYmdUtc(currentIstYmd, -1);
  if (yesterdayYmd < commissioningYmd) {
    return { status: "no_past_days", fetched: false };
  }

  const settings = loadSettings();
  const safeTilt = parseFloat(
    clampNumber(tiltArg ?? settings.arrayTiltDeg, 0, 60, 26.5).toFixed(1)
  );
  const safeAzimuth = Math.round(
    clampNumber(azimuthArg ?? settings.arrayAzimuthDeg, -180, 180, 0)
  );
  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);
  const coordKey = `${latKey}_${lonKey}`;
  const flightCoordKey = `${coordKey}_t${safeTilt}_a${safeAzimuth}`;

  if (!force) {
    const done = historicalBackfillDone.get(flightCoordKey);
    if (done && done.istYmd === currentIstYmd) {
      return { status: "cached_today", fetched: false };
    }
  }

  if (inFlightBackfills.has(flightCoordKey)) {
    return inFlightBackfills.get(flightCoordKey);
  }

  const work = (async () => {
    try {
      const earliestWindowYmd = shiftYmdUtc(currentIstYmd, -30);
      const startYmd = commissioningYmd > earliestWindowYmd ? commissioningYmd : earliestWindowYmd;
      const diskCache = loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {});
      let missingCount = 0;

      if (startYmd <= yesterdayYmd) {
        let cursor = startYmd;
        let safety = 0;
        while (cursor <= yesterdayYmd && safety < 40) {
          const rec = diskCache[`${coordKey}_${cursor}`];
          const enriched =
            rec &&
            rec.ensembleVersion === 1 &&
            Array.isArray(rec.hourlyPm10) &&
            rec.hourlyPm10.length >= 24 &&
            Array.isArray(rec.hourlyAod) &&
            rec.hourlyAod.length >= 24 &&
            Array.isArray(rec.hourlyDiffuse) &&
            rec.hourlyDiffuse.length >= 24 &&
            Array.isArray(rec.hourlyDni) &&
            rec.hourlyDni.length >= 24 &&
            Array.isArray(rec.hourlyVisibilityM) &&
            rec.hourlyVisibilityM.length >= 24 &&
            Array.isArray(rec.hourlyGti) &&
            rec.hourlyGti.length >= 24 &&
            Array.isArray(rec.hourlyGtiInstant) &&
            rec.hourlyGtiInstant.length >= 24;
          if (!enriched) {
            missingCount += 1;
          }
          cursor = shiftYmdUtc(cursor, 1);
          safety += 1;
        }
      }

      if (!force && missingCount === 0) {
        historicalBackfillDone.set(flightCoordKey, {
          istYmd: currentIstYmd,
          verifiedAt: Date.now(),
        });
        return { status: "complete_on_disk", fetched: false, missingCount: 0 };
      }

      const backfillForecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${OPEN_METEO_FORECAST_HOURLY}&minutely_15=global_tilted_irradiance,global_tilted_irradiance_instant&daily=${OPEN_METEO_DAILY_FIELDS}&tilt=${safeTilt}&azimuth=${safeAzimuth}&timezone=Asia%2FKolkata&past_days=31&forecast_days=1&models=best_match,gfs_seamless,ecmwf_ifs025`;
      const backfillAqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,dust,aerosol_optical_depth,us_aqi&timezone=Asia%2FKolkata&past_days=31&forecast_days=1`;

      const [weatherRes, aqiRes] = await Promise.all([
        httpGetJson(backfillForecastUrl),
        httpGetJson(backfillAqiUrl).catch((e) => {
          console.warn("[AQI Backfill] Optional AQ backfill failed:", e.message);
          return null;
        }),
      ]);

      const extracted = indexAndExtractAtmosphereDays(
        weatherRes,
        aqiRes,
        lat,
        lon,
        currentIstYmd,
        true,
        safeAzimuth
      );
      historicalBackfillDone.set(flightCoordKey, {
        istYmd: currentIstYmd,
        verifiedAt: Date.now(),
      });
      return {
        status: "backfilled_31d",
        fetched: true,
        missingCount,
        daysIndexed: Object.keys(extracted.dailyAtmosphere).length,
      };
    } catch (err) {
      console.warn("[Weather Backfill] Failed:", err.message);
      return { status: "error", fetched: false, error: err.message };
    } finally {
      inFlightBackfills.delete(flightCoordKey);
    }
  })();

  inFlightBackfills.set(flightCoordKey, work);
  return work;
}

/**
 * Retrieve Open-Meteo solar + meteorological series for a single IST calendar date,
 * serving live cache for today or disk/forecast/archive fallback for historical dates.
 */
async function fetchOpenMeteoDay(
  lat,
  lon,
  dateYmd,
  force = false,
  tiltArg = null,
  azimuthArg = null
) {
  const istNow = getISTDateParts();
  const safeYmd = /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd || "")) ? dateYmd : istNow.ymd;
  const isToday = safeYmd === istNow.ymd;
  const isPastDate = safeYmd < istNow.ymd;
  const settings = loadSettings();
  const safeTilt = parseFloat(
    clampNumber(tiltArg ?? settings.arrayTiltDeg, 0, 60, 26.5).toFixed(1)
  );
  const safeAzimuth = Math.round(
    clampNumber(azimuthArg ?? settings.arrayAzimuthDeg, -180, 180, 0)
  );

  if (isToday) {
    const liveWeather = await fetchOpenMeteoWeather(lat, lon, {
      force,
      tilt: safeTilt,
      azimuth: safeAzimuth,
      dayTtlMin: settings.weatherCacheTtlMin,
    });
    if (!liveWeather || !liveWeather.daily) return null;
    const wCode = liveWeather.current?.weather_code ?? liveWeather.daily?.weather_code?.[0] ?? 0;
    const cloudCover = liveWeather.current?.cloud_cover ?? 0;
    const { conditionText, conditionType } = mapWmoCondition(wCode, true, cloudCover);
    const sunSec = liveWeather.daily?.sunshine_duration?.[0] || 0;
    const todayAtm = liveWeather.dailyAtmosphere?.[safeYmd] || {};
    return {
      dateYmd: safeYmd,
      sunrise: liveWeather.daily?.sunrise?.[0] || `${safeYmd}T06:24`,
      sunset: liveWeather.daily?.sunset?.[0] || `${safeYmd}T17:20`,
      radiationMjM2: liveWeather.daily?.shortwave_radiation_sum?.[0] ?? 15.33,
      sunshineDurationHours: sunSec > 0 ? parseFloat((sunSec / 3600).toFixed(1)) : 7.4,
      weatherCode: wCode,
      condition: conditionText,
      conditionType,
      tempMax: liveWeather.daily?.temperature_2m_max?.[0] ?? null,
      tempMin: liveWeather.daily?.temperature_2m_min?.[0] ?? null,
      hourlyGti: Array.isArray(liveWeather.hourly?.global_tilted_irradiance)
        ? liveWeather.hourly.global_tilted_irradiance.slice(0, 24)
        : [],
      hourlyGtiInstant: Array.isArray(liveWeather.hourly?.global_tilted_irradiance_instant)
        ? liveWeather.hourly.global_tilted_irradiance_instant.slice(0, 24)
        : Array.isArray(todayAtm.hourlyGtiInstant)
          ? todayAtm.hourlyGtiInstant
          : [],
      minutely15Gti: Array.isArray(liveWeather.minutely15?.global_tilted_irradiance)
        ? liveWeather.minutely15.global_tilted_irradiance.slice(0, 96)
        : [],
      minutely15GtiInstant: Array.isArray(liveWeather.minutely15?.global_tilted_irradiance_instant)
        ? liveWeather.minutely15.global_tilted_irradiance_instant.slice(0, 96)
        : Array.isArray(todayAtm.minutely15GtiInstant)
          ? todayAtm.minutely15GtiInstant
          : [],
      hourlyTempC: Array.isArray(liveWeather.hourly?.temperature_2m)
        ? liveWeather.hourly.temperature_2m.slice(0, 24)
        : todayAtm.hourlyTempC || [],
      hourlyWindKmh: Array.isArray(liveWeather.hourly?.wind_speed_10m)
        ? liveWeather.hourly.wind_speed_10m.slice(0, 24)
        : todayAtm.hourlyWindKmh || [],
      hourlyDiffuse: Array.isArray(liveWeather.hourly?.diffuse_radiation)
        ? liveWeather.hourly.diffuse_radiation.slice(0, 24)
        : todayAtm.hourlyDiffuse || [],
      hourlyDni: Array.isArray(liveWeather.hourly?.direct_normal_irradiance)
        ? liveWeather.hourly.direct_normal_irradiance.slice(0, 24)
        : todayAtm.hourlyDni || [],
      hourlyCloudCover: Array.isArray(liveWeather.hourly?.cloud_cover)
        ? liveWeather.hourly.cloud_cover.slice(0, 24)
        : todayAtm.hourlyCloudCover || [],
      gtiFetchedAzimuthDeg: liveWeather.azimuthDegrees ?? safeAzimuth,
      hourlyPm10: Array.isArray(todayAtm.hourlyPm10) ? todayAtm.hourlyPm10 : [],
      hourlyAod: Array.isArray(todayAtm.hourlyAod) ? todayAtm.hourlyAod : [],
      source: "open_meteo_live",
    };
  }

  const latKey = Number(lat).toFixed(4);
  const lonKey = Number(lon).toFixed(4);
  const baseAqiCacheKey = `${latKey}_${lonKey}_${safeYmd}`;
  const isDefaultGeom = Math.abs(safeTilt - 26.5) < 0.05 && safeAzimuth === 0;
  const cacheKey = isDefaultGeom
    ? baseAqiCacheKey
    : `${latKey}_${lonKey}_t${safeTilt}_a${safeAzimuth}_${safeYmd}`;
  const diskCache = loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {});
  const targetMs = parseYmdToUtcMs(safeYmd);
  const todayMs = parseYmdToUtcMs(istNow.ymd);
  const diffDays =
    Number.isFinite(targetMs) && Number.isFinite(todayMs)
      ? Math.round((todayMs - targetMs) / 86400000)
      : 0;
  const useArchive = diffDays > 88;
  const baseAqiEntry = diskCache[baseAqiCacheKey] || null;
  if (
    !force &&
    isPastDate &&
    diskCache[cacheKey] &&
    (useArchive ||
      (diskCache[cacheKey].ensembleVersion === 1 &&
        Array.isArray(diskCache[cacheKey].hourlyGtiInstant) &&
        diskCache[cacheKey].hourlyGtiInstant.length >= 24 &&
        Array.isArray(diskCache[cacheKey].hourlyDiffuse) &&
        diskCache[cacheKey].hourlyDiffuse.length >= 24 &&
        Array.isArray(diskCache[cacheKey].hourlyDni) &&
        diskCache[cacheKey].hourlyDni.length >= 24 &&
        Array.isArray(diskCache[cacheKey].hourlyTempC) &&
        diskCache[cacheKey].hourlyTempC.length >= 24))
  ) {
    const entry = diskCache[cacheKey];
    return {
      ...entry,
      hourlyPm10:
        Array.isArray(entry.hourlyPm10) && entry.hourlyPm10.length >= 24
          ? entry.hourlyPm10
          : baseAqiEntry?.hourlyPm10 || [],
      hourlyAod:
        Array.isArray(entry.hourlyAod) && entry.hourlyAod.length >= 24
          ? entry.hourlyAod
          : baseAqiEntry?.hourlyAod || [],
      cached: true,
    };
  }

  const weatherCache = getWeatherCache();
  const cachedPast =
    !force &&
    weatherCache.data &&
    Math.abs(Number(weatherCache.lat) - Number(lat)) < 0.001 &&
    Math.abs(Number(weatherCache.lon) - Number(lon)) < 0.001 &&
    Math.abs(Number(weatherCache.tilt ?? 26.5) - safeTilt) < 0.05 &&
    Number(weatherCache.azimuth ?? 0) === safeAzimuth
      ? weatherCache.data.pastDays?.[safeYmd]
      : null;

  if (
    cachedPast &&
    cachedPast.ensembleVersion === 1 &&
    Array.isArray(cachedPast.hourlyGti) &&
    cachedPast.hourlyGti.length >= 24 &&
    Array.isArray(cachedPast.hourlyDiffuse) &&
    cachedPast.hourlyDiffuse.length >= 24 &&
    Array.isArray(cachedPast.hourlyDni) &&
    cachedPast.hourlyDni.length >= 24 &&
    cachedPast.weatherCode !== undefined
  ) {
    const { conditionText, conditionType } = mapWmoCondition(cachedPast.weatherCode || 0, true, 0);
    const normalized = {
      dateYmd: safeYmd,
      sunrise: cachedPast.sunrise,
      sunset: cachedPast.sunset,
      radiationMjM2: cachedPast.radiationMjM2,
      sunshineDurationHours: cachedPast.sunshineDurationHours ?? 7.0,
      weatherCode: cachedPast.weatherCode ?? 0,
      condition: conditionText,
      conditionType,
      tempMax: cachedPast.tempMax ?? null,
      tempMin: cachedPast.tempMin ?? null,
      hourlyGti: cachedPast.hourlyGti,
      hourlyGtiInstant: cachedPast.hourlyGtiInstant || [],
      minutely15Gti: cachedPast.minutely15Gti || [],
      minutely15GtiInstant: cachedPast.minutely15GtiInstant || [],
      hourlyTempC: cachedPast.hourlyTempC || [],
      hourlyWindKmh: cachedPast.hourlyWindKmh || [],
      hourlyDiffuse: cachedPast.hourlyDiffuse || [],
      hourlyDni: cachedPast.hourlyDni || [],
      hourlyCloudCover: cachedPast.hourlyCloudCover || [],
      gtiFetchedAzimuthDeg: cachedPast.gtiFetchedAzimuthDeg ?? safeAzimuth,
      ensembleVersion: cachedPast.ensembleVersion ?? 1,
      hourlyPm10:
        Array.isArray(cachedPast.hourlyPm10) && cachedPast.hourlyPm10.length >= 24
          ? cachedPast.hourlyPm10
          : baseAqiEntry?.hourlyPm10 || [],
      hourlyAod:
        Array.isArray(cachedPast.hourlyAod) && cachedPast.hourlyAod.length >= 24
          ? cachedPast.hourlyAod
          : baseAqiEntry?.hourlyAod || [],
      source: "open_meteo_past_window",
    };
    if (isPastDate) {
      diskCache[cacheKey] = { ...(diskCache[cacheKey] || {}), ...normalized };
      saveJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, diskCache);
    }
    return normalized;
  }

  const baseUrl = useArchive
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";

  const minutelyParam = useArchive
    ? ""
    : "&minutely_15=global_tilted_irradiance,global_tilted_irradiance_instant";
  const modelsParam = useArchive ? "" : "&models=best_match,gfs_seamless,ecmwf_ifs025";
  const hourlyFields = useArchive
    ? "global_tilted_irradiance,direct_normal_irradiance,diffuse_radiation,shortwave_radiation_clear_sky,cloud_cover,temperature_2m,wind_speed_10m"
    : "global_tilted_irradiance,global_tilted_irradiance_instant,direct_normal_irradiance,diffuse_radiation,shortwave_radiation_clear_sky,cloud_cover,temperature_2m,wind_speed_10m";
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${safeYmd}&end_date=${safeYmd}${minutelyParam}&hourly=${hourlyFields}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration,shortwave_radiation_sum&tilt=${safeTilt}&azimuth=${safeAzimuth}&timezone=Asia%2FKolkata${modelsParam}`;

  if (!force && inFlightDayWeatherFetches.has(cacheKey)) {
    return inFlightDayWeatherFetches.get(cacheKey);
  }

  const dayTask = (async () => {
    const rawDayRes = await httpGetJson(url);
    const dayRes = useArchive ? rawDayRes : normalizeEnsembleOpenMeteoResponse(rawDayRes);
    if (!dayRes || !dayRes.daily || !Array.isArray(dayRes.daily.time) || dayRes.daily.time.length === 0) {
      return diskCache[cacheKey] || null;
    }

    const wCode = dayRes.daily.weather_code?.[0] ?? 0;
    const sunSec = dayRes.daily.sunshine_duration?.[0] || 0;
    const sunHours = sunSec > 0 ? parseFloat((sunSec / 3600).toFixed(1)) : null;
    const radMj = dayRes.daily.shortwave_radiation_sum?.[0] ?? null;
    const daytimeClouds = Array.isArray(dayRes.hourly?.cloud_cover)
      ? dayRes.hourly.cloud_cover.slice(7, 17).filter((v) => typeof v === "number")
      : [];
    const meanCloud =
      daytimeClouds.length > 0
        ? daytimeClouds.reduce((s, v) => s + v, 0) / daytimeClouds.length
        : 0;

    let { conditionText, conditionType } = mapWmoCondition(wCode, true, meanCloud);
    if (wCode < 51 && sunHours !== null && radMj !== null) {
      if (sunHours >= 8.5 && radMj >= 14.5) {
        if (wCode === 45 || wCode === 48) {
          conditionText = "Smoky Haze";
          conditionType = "hazy";
        } else if (meanCloud > 35) {
          conditionText = "High Cirrus · Sunny";
          conditionType = "partly_cloudy";
        } else {
          conditionText = "Clear Sky";
          conditionType = "sunny";
        }
      } else if (sunHours < 4.5 || radMj < 9.5) {
        conditionText = "Mostly Cloudy";
        conditionType = "cloudy";
      }
    }

    const latestDisk = loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {});
    const existingEntry = latestDisk[cacheKey] || latestDisk[baseAqiCacheKey] || {};
    const result = {
      ...(isDefaultGeom ? existingEntry : {}),
      dateYmd: safeYmd,
      sunrise: dayRes.daily.sunrise?.[0] || `${safeYmd}T06:24`,
      sunset: dayRes.daily.sunset?.[0] || `${safeYmd}T17:20`,
      radiationMjM2: radMj,
      sunshineDurationHours: sunHours,
      weatherCode: wCode,
      condition: conditionText,
      conditionType,
      tempMax: dayRes.daily.temperature_2m_max?.[0] ?? null,
      tempMin: dayRes.daily.temperature_2m_min?.[0] ?? null,
      hourlyGti: Array.isArray(dayRes.hourly?.global_tilted_irradiance)
        ? dayRes.hourly.global_tilted_irradiance.slice(0, 24)
        : [],
      hourlyGtiInstant: Array.isArray(dayRes.hourly?.global_tilted_irradiance_instant)
        ? dayRes.hourly.global_tilted_irradiance_instant.slice(0, 24)
        : existingEntry.hourlyGtiInstant || [],
      minutely15Gti: Array.isArray(dayRes.minutely_15?.global_tilted_irradiance)
        ? dayRes.minutely_15.global_tilted_irradiance.slice(0, 96)
        : [],
      minutely15GtiInstant: Array.isArray(dayRes.minutely_15?.global_tilted_irradiance_instant)
        ? dayRes.minutely_15.global_tilted_irradiance_instant.slice(0, 96)
        : existingEntry.minutely15GtiInstant || [],
      hourlyTempC: Array.isArray(dayRes.hourly?.temperature_2m)
        ? dayRes.hourly.temperature_2m.slice(0, 24)
        : existingEntry.hourlyTempC || [],
      hourlyWindKmh: Array.isArray(dayRes.hourly?.wind_speed_10m)
        ? dayRes.hourly.wind_speed_10m.slice(0, 24)
        : existingEntry.hourlyWindKmh || [],
      hourlyDiffuse: Array.isArray(dayRes.hourly?.diffuse_radiation)
        ? dayRes.hourly.diffuse_radiation.slice(0, 24)
        : existingEntry.hourlyDiffuse || [],
      hourlyDni: Array.isArray(dayRes.hourly?.direct_normal_irradiance)
        ? dayRes.hourly.direct_normal_irradiance.slice(0, 24)
        : existingEntry.hourlyDni || [],
      hourlyCloudCover: Array.isArray(dayRes.hourly?.cloud_cover)
        ? dayRes.hourly.cloud_cover.slice(0, 24)
        : existingEntry.hourlyCloudCover || [],
      gtiFetchedAzimuthDeg: safeAzimuth,
      ensembleVersion: useArchive ? (existingEntry.ensembleVersion ?? 0) : 1,
      hourlyPm10: Array.isArray(existingEntry.hourlyPm10) ? existingEntry.hourlyPm10 : [],
      hourlyAod: Array.isArray(existingEntry.hourlyAod) ? existingEntry.hourlyAod : [],
      source: useArchive ? "open_meteo_archive" : "open_meteo_forecast",
    };

    if (isPastDate && (result.radiationMjM2 !== null || result.hourlyGti.length >= 24)) {
      latestDisk[cacheKey] = result;
      saveJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, latestDisk);
    }
    return result;
  })().finally(() => {
    inFlightDayWeatherFetches.delete(cacheKey);
  });

  inFlightDayWeatherFetches.set(cacheKey, dayTask);
  return dayTask;
}

/**
 * Fetch or serve the cached 365-day seasonal archive monthly baseline for the site's
 * configured tilt/azimuth and physics coefficients.
 */
async function fetchOrGetAnnualMonthlyBaseline(
  lat,
  lon,
  force = false,
  tiltArg = null,
  azimuthArg = null,
  physicsOverrides = null
) {
  const settings = loadSettings();
  const safeLat = Number.isFinite(Number(lat))
    ? Number(lat)
    : solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT;
  const safeLon = Number.isFinite(Number(lon))
    ? Number(lon)
    : solarTruth.SOLAR_CONSTANTS.DEFAULT_LON;
  const safeTilt = parseFloat(
    clampNumber(tiltArg ?? settings.arrayTiltDeg, 0, 60, 26.5).toFixed(1)
  );
  const safeAzimuth = Math.round(
    clampNumber(azimuthArg ?? settings.arrayAzimuthDeg, -180, 180, 0)
  );
  const phys = buildPhysicsArgsFromSettings(settings);
  const effPhysics = {
    thermalCoeffPerC: clampNumber(
      physicsOverrides?.thermalCoeffPerC ?? phys.thermalCoeffPerC,
      0.001,
      0.008,
      0.0038
    ),
    dcCleanFactor: clampNumber(
      physicsOverrides?.dcCleanFactor ?? phys.dcCleanFactor,
      0.75,
      1.0,
      0.95
    ),
    basePrAtStc: clampNumber(physicsOverrides?.basePrAtStc ?? phys.basePrAtStc, 0.65, 0.96, 0.85),
    inverterEfficiency: clampNumber(
      physicsOverrides?.inverterEfficiency ?? phys.inverterEfficiency,
      0.8,
      0.995,
      0.972
    ),
    mountingType:
      (physicsOverrides?.mountingType ?? phys.mountingType) === "flush_rcc"
        ? "flush_rcc"
        : "open_rack",
    roofAlbedo: clampNumber(physicsOverrides?.roofAlbedo ?? phys.roofAlbedo, 0.05, 0.8, 0.2),
    dcCapacityKwp: clampNumber(
      physicsOverrides?.dcCapacityKwp ?? phys.dcCapacityKwp,
      0.1,
      1000,
      3.0
    ),
    acInverterCapacityKw: clampNumber(
      physicsOverrides?.acInverterCapacityKw ?? phys.acInverterCapacityKw,
      0.1,
      1000,
      3.0
    ),
  };
  const latKey = safeLat.toFixed(4);
  const lonKey = safeLon.toFixed(4);
  const cacheKey = `annual_baseline_v3_${latKey}_${lonKey}_t${safeTilt}_a${safeAzimuth}`;

  const diskCache = loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {});
  const cachedEntry = diskCache[cacheKey];
  if (
    !force &&
    cachedEntry &&
    Array.isArray(cachedEntry.months) &&
    cachedEntry.months.length === 12 &&
    Number.isFinite(cachedEntry.fetchedAtMs) &&
    Date.now() - cachedEntry.fetchedAtMs < ANNUAL_BASELINE_TTL_MS &&
    Math.abs((cachedEntry.thermalCoeffPerC ?? 0.0038) - effPhysics.thermalCoeffPerC) < 0.00001 &&
    Math.abs((cachedEntry.dcCleanFactor ?? 0.95) - effPhysics.dcCleanFactor) < 0.0005 &&
    (cachedEntry.mountingType || "open_rack") === effPhysics.mountingType &&
    Math.abs((cachedEntry.dcCapacityKwp ?? 3.0) - effPhysics.dcCapacityKwp) < 0.05 &&
    Math.abs((cachedEntry.acInverterCapacityKw ?? 3.0) - effPhysics.acInverterCapacityKw) < 0.05
  ) {
    return cachedEntry;
  }

  if (!force && inFlightAnnualBaselines.has(cacheKey)) {
    return inFlightAnnualBaselines.get(cacheKey);
  }

  const istNow = getISTDateParts();
  const endYmd = shiftISTYmd(-7).ymd;
  const startYmd = shiftISTYmd(-371).ymd;

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${safeLat}&longitude=${safeLon}&start_date=${startYmd}&end_date=${endYmd}&daily=shortwave_radiation_sum,temperature_2m_max,temperature_2m_min&hourly=global_tilted_irradiance,shortwave_radiation,temperature_2m&tilt=${safeTilt}&azimuth=${safeAzimuth}&timezone=Asia%2FKolkata`;

  const task = (async () => {
    try {
      const archiveRes = await httpGetJson(url);
      if (
        !archiveRes ||
        !archiveRes.daily ||
        !Array.isArray(archiveRes.daily.time) ||
        archiveRes.daily.time.length < 300
      ) {
        return cachedEntry || null;
      }

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const buckets = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        shortMonth: monthNames[i],
        daysSampled: 0,
        radMjSum: 0,
        tempMaxSum: 0,
        tempMaxCount: 0,
        tempMinSum: 0,
        tempMinCount: 0,
        gtiKwhM2Sum: 0,
        ghiKwhM2Sum: 0,
        kwhPerKwpSum: 0,
      }));

      const dTimes = archiveRes.daily.time || [];
      const dRad = archiveRes.daily.shortwave_radiation_sum || [];
      const dTmax = archiveRes.daily.temperature_2m_max || [];
      const dTmin = archiveRes.daily.temperature_2m_min || [];
      for (let i = 0; i < dTimes.length; i++) {
        const mo = parseInt(String(dTimes[i]).slice(5, 7), 10);
        if (!Number.isFinite(mo) || mo < 1 || mo > 12) continue;
        const b = buckets[mo - 1];
        b.daysSampled += 1;
        b.radMjSum += Number(dRad[i]) || 0;
        if (typeof dTmax[i] === "number") {
          b.tempMaxSum += dTmax[i];
          b.tempMaxCount += 1;
        }
        if (typeof dTmin[i] === "number") {
          b.tempMinSum += dTmin[i];
          b.tempMinCount += 1;
        }
      }

      const hTimes = archiveRes.hourly?.time || [];
      const hGti = archiveRes.hourly?.global_tilted_irradiance || [];
      const hGhi = archiveRes.hourly?.shortwave_radiation || [];
      const hTemp = archiveRes.hourly?.temperature_2m || [];
      for (let h = 0; h < hTimes.length; h++) {
        const mo = parseInt(String(hTimes[h]).slice(5, 7), 10);
        if (!Number.isFinite(mo) || mo < 1 || mo > 12) continue;
        const b = buckets[mo - 1];
        const gti = Math.max(0, Number(hGti[h]) || 0);
        const ghi = Math.max(0, Number(hGhi[h]) || 0);
        const amb = typeof hTemp[h] === "number" ? hTemp[h] : 25;
        b.gtiKwhM2Sum += gti / 1000;
        b.ghiKwhM2Sum += ghi / 1000;
        if (gti > 5) {
          const prRes = solarTruth.computeEffectiveSolarPr({
            ambientTempC: amb,
            windSpeedKmh: 6,
            gtiWm2: gti,
            surfaceLossPct: 0,
            ...effPhysics,
          });
          b.kwhPerKwpSum += (gti / 1000) * prRes.pr;
        }
      }

      const stdDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let annualKwhPerKwp = 0;
      const months = buckets.map((b, idx) => {
        const denom = Math.max(1, b.daysSampled);
        const avgDailyRadMj = +(b.radMjSum / denom).toFixed(2);
        const avgDailyGtiKwhM2 = +(b.gtiKwhM2Sum / denom).toFixed(3);
        const avgDailyGhiKwhM2 = b.ghiKwhM2Sum / denom;
        const rTilt =
          avgDailyGhiKwhM2 > 0.2 ? +(avgDailyGtiKwhM2 / avgDailyGhiKwhM2).toFixed(3) : 1.0;
        const avgDailyKwhPerKwp = +(b.kwhPerKwpSum / denom).toFixed(3);
        annualKwhPerKwp += avgDailyKwhPerKwp * stdDays[idx];
        return {
          month: b.month,
          shortMonth: b.shortMonth,
          daysSampled: b.daysSampled,
          avgDailyRadMj,
          avgDailyGtiKwhM2,
          rTilt,
          avgTempMaxC: b.tempMaxCount > 0 ? +(b.tempMaxSum / b.tempMaxCount).toFixed(1) : null,
          avgTempMinC: b.tempMinCount > 0 ? +(b.tempMinSum / b.tempMinCount).toFixed(1) : null,
          avgDailyKwhPerKwp,
        };
      });

      const entry = {
        source: "open_meteo_365d_archive",
        startYmd,
        endYmd,
        fetchedAtYmd: istNow.ymd,
        fetchedAtMs: Date.now(),
        lat: safeLat,
        lon: safeLon,
        tiltDegrees: safeTilt,
        azimuthDegrees: safeAzimuth,
        thermalCoeffPerC: effPhysics.thermalCoeffPerC,
        dcCleanFactor: effPhysics.dcCleanFactor,
        mountingType: effPhysics.mountingType,
        dcCapacityKwp: effPhysics.dcCapacityKwp,
        acInverterCapacityKw: effPhysics.acInverterCapacityKw,
        basePrAtStc: effPhysics.basePrAtStc,
        inverterEfficiency: effPhysics.inverterEfficiency,
        annualKwhPerKwp: +annualKwhPerKwp.toFixed(1),
        months,
      };

      const latestDisk = loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {});
      latestDisk[cacheKey] = entry;
      saveJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, latestDisk);
      return entry;
    } catch (err) {
      console.warn("[Annual Archive Baseline] Fetch failed:", err.message);
      return cachedEntry || null;
    } finally {
      inFlightAnnualBaselines.delete(cacheKey);
    }
  })();

  inFlightAnnualBaselines.set(cacheKey, task);
  return task;
}

module.exports = {
  indexAndExtractAtmosphereDays,
  ensureHistoricalAtmosphereBackfill,
  fetchOpenMeteoDay,
  fetchOrGetAnnualMonthlyBaseline,
};
