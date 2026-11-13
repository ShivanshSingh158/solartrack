const https = require("https");
const {
  WEATHER_HISTORY_CACHE_FILE,
  NIGHT_WEATHER_CACHE_TTL_MS,
} = require("../config/env");
const { clampNumber, loadSettings } = require("../config/settingsStore");
const { loadJsonFileSafe, saveJsonFileSafe } = require("../storage/jsonFileStore");
const {
  inFlightWeatherFetches,
  getWeatherCache,
  setWeatherCache,
} = require("../storage/memoryCaches");
const { getISTDateParts } = require("../time/istClock");

const OPEN_METEO_ENSEMBLE_MODELS = [
  { id: "best_match", weight: 0.55 },
  { id: "gfs_seamless", weight: 0.25 },
  { id: "ecmwf_ifs025", weight: 0.20 },
];

const OPEN_METEO_WEIGHTED_KEYS = new Set([
  "global_tilted_irradiance",
  "global_tilted_irradiance_instant",
  "direct_normal_irradiance",
  "diffuse_radiation",
  "shortwave_radiation_clear_sky",
  "cloud_cover",
  "temperature_2m",
  "wind_speed_10m",
  "shortwave_radiation_sum",
]);

const OPEN_METEO_FORECAST_HOURLY =
  "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,rain,weather_code,cloud_cover,visibility,wind_speed_10m,global_tilted_irradiance,global_tilted_irradiance_instant,shortwave_radiation_clear_sky,direct_normal_irradiance,diffuse_radiation";

const OPEN_METEO_DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration,shortwave_radiation_sum,precipitation_sum,rain_sum,precipitation_probability_max";

const WMO_WEATHER_MAP = {
  0: { nameDay: "Clear Sky", nameNight: "Clear Night", category: "sunny" },
  1: { nameDay: "Mainly Clear", nameNight: "Mainly Clear Night", category: "sunny" },
  2: { nameDay: "Partly Cloudy", nameNight: "Partly Cloudy Night", category: "partly_cloudy" },
  3: { nameDay: "Overcast", nameNight: "Overcast Night", category: "cloudy" },
  45: { nameDay: "Smoky Haze", nameNight: "Hazy Night", category: "hazy" },
  48: { nameDay: "Depositing Rime Fog", nameNight: "Dense Fog Night", category: "hazy" },
  51: { nameDay: "Light Drizzle", nameNight: "Light Drizzle Night", category: "rainy" },
  53: { nameDay: "Moderate Drizzle", nameNight: "Moderate Drizzle Night", category: "rainy" },
  55: { nameDay: "Dense Drizzle", nameNight: "Dense Drizzle Night", category: "rainy" },
  56: { nameDay: "Light Freezing Drizzle", nameNight: "Light Freezing Drizzle", category: "rainy" },
  57: { nameDay: "Dense Freezing Drizzle", nameNight: "Dense Freezing Drizzle", category: "rainy" },
  61: { nameDay: "Slight Rain", nameNight: "Slight Rain Night", category: "rainy" },
  63: { nameDay: "Moderate Rain", nameNight: "Moderate Rain Night", category: "rainy" },
  65: { nameDay: "Heavy Rain (Monsoon)", nameNight: "Heavy Rain Night", category: "rainy" },
  66: { nameDay: "Light Freezing Rain", nameNight: "Light Freezing Rain", category: "rainy" },
  67: { nameDay: "Heavy Freezing Rain", nameNight: "Heavy Freezing Rain", category: "rainy" },
  71: { nameDay: "Slight Snow Fall", nameNight: "Slight Snow Fall", category: "snow" },
  73: { nameDay: "Moderate Snow Fall", nameNight: "Moderate Snow Fall", category: "snow" },
  75: { nameDay: "Heavy Snow Fall", nameNight: "Heavy Snow Fall", category: "snow" },
  77: { nameDay: "Snow Grains", nameNight: "Snow Grains", category: "snow" },
  80: { nameDay: "Passing Showers", nameNight: "Passing Showers Night", category: "rainy" },
  81: { nameDay: "Scattered Showers", nameNight: "Scattered Showers Night", category: "rainy" },
  82: { nameDay: "Torrential Downpour", nameNight: "Violent Showers Night", category: "rainy" },
  85: { nameDay: "Slight Snow Showers", nameNight: "Slight Snow Showers", category: "snow" },
  86: { nameDay: "Heavy Snow Showers", nameNight: "Heavy Snow Showers", category: "snow" },
  95: { nameDay: "Thunderstorm", nameNight: "Thunderstorm Night", category: "thunderstorm" },
  96: { nameDay: "Thunderstorm with Hail", nameNight: "Thunderstorm with Hail", category: "thunderstorm" },
  99: { nameDay: "Severe Hailstorm", nameNight: "Severe Hailstorm", category: "thunderstorm" },
};

