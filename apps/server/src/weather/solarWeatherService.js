const solarTruth = require("@solar-track/core/physics");
const { buildPhysicsArgsFromSettings } = require("../config/settingsStore");
const { getISTClockSnapshot } = require("../time/istClock");
const { getPrimaryStationAndToken } = require("../waaree/accountsStore");
const { getQuickSiteCalibration } = require("../intelligence/localInputsCollector");
const {
  WMO_WEATHER_MAP,
  mapWmoCondition,
  fetchOpenMeteoWeather,
} = require("./openMeteoClient");
const {
  ensureHistoricalAtmosphereBackfill,
  fetchOrGetAnnualMonthlyBaseline,
} = require("./historicalBackfill");

/**
 * Assemble the complete `/api/weather/solar` and live-sync weather/irradiance payload,
 * including calibrated digital twin forecasts for today and tomorrow.
 */
async function buildSolarWeatherPayload(
  settings,
  { force = false, latOverride = null, lonOverride = null } = {}
) {
  const lat = Number.isFinite(latOverride)
    ? latOverride
    : parseFloat(settings.plantLocation?.lat ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LAT);
  const lon = Number.isFinite(lonOverride)
    ? lonOverride
    : parseFloat(settings.plantLocation?.lon ?? solarTruth.SOLAR_CONSTANTS.DEFAULT_LON);
  const resolved = getPrimaryStationAndToken(null);
  const fallbackCap = parseFloat(resolved.capacity) || solarTruth.SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP;
  const phys = buildPhysicsArgsFromSettings(settings, fallbackCap);
  const tilt = phys.arrayTiltDeg;
  const azimuth = phys.arrayAzimuthDeg;
  const physicsOverrides = {
    dcCapacityKwp: phys.dcCapacityKwp,
    acInverterCapacityKw: phys.acInverterCapacityKw,
    arrayTiltDeg: phys.arrayTiltDeg,
    arrayAzimuthDeg: phys.arrayAzimuthDeg,
    mountingType: phys.mountingType,
    roofAlbedo: phys.roofAlbedo,
    dcCleanFactor: phys.dcCleanFactor,
    thermalCoeffPerC: phys.thermalCoeffPerC,
    basePrAtStc: phys.basePrAtStc,
    inverterEfficiency: phys.inverterEfficiency,
  };

  const commissioningYmd =
    settings.commissioningDateOverride || resolved.commissioningYmd || "2026-10-28";

  const [weather, annualBaseline] = await Promise.all([
    fetchOpenMeteoWeather(lat, lon, {
      force,
      tilt,
      azimuth,
      dayTtlMin: settings.weatherCacheTtlMin,
    }),
    fetchOrGetAnnualMonthlyBaseline(lat, lon, false, tilt, azimuth, physicsOverrides).catch(
      () => null
    ),
    ensureHistoricalAtmosphereBackfill(lat, lon, commissioningYmd, false, tilt, azimuth).catch(
      () => null
    ),
  ]);
  if (!weather || !weather.current) {
    return { errno: 0, available: false, message: "Weather data currently unavailable" };
  }

  const istClock = getISTClockSnapshot();
  const capacity = phys.dcCapacityKwp;
  const tariff = Number(settings.tariffPerKwh) || solarTruth.SOLAR_CONSTANTS.DEFAULT_TARIFF_INR;

  const quickCal = getQuickSiteCalibration(settings, weather, resolved, istClock);
  const currentSurfaceLossPct = parseFloat(quickCal.surfaceLossPct.toFixed(1));
  const siteCal = quickCal.siteCalibration;
  const gtiReferenceAzimuthDeg = weather.azimuthDegrees ?? physicsOverrides.arrayAzimuthDeg;
  const calPhysics = {
    ...physicsOverrides,
    arrayAzimuthDeg:
      siteCal?.enabled && typeof siteCal.effectiveAzimuthDeg === "number"
        ? siteCal.effectiveAzimuthDeg
        : physicsOverrides.arrayAzimuthDeg,
    gtiReferenceAzimuthDeg,
    kSite: siteCal?.kSiteApplied,
    inverterLossCoeffs: siteCal?.inverterCoeffs,
    hourlyShadeFactors: siteCal?.enabled ? siteCal.hourlyShadeFactors : null,
  };

  const airQuality = weather.airQuality;
  const aqiVal = airQuality?.current?.us_aqi ?? 164;
  const pm10Val = airQuality?.current?.pm10 ?? 142;
  const pm25Val = airQuality?.current?.pm2_5 ?? 85;
  const dustVal = airQuality?.current?.dust ?? 22;
  const aodVal = airQuality?.current?.aerosol_optical_depth ?? 0.65;

  const todayYmd = weather.daily?.time?.[0] || istClock.ymd;
  const tomorrowYmd = weather.daily?.time?.[1] || istClock.tomorrowYmd;
  const todayAtm = weather.dailyAtmosphere?.[todayYmd] || {};
  const tomorrowAtm = weather.dailyAtmosphere?.[tomorrowYmd] || {};

  const hourlyGtiAll = Array.isArray(weather.hourly?.global_tilted_irradiance)
    ? weather.hourly.global_tilted_irradiance
    : [];
  const hourlyGtiInstantAll = Array.isArray(weather.hourly?.global_tilted_irradiance_instant)
    ? weather.hourly.global_tilted_irradiance_instant
    : [];
  const hourlyDiffuseAll = Array.isArray(weather.hourly?.diffuse_radiation)
    ? weather.hourly.diffuse_radiation
    : [];
  const hourlyDniAll = Array.isArray(weather.hourly?.direct_normal_irradiance)
    ? weather.hourly.direct_normal_irradiance
    : [];
  const hourlyCloudAll = Array.isArray(weather.hourly?.cloud_cover)
    ? weather.hourly.cloud_cover
    : [];
  const hourlyTempAll = Array.isArray(weather.hourly?.temperature_2m)
    ? weather.hourly.temperature_2m
    : [];
  const hourlyWindAll = Array.isArray(weather.hourly?.wind_speed_10m)
    ? weather.hourly.wind_speed_10m
    : [];
  const minutely15GtiAll = Array.isArray(weather.minutely15?.global_tilted_irradiance)
    ? weather.minutely15.global_tilted_irradiance
    : [];
  const minutely15GtiInstantAll = Array.isArray(
    weather.minutely15?.global_tilted_irradiance_instant
  )
    ? weather.minutely15.global_tilted_irradiance_instant
    : [];

  const dayKeys =
    Array.isArray(weather.daily?.time) && weather.daily.time.length > 0
      ? weather.daily.time
      : [todayYmd, tomorrowYmd];
  const hourlyPm10Aligned = [];
  const hourlyAodAligned = [];
  for (const dk of dayKeys) {
    const rec = weather.dailyAtmosphere?.[dk];
    if (Array.isArray(rec?.hourlyPm10) && rec.hourlyPm10.length >= 24) {
      hourlyPm10Aligned.push(...rec.hourlyPm10.slice(0, 24));
    } else {
      hourlyPm10Aligned.push(...new Array(24).fill(pm10Val));
    }
    if (Array.isArray(rec?.hourlyAod) && rec.hourlyAod.length >= 24) {
      hourlyAodAligned.push(...rec.hourlyAod.slice(0, 24));
    } else {
      hourlyAodAligned.push(...new Array(24).fill(aodVal));
    }
  }

  const todayRadMj = weather.daily?.shortwave_radiation_sum?.[0] ?? 15.33;
  const todayModel = solarTruth.computeDailySolarPhysicsModel({
    sunriseIso: weather.daily?.sunrise?.[0] || `${istClock.ymd}T06:23`,
    sunsetIso: weather.daily?.sunset?.[0] || `${istClock.ymd}T17:20`,
    ymd: todayYmd,
    lat,
    lon,
    hourlyGti: hourlyGtiAll.slice(0, 24),
    hourlyGtiInstant:
      hourlyGtiInstantAll.length >= 24
        ? hourlyGtiInstantAll.slice(0, 24)
        : todayAtm.hourlyGtiInstant || [],
    minutely15Gti: minutely15GtiAll.slice(0, 96),
    minutely15GtiInstant:
      minutely15GtiInstantAll.length >= 96
        ? minutely15GtiInstantAll.slice(0, 96)
        : todayAtm.minutely15GtiInstant || [],
    hourlyDiffuse:
      hourlyDiffuseAll.length >= 24 ? hourlyDiffuseAll.slice(0, 24) : todayAtm.hourlyDiffuse || [],
    hourlyDni: hourlyDniAll.length >= 24 ? hourlyDniAll.slice(0, 24) : todayAtm.hourlyDni || [],
    hourlyCloudCover:
      hourlyCloudAll.length >= 24 ? hourlyCloudAll.slice(0, 24) : todayAtm.hourlyCloudCover || [],
    hourlyTempC:
      hourlyTempAll.length >= 24 ? hourlyTempAll.slice(0, 24) : todayAtm.hourlyTempC || [],
    hourlyWindKmh:
      hourlyWindAll.length >= 24 ? hourlyWindAll.slice(0, 24) : todayAtm.hourlyWindKmh || [],
    hourlyPm10: hourlyPm10Aligned.slice(0, 24),
    hourlyAod: hourlyAodAligned.slice(0, 24),
    radiationMjM2: todayRadMj,
    capacityKwp: capacity,
    surfaceLossPct: currentSurfaceLossPct,
    ambientTempC: weather.current.temperature_2m ?? 24,
    windSpeedKmh: weather.current.wind_speed_10m || 5,
    aod: aodVal,
    pm10: pm10Val,
    pm25: pm25Val,
    ...calPhysics,
  });
  const todayYieldEst = todayModel.targetDailyModelKwh;
  const todaySavingsEst = Math.round(todayYieldEst * tariff);

  const tomorrowRadMj = weather.daily?.shortwave_radiation_sum?.[1] ?? 15.3;
  const tomorrowMaxT = weather.daily?.temperature_2m_max?.[1] ?? 28.6;
  const tomorrowMinT = weather.daily?.temperature_2m_min?.[1] ?? 17.5;
  const tomorrowModel = solarTruth.computeDailySolarPhysicsModel({
    sunriseIso: weather.daily?.sunrise?.[1] || `${istClock.tomorrowYmd}T06:24`,
    sunsetIso: weather.daily?.sunset?.[1] || `${istClock.tomorrowYmd}T17:20`,
    ymd: tomorrowYmd,
    lat,
    lon,
    hourlyGti: hourlyGtiAll.slice(24, 48),
    hourlyGtiInstant:
      hourlyGtiInstantAll.length >= 48
        ? hourlyGtiInstantAll.slice(24, 48)
        : tomorrowAtm.hourlyGtiInstant || [],
    minutely15Gti: minutely15GtiAll.slice(96, 192),
    minutely15GtiInstant:
      minutely15GtiInstantAll.length >= 192
        ? minutely15GtiInstantAll.slice(96, 192)
        : tomorrowAtm.minutely15GtiInstant || [],
    hourlyDiffuse:
      hourlyDiffuseAll.length >= 48
        ? hourlyDiffuseAll.slice(24, 48)
        : tomorrowAtm.hourlyDiffuse || [],
    hourlyDni:
      hourlyDniAll.length >= 48 ? hourlyDniAll.slice(24, 48) : tomorrowAtm.hourlyDni || [],
    hourlyCloudCover:
      hourlyCloudAll.length >= 48
        ? hourlyCloudAll.slice(24, 48)
        : tomorrowAtm.hourlyCloudCover || [],
    hourlyTempC:
      hourlyTempAll.length >= 48 ? hourlyTempAll.slice(24, 48) : tomorrowAtm.hourlyTempC || [],
    hourlyWindKmh:
      hourlyWindAll.length >= 48 ? hourlyWindAll.slice(24, 48) : tomorrowAtm.hourlyWindKmh || [],
    hourlyPm10: hourlyPm10Aligned.slice(24, 48),
    hourlyAod: hourlyAodAligned.slice(24, 48),
    radiationMjM2: tomorrowRadMj,
    capacityKwp: capacity,
    surfaceLossPct: currentSurfaceLossPct,
    ambientTempC: (tomorrowMaxT + tomorrowMinT) / 2,
    windSpeedKmh: weather.current.wind_speed_10m || 5,
    aod: aodVal,
    pm10: pm10Val,
    pm25: pm25Val,
    ...calPhysics,
  });
  const tomorrowYieldEst = tomorrowModel.targetDailyModelKwh;
  const tomorrowSavingsEst = Math.round(tomorrowYieldEst * tariff);

  const isDay = weather.current.is_day === 1;
  const wCode = weather.current.weather_code || 0;
  const cloudCover = weather.current.cloud_cover || 0;
  const { conditionText, conditionType } = mapWmoCondition(wCode, isDay, cloudCover);

  const tomorrowWCode = weather.daily?.weather_code?.[1] ?? wCode;
  const tomorrowMapped = WMO_WEATHER_MAP[tomorrowWCode] || {
    nameDay: "Clear Sky",
    category: "sunny",
  };

  const gtiVal =
    weather.current?.global_tilted_irradiance_instant ??
    weather.current?.global_tilted_irradiance ??
    0;
  const diffuseVal = weather.current?.diffuse_radiation || 0;
  const directVal = weather.current?.direct_radiation || 0;
  const precipVal = weather.current?.precipitation || 0;
  const windGustsVal = weather.current?.wind_gusts_10m || 0;

  const sunshineSec = weather.daily?.sunshine_duration?.[0] || 0;
  const sunshineHours = sunshineSec > 0 ? parseFloat((sunshineSec / 3600).toFixed(1)) : 7.4;
  const tomorrowSunshineSec = weather.daily?.sunshine_duration?.[1] || 0;
  const tomorrowSunshineHours =
    tomorrowSunshineSec > 0 ? parseFloat((tomorrowSunshineSec / 3600).toFixed(1)) : 8.0;

  return {
    errno: 0,
    available: true,
    fetchedAtIso: weather.fetchedAtIso || new Date().toISOString(),
    istDateYmd: weather.istDateYmd || istClock.ymd,
    current: {
      temperature: weather.current.temperature_2m,
      humidity: weather.current.relative_humidity_2m,
      cloudCover: weather.current.cloud_cover,
      shortwaveRadiation: weather.current.shortwave_radiation || 0,
      directNormalIrradiance: weather.current.direct_normal_irradiance || 0,
      globalTiltedIrradiance: gtiVal,
      diffuseRadiation: diffuseVal,
      directRadiation: directVal,
      precipitation: precipVal,
      windSpeed: weather.current.wind_speed_10m || 0,
      windGusts: windGustsVal,
      isDay,
      weatherCode: wCode,
      time: weather.current.time,
      usAqi: aqiVal,
      pm10: pm10Val,
      pm25: pm25Val,
      dust: dustVal,
      aerosolOpticalDepth: aodVal,
    },
    hourly: {
      globalTiltedIrradiance: hourlyGtiAll,
      globalTiltedIrradianceInstant: hourlyGtiInstantAll,
      shortwaveRadiationClearSky: weather.hourly?.shortwave_radiation_clear_sky || [],
      diffuseRadiation: hourlyDiffuseAll,
      directNormalIrradiance: hourlyDniAll,
      cloudCover: hourlyCloudAll,
      dewPoint2m: weather.hourly?.dew_point_2m || [],
      temperature2m: hourlyTempAll,
      windSpeed10m: hourlyWindAll,
      pm10: hourlyPm10Aligned,
      aerosolOpticalDepth: hourlyAodAligned,
    },
    minutely15: {
      globalTiltedIrradiance: minutely15GtiAll,
      globalTiltedIrradianceInstant: minutely15GtiInstantAll,
    },
    siteCalibration: siteCal || null,
    azimuthDegrees: gtiReferenceAzimuthDeg,
    todayForecast: {
      dateYmd: todayYmd,
      expectedYieldKwh: todayYieldEst,
      expectedSavingsINR: todaySavingsEst,
      radiationMjM2: todayRadMj,
      sunshineDurationHours: sunshineHours,
      precipitationSum: weather.daily?.precipitation_sum?.[0] || 0,
      dewPoint: weather.hourly?.dew_point_2m?.[istClock.hour] || 14.2,
      maxTemp: weather.daily?.temperature_2m_max?.[0] || 28.5,
      minTemp: weather.daily?.temperature_2m_min?.[0] || 17.7,
      cloudCover: weather.current.cloud_cover,
      condition: conditionText,
      conditionType,
      irradianceDni: weather.current.direct_normal_irradiance || 0,
      irradianceGti: gtiVal,
      irradianceGhi: weather.current.shortwave_radiation || 0,
      sunrise: weather.daily?.sunrise?.[0] || `${istClock.ymd}T06:23`,
      sunset: weather.daily?.sunset?.[0] || `${istClock.ymd}T17:20`,
      usAqi: aqiVal,
      pm10: pm10Val,
      aerosolOpticalDepth: aodVal,
      currentSurfaceLossPct,
    },
    tomorrowForecast: {
      dateYmd: tomorrowYmd,
      expectedYieldKwh: tomorrowYieldEst,
      expectedSavingsINR: tomorrowSavingsEst,
      radiationMjM2: tomorrowRadMj,
      sunshineDurationHours: tomorrowSunshineHours,
      maxTemp: weather.daily?.temperature_2m_max?.[1] || 28.6,
      minTemp: weather.daily?.temperature_2m_min?.[1] || 17.5,
      sunrise: weather.daily?.sunrise?.[1] || `${istClock.tomorrowYmd}T06:24`,
      sunset: weather.daily?.sunset?.[1] || `${istClock.tomorrowYmd}T17:20`,
      condition: tomorrowMapped.nameDay,
      conditionType: tomorrowMapped.category,
      currentSurfaceLossPct,
    },
    pastDays: weather.pastDays || {},
    annualBaseline: annualBaseline || null,
    location: settings.plantLocation,
  };
}

module.exports = {
  buildSolarWeatherPayload,
};