/**
 * Translate a WMO weather code, day/night flag, and cloud fraction into dashboard condition text/type.
 */
function mapWmoCondition(wCode = 0, isDay = true, cloudCover = 0) {
  const mapped = WMO_WEATHER_MAP[wCode] || {
    nameDay: "Clear Sky",
    nameNight: "Clear Night",
    category: "sunny",
  };
  let conditionText = isDay ? mapped.nameDay : mapped.nameNight;
  let conditionType = !isDay ? "night" : mapped.category;

  if (!isDay && cloudCover > 55) {
    conditionText = "Cloudy Night";
  } else if (isDay && wCode === 0 && cloudCover > 25 && cloudCover <= 55) {
    conditionText = "Hazy Sunshine";
    conditionType = "hazy";
  } else if (isDay && cloudCover > 60 && wCode < 50) {
    conditionText = "Overcast";
    conditionType = "cloudy";
  }
  return { conditionText, conditionType };
}

/**
 * Compute active weather cache TTL depending on daytime vs overnight IST window.
 */
function getWeatherCacheTtlMs(istParts = getISTDateParts(), dayTtlMin = 12) {
  const isDayWindow =
    istParts.minutesSinceMidnight >= 270 && istParts.minutesSinceMidnight <= 1140;
  const clampedMin = Math.min(60, Math.max(5, Number(dayTtlMin) || 12));
  return isDayWindow ? clampedMin * 60 * 1000 : NIGHT_WEATHER_CACHE_TTL_MS;
}

/**
 * Fetch and parse JSON over HTTPS with timeout and 1 automatic retry.
 */
async function httpGetJson(url, retries = 1) {
  const attempt = () =>
    new Promise((resolve) => {
      const req = https
        .get(url, { timeout: 8500 }, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        })
        .on("timeout", () => {
          req.destroy(new Error("Request timeout"));
        })
        .on("error", (err) => {
          console.error("[HTTP API] Error for " + url + ":", err.message);
          resolve(null);
        });
    });

  const first = await attempt();
  if (first !== null || retries <= 0) return first;
  await new Promise((r) => setTimeout(r, 350));
  return attempt();
}

/**
 * Blend multi-model Open-Meteo section arrays (`best_match`, `gfs_seamless`, `ecmwf_ifs025`).
 */
function normalizeEnsembleSection(section) {
  if (!section || typeof section !== "object" || !Array.isArray(section.time)) return section;
  const suffixMap = new Map();
  let hasMultiModel = false;
  for (const key of Object.keys(section)) {
    if (key === "time") continue;
    for (const m of OPEN_METEO_ENSEMBLE_MODELS) {
      const sfx = `_${m.id}`;
      if (key.endsWith(sfx)) {
        const base = key.slice(0, -sfx.length);
        if (!suffixMap.has(base)) suffixMap.set(base, {});
        suffixMap.get(base)[m.id] = section[key];
        hasMultiModel = true;
        break;
      }
    }
  }
  if (!hasMultiModel) return section;

  const out = { time: section.time };
  const len = section.time.length;
  for (const [base, modelArrays] of suffixMap.entries()) {
    const primaryArr =
      modelArrays.best_match || modelArrays.gfs_seamless || modelArrays.ecmwf_ifs025 || section[base];
    if (!OPEN_METEO_WEIGHTED_KEYS.has(base)) {
      if (Array.isArray(primaryArr)) {
        out[base] = primaryArr.map((v, idx) => {
          if (v !== null && v !== undefined) return v;
          for (const m of OPEN_METEO_ENSEMBLE_MODELS) {
            const alt = modelArrays[m.id]?.[idx];
            if (alt !== null && alt !== undefined) return alt;
          }
          return v;
        });
      }
      continue;
    }

    const blended = new Array(len);
    for (let i = 0; i < len; i++) {
      let weightedSum = 0;
      let weightTotal = 0;
      for (const m of OPEN_METEO_ENSEMBLE_MODELS) {
        const val = modelArrays[m.id]?.[i];
        if (typeof val === "number" && Number.isFinite(val)) {
          weightedSum += val * m.weight;
          weightTotal += m.weight;
        }
      }
      blended[i] =
        weightTotal > 0
          ? parseFloat(
              (weightedSum / weightTotal).toFixed(
                base === "temperature_2m" || base === "wind_speed_10m" ? 2 : 1
              )
            )
          : (primaryArr?.[i] ?? 0);
    }
    out[base] = blended;
  }

  for (const key of Object.keys(section)) {
    if (key === "time" || out[key] !== undefined) continue;
    const isSuffixed = OPEN_METEO_ENSEMBLE_MODELS.some((m) => key.endsWith(`_${m.id}`));
    if (!isSuffixed) out[key] = section[key];
  }
  return out;
}

/**
 * Normalize hourly, minutely_15, and daily multi-model Open-Meteo response sections.
 */
function normalizeEnsembleOpenMeteoResponse(weatherRes) {
  if (!weatherRes || typeof weatherRes !== "object") return weatherRes;
  return {
    ...weatherRes,
    hourly: normalizeEnsembleSection(weatherRes.hourly),
    minutely_15: normalizeEnsembleSection(weatherRes.minutely_15),
    daily: normalizeEnsembleSection(weatherRes.daily),
  };
}

/**
 * Date-index forecast + air quality responses into per-day atmosphere records, optionally
 * persisting past + today days into `weather_history_cache.json`.
 */
function indexAndExtractAtmosphereDays(
  rawWeatherRes,
  aqiRes,
  lat,
  lon,
  currentIstYmd,
  persistPastAndToday = true,
  fetchedAzimuthDeg = 0
) {
  const weatherRes = normalizeEnsembleOpenMeteoResponse(rawWeatherRes);
  const aqiByYmd = new Map();
  if (Array.isArray(aqiRes?.hourly?.time)) {
    const tArr = aqiRes.hourly.time;
    const pm10Arr = aqiRes.hourly.pm10 || [];
    const pm25Arr = aqiRes.hourly.pm2_5 || [];
    const dustArr = aqiRes.hourly.dust || [];
    const aodArr = aqiRes.hourly.aerosol_optical_depth || [];
    const uqArr = aqiRes.hourly.us_aqi || [];
    for (let j = 0; j < tArr.length; j++) {
      const ts = String(tArr[j] || "");
      const ymd = ts.slice(0, 10);
      const hh = parseInt(ts.slice(11, 13), 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || Number.isNaN(hh) || hh < 0 || hh > 23) continue;
      let bucket = aqiByYmd.get(ymd);
      if (!bucket) {
        bucket = {
          pm10: new Array(24).fill(0),
          pm25: new Array(24).fill(0),
          dust: new Array(24).fill(0),
          aod: new Array(24).fill(0),
          usAqi: new Array(24).fill(0),
        };
        aqiByYmd.set(ymd, bucket);
      }
      bucket.pm10[hh] = Number(pm10Arr[j]) || 0;
      bucket.pm25[hh] = Number(pm25Arr[j]) || 0;
      bucket.dust[hh] = Number(dustArr[j]) || 0;
      bucket.aod[hh] = Number(aodArr[j]) || 0;
      bucket.usAqi[hh] = Number(uqArr[j]) || 0;
    }
  }

  const hrByYmd = new Map();
  if (Array.isArray(weatherRes?.hourly?.time)) {
    const hTime = weatherRes.hourly.time;
    const src = weatherRes.hourly;
    for (let j = 0; j < hTime.length; j++) {
      const ts = String(hTime[j] || "");
      const ymd = ts.slice(0, 10);
      const hh = parseInt(ts.slice(11, 13), 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || Number.isNaN(hh) || hh < 0 || hh > 23) continue;
      let bucket = hrByYmd.get(ymd);
      if (!bucket) {
        bucket = {
          gti: new Array(24).fill(0),
          gtiInstant: new Array(24).fill(0),
          diffuseRadiation: new Array(24).fill(0),
          dni: new Array(24).fill(0),
          clearSkyGhi: new Array(24).fill(0),
          cloudCover: new Array(24).fill(0),
          tempC: new Array(24).fill(0),
          dewPointC: new Array(24).fill(0),
          rhPct: new Array(24).fill(0),
          rainMm: new Array(24).fill(0),
          precipMm: new Array(24).fill(0),
          windKmh: new Array(24).fill(0),
          visibilityM: new Array(24).fill(10000),
          weatherCode: new Array(24).fill(0),
        };
        hrByYmd.set(ymd, bucket);
      }
      bucket.gti[hh] = Number(src.global_tilted_irradiance?.[j]) || 0;
      bucket.gtiInstant[hh] = Number(src.global_tilted_irradiance_instant?.[j]) || 0;
      bucket.diffuseRadiation[hh] = Number(src.diffuse_radiation?.[j]) || 0;
      bucket.dni[hh] = Number(src.direct_normal_irradiance?.[j]) || 0;
      bucket.clearSkyGhi[hh] = Number(src.shortwave_radiation_clear_sky?.[j]) || 0;
      bucket.cloudCover[hh] = Number(src.cloud_cover?.[j]) || 0;
      bucket.tempC[hh] = Number(src.temperature_2m?.[j]) || 0;
      bucket.dewPointC[hh] = Number(src.dew_point_2m?.[j]) || 0;
      bucket.rhPct[hh] = Number(src.relative_humidity_2m?.[j]) || 0;
      bucket.rainMm[hh] = Number(src.rain?.[j]) || 0;
      bucket.precipMm[hh] = Number(src.precipitation?.[j]) || 0;
      bucket.windKmh[hh] = Number(src.wind_speed_10m?.[j]) || 0;
      bucket.visibilityM[hh] = src.visibility?.[j] != null ? Number(src.visibility[j]) : 10000;
      bucket.weatherCode[hh] = Number(src.weather_code?.[j]) || 0;
    }
  }

  const pastDays = {};
  const dailyAtmosphere = {};
  let slicedDaily = weatherRes?.daily || null;
  let slicedHourly = weatherRes?.hourly || null;
  let slicedMinutely15 = weatherRes?.minutely_15 || null;

  if (weatherRes?.daily?.time) {
    const todayStr = weatherRes?.current?.time
      ? weatherRes.current.time.slice(0, 10)
      : currentIstYmd;
    const foundIdx = weatherRes.daily.time.indexOf(todayStr);
    const todayIdx =
      foundIdx >= 0 ? foundIdx : Math.max(0, weatherRes.daily.time.indexOf(currentIstYmd));

    const latKey = Number(lat).toFixed(4);
    const lonKey = Number(lon).toFixed(4);
    const diskCache = persistPastAndToday
      ? loadJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, {})
      : null;
    let diskDirty = false;

    for (let i = 0; i < weatherRes.daily.time.length; i++) {
      const dKey = weatherRes.daily.time[i];
      const wCodeDay = weatherRes.daily.weather_code?.[i] ?? 0;
      const sunSecDay = weatherRes.daily.sunshine_duration?.[i] || 0;
      const hr = hrByYmd.get(dKey) || {};
      const aq = aqiByYmd.get(dKey) || {};
      const clearSumWh = Array.isArray(hr.clearSkyGhi)
        ? hr.clearSkyGhi.reduce((s, v) => s + (Number(v) || 0), 0)
        : 0;
      const m15Slice =
        weatherRes.minutely_15?.global_tilted_irradiance?.slice(i * 96, (i + 1) * 96) || [];
      const m15InstantSlice =
        weatherRes.minutely_15?.global_tilted_irradiance_instant?.slice(i * 96, (i + 1) * 96) || [];
      const dayRecord = {
        ymd: dKey,
        date: dKey,
        dateYmd: dKey,
        sunrise: weatherRes.daily.sunrise?.[i] || null,
        sunset: weatherRes.daily.sunset?.[i] || null,
        radiationMjM2: weatherRes.daily.shortwave_radiation_sum?.[i] ?? null,
        clearSkyMjM2: clearSumWh > 50 ? parseFloat((clearSumWh * 0.0036).toFixed(2)) : null,
        sunshineDurationHours: sunSecDay > 0 ? parseFloat((sunSecDay / 3600).toFixed(1)) : null,
        weatherCode: wCodeDay,
        tempMax: weatherRes.daily.temperature_2m_max?.[i] ?? null,
        tempMin: weatherRes.daily.temperature_2m_min?.[i] ?? null,
        precipitationSum: weatherRes.daily.precipitation_sum?.[i] ?? 0,
        rainSum: weatherRes.daily.rain_sum?.[i] ?? 0,
        precipitationProbMax: weatherRes.daily.precipitation_probability_max?.[i] ?? null,
        hourlyGti:
          hr.gti || weatherRes.hourly?.global_tilted_irradiance?.slice(i * 24, (i + 1) * 24) || [],
        hourlyGtiInstant:
          hr.gtiInstant ||
          weatherRes.hourly?.global_tilted_irradiance_instant?.slice(i * 24, (i + 1) * 24) ||
          [],
        hourlyDiffuse:
          hr.diffuseRadiation ||
          weatherRes.hourly?.diffuse_radiation?.slice(i * 24, (i + 1) * 24) ||
          [],
        hourlyDni:
          hr.dni ||
          weatherRes.hourly?.direct_normal_irradiance?.slice(i * 24, (i + 1) * 24) ||
          [],
        gtiFetchedAzimuthDeg: Number.isFinite(Number(fetchedAzimuthDeg))
          ? Number(fetchedAzimuthDeg)
          : 0,
        minutely15Gti: m15Slice,
        minutely15GtiInstant: m15InstantSlice,
        hourlyClearSkyGhi: hr.clearSkyGhi || [],
        hourlyCloudCover: hr.cloudCover || [],
        hourlyTempC: hr.tempC || [],
        hourlyDewPointC: hr.dewPointC || [],
        hourlyRhPct: hr.rhPct || [],
        hourlyRainMm: hr.rainMm || [],
        hourlyPrecipMm: hr.precipMm || [],
        hourlyWindKmh: hr.windKmh || [],
        hourlyVisibilityM: hr.visibilityM || [],
        hourlyWeatherCode: hr.weatherCode || [],
        hourlyPm10: aq.pm10 || [],
        hourlyPm25: aq.pm25 || [],
        hourlyDust: aq.dust || [],
        hourlyAod: aq.aod || [],
        hourlyUsAqi: aq.usAqi || [],
      };

      dailyAtmosphere[dKey] = dayRecord;
      if (i < todayIdx) {
        pastDays[dKey] = dayRecord;
      }
      if (persistPastAndToday && diskCache && i <= todayIdx) {
        const cacheKey = `${latKey}_${lonKey}_${dKey}`;
        const existing = diskCache[cacheKey];
        const needsBackfill =
          !existing ||
          !Array.isArray(existing.hourlyPm10) ||
          existing.hourlyPm10.length < 24 ||
          !Array.isArray(existing.hourlyAod) ||
          existing.hourlyAod.length < 24 ||
          !Array.isArray(existing.hourlyDiffuse) ||
          existing.hourlyDiffuse.length < 24 ||
          !Array.isArray(existing.hourlyDni) ||
          existing.hourlyDni.length < 24 ||
          !Array.isArray(existing.hourlyVisibilityM) ||
          existing.hourlyVisibilityM.length < 24 ||
          !Array.isArray(existing.hourlyGtiInstant) ||
          existing.hourlyGtiInstant.length < 24 ||
          existing.ensembleVersion !== 1 ||
          dKey === currentIstYmd;
        if (needsBackfill) {
          const { conditionText, conditionType } = mapWmoCondition(wCodeDay, true, 0);
          diskCache[cacheKey] = {
            ...(existing || {}),
            ...dayRecord,
            ensembleVersion: 1,
            condition: existing?.condition || conditionText,
            conditionType: existing?.conditionType || conditionType,
            source: existing?.source || "open_meteo_enriched",
          };
          diskDirty = true;
        }
      }
    }
    if (diskDirty && diskCache) {
      saveJsonFileSafe(WEATHER_HISTORY_CACHE_FILE, diskCache);
    }

    if (todayIdx > 0) {
      slicedDaily = {};
      for (const [k, arr] of Object.entries(weatherRes.daily)) {
        slicedDaily[k] = Array.isArray(arr) ? arr.slice(todayIdx) : arr;
      }
      if (weatherRes.hourly) {
        slicedHourly = {};
        const hOffset = todayIdx * 24;
        for (const [k, arr] of Object.entries(weatherRes.hourly)) {
          slicedHourly[k] = Array.isArray(arr) ? arr.slice(hOffset) : arr;
        }
      }
      if (weatherRes.minutely_15) {
        slicedMinutely15 = {};
        const mOffset = todayIdx * 96;
        for (const [k, arr] of Object.entries(weatherRes.minutely_15)) {
          slicedMinutely15[k] = Array.isArray(arr) ? arr.slice(mOffset) : arr;
        }
      }
    }
  }

  return { pastDays, dailyAtmosphere, slicedDaily, slicedHourly, slicedMinutely15 };
}

/**
 * Fetch lightweight Open-Meteo `past_days=1&forecast_days=5` weather + AQI payload with
 * configurable daytime/nighttime caching and single-flight deduplication.
 */
async function fetchOpenMeteoWeather(lat, lon, forceOrOpts = false) {
  const opts =
    typeof forceOrOpts === "object" && forceOrOpts !== null
      ? forceOrOpts
      : { force: Boolean(forceOrOpts) };
  const force = Boolean(opts.force);
  const settings = loadSettings();
  const safeTilt = parseFloat(clampNumber(opts.tilt ?? settings.arrayTiltDeg, 0, 60, 26.5).toFixed(1));
  const safeAzimuth = Math.round(clampNumber(opts.azimuth ?? settings.arrayAzimuthDeg, -180, 180, 0));
  const dayTtlMin = clampNumber(opts.dayTtlMin ?? settings.weatherCacheTtlMin, 5, 60, 12);

  const istParts = getISTDateParts();
  const currentIstYmd = istParts.ymd;
  const activeTtlMs = getWeatherCacheTtlMs(istParts, dayTtlMin);

  const cached = getWeatherCache();
  if (
    !force &&
    cached.data &&
    cached.lat === lat &&
    cached.lon === lon &&
    cached.tilt === safeTilt &&
    cached.azimuth === safeAzimuth &&
    cached.dateYmd === currentIstYmd &&
    Date.now() - cached.timestamp < activeTtlMs
  ) {
    return cached.data;
  }

  const flightKey = `${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}_t${safeTilt}_a${safeAzimuth}_${currentIstYmd}`;
  if (inFlightWeatherFetches.has(flightKey)) {
    return inFlightWeatherFetches.get(flightKey);
  }

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,shortwave_radiation,direct_radiation,diffuse_radiation,direct_normal_irradiance,global_tilted_irradiance,global_tilted_irradiance_instant&hourly=${OPEN_METEO_FORECAST_HOURLY}&minutely_15=global_tilted_irradiance,global_tilted_irradiance_instant&daily=${OPEN_METEO_DAILY_FIELDS}&tilt=${safeTilt}&azimuth=${safeAzimuth}&timezone=Asia%2FKolkata&past_days=1&forecast_days=5&models=best_match,gfs_seamless,ecmwf_ifs025`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,dust,aerosol_optical_depth&hourly=pm10,pm2_5,dust,aerosol_optical_depth,us_aqi&timezone=Asia%2FKolkata&past_days=1&forecast_days=5`;

  const task = (async () => {
    try {
      const [rawWeatherRes, aqiRes] = await Promise.all([
        httpGetJson(forecastUrl),
        httpGetJson(aqiUrl).catch((e) => {
          console.warn("[AQI API] Optional AQ fetch failed:", e.message);
          return null;
        }),
      ]);
      const weatherRes = normalizeEnsembleOpenMeteoResponse(rawWeatherRes);

      const { pastDays, dailyAtmosphere, slicedDaily, slicedHourly, slicedMinutely15 } =
        indexAndExtractAtmosphereDays(
          weatherRes,
          aqiRes,
          lat,
          lon,
          currentIstYmd,
          true,
          safeAzimuth
        );

      const combined = {
        weather: weatherRes,
        airQuality: aqiRes,
        current: weatherRes?.current || null,
        daily: slicedDaily,
        hourly: slicedHourly,
        minutely15: slicedMinutely15,
        pastDays,
        dailyAtmosphere,
        tiltDegrees: safeTilt,
        azimuthDegrees: safeAzimuth,
        fetchedAtIso: new Date().toISOString(),
        istDateYmd: currentIstYmd,
      };

      if (weatherRes && weatherRes.current) {
        setWeatherCache({
          data: combined,
          timestamp: Date.now(),
          lat,
          lon,
          tilt: safeTilt,
          azimuth: safeAzimuth,
          dateYmd: currentIstYmd,
        });
      }
      return combined;
    } catch (err) {
      console.error("[Weather/AQI API] Aggregate fetch error:", err.message);
      return getWeatherCache().data || null;
    } finally {
      inFlightWeatherFetches.delete(flightKey);
    }
  })();

  inFlightWeatherFetches.set(flightKey, task);
  return task;
}

module.exports = {
  OPEN_METEO_ENSEMBLE_MODELS,
  OPEN_METEO_FORECAST_HOURLY,
  OPEN_METEO_DAILY_FIELDS,
  WMO_WEATHER_MAP,
  mapWmoCondition,
  getWeatherCacheTtlMs,
  httpGetJson,
  normalizeEnsembleSection,
  normalizeEnsembleOpenMeteoResponse,
  indexAndExtractAtmosphereDays,
  fetchOpenMeteoWeather,
};
