import { parseRawTelemetry } from '../analytics/telemetryParser.ts';
import { getKanpurProfileForDate, isKanpurRegion } from '../calibration/monthlyProfiles.ts';
import {
  convertTemperature,
  formatINR,
  formatTemperature,
} from '../formatters/solarFormatter.ts';
import { classifyDayGapArchitecture } from '../intelligence/gapClassifier.ts';
import {
  SOLAR_CONSTANTS,
  computeAstronomicalSunTimes,
  computeEffectiveSolarPr,
  computeHybridTodayStitch,
  computeLiveNowcastingBlend,
  computeTodayPhysicsAtMinute,
  evaluateTelemetryTruth,
  formatDurationHm,
  formatMinutes12hUpper,
  parseIsoClockMinutes,
  parseTelemetryDate,
} from '../physics/index.ts';
import {
  diffYmdDays,
  formatIndianDate,
  getIstClockParts,
  shiftIstFromYmd,
} from '../time/istDate.ts';
import type { TelemetrySunContext } from '../types/physics.ts';
import type { MountingType, TemperatureUnit } from '../types/settings.ts';
import type {
  BuildCanonicalSolarSnapshotInput,
  CanonicalSolarSnapshot,
} from '../types/snapshot.ts';
import type { LiveFlowData } from '../types/telemetry.ts';
import {
  resolveDirectDiffuseOptics,
  resolveHeroStatusLabel,
  resolveReportCard,
  resolveThermalAndElectrical,
} from './heroStateMachine.ts';
import {
  buildDiscomAndRoiRollup,
  buildMonthMetricsRollup,
  buildRecent7AndSunScore,
  buildYesterdayRollup,
  computeTrapezoidalCurveWindow,
  getSeriesNumericValue,
} from './periodRollups.ts';
import { reconcileWaterFillBuffers } from './waterFillReconciler.ts';

/**
 * Single Source of Truth Snapshot Assembler:
 * Computes live physics, soiling state, truth gate, gap reconstruction,
 * EMonth/ETotal water-fill reconciliation, DISCOM cycle, ROI, and telemetry diagnostics.
 */
export function buildCanonicalSolarSnapshot(
  input: BuildCanonicalSolarSnapshotInput
): CanonicalSolarSnapshot {
  const clock = getIstClockParts(input.now);
  const s = input.settings;
  const w = input.weatherData;
  const rep = input.intelligenceReport;
  const summary = input.summaryData;
  const flow = input.flowData;

  const acInverterCapacityKw =
    Number(s.acInverterCapacityKw) > 0
      ? Number(s.acInverterCapacityKw)
      : Number(s.systemCapacity) > 0
        ? Number(s.systemCapacity)
        : Number(summary?.capacity) > 0
          ? Number(summary?.capacity)
          : SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const dcCapacityKwp =
    Number(s.dcCapacityKwp) > 0 ? Number(s.dcCapacityKwp) : acInverterCapacityKw;
  const capacityKwp = dcCapacityKwp;
  const tariffPerKwh =
    Number(s.tariffPerKwh) > 0 ? Number(s.tariffPerKwh) : SOLAR_CONSTANTS.DEFAULT_TARIFF_INR;
  const systemCost =
    Number(s.systemCost) > 0 ? Number(s.systemCost) : SOLAR_CONSTANTS.DEFAULT_SYSTEM_COST_INR;
  const billingCycleDay = Math.min(28, Math.max(1, Math.round(Number(s.billingCycleDay) || 1)));
  const tempUnit: TemperatureUnit = s.tempUnit === 'F' ? 'F' : 'C';

  const lat = Number.isFinite(Number(s.plantLocation?.lat))
    ? Number(s.plantLocation?.lat)
    : Number.isFinite(Number(w?.location?.lat))
      ? Number(w!.location!.lat)
      : SOLAR_CONSTANTS.DEFAULT_LAT;
  const lon = Number.isFinite(Number(s.plantLocation?.lon))
    ? Number(s.plantLocation?.lon)
    : Number.isFinite(Number(w?.location?.lon))
      ? Number(w!.location!.lon)
      : SOLAR_CONSTANTS.DEFAULT_LON;
  const locationName =
    s.plantLocation?.name || w?.location?.name || SOLAR_CONSTANTS.DEFAULT_LOCATION_NAME;
  const plantDisplayName =
    (typeof s.plantDisplayName === 'string' && s.plantDisplayName.trim()) ||
    'My Solar Plant';
  const commissioningYmd =
    (typeof s.commissioningDateOverride === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.commissioningDateOverride) &&
      s.commissioningDateOverride) ||
    input.commissioningYmd ||
    '2026-10-28';
  const commissioningDisplay = formatIndianDate(commissioningYmd);
  const arrayTiltDeg = Number.isFinite(Number(s.arrayTiltDeg))
    ? Math.max(0, Math.min(60, Number(s.arrayTiltDeg)))
    : SOLAR_CONSTANTS.DEFAULT_TILT_DEG;
  const arrayAzimuthDeg = Number.isFinite(Number(s.arrayAzimuthDeg))
    ? Math.max(-180, Math.min(180, Number(s.arrayAzimuthDeg)))
    : SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG;
  const mountingType: MountingType = s.mountingType === 'flush_rcc' ? 'flush_rcc' : 'open_rack';
  const roofAlbedo = Number.isFinite(Number(s.roofAlbedo))
    ? Math.max(0.05, Math.min(0.8, Number(s.roofAlbedo)))
    : SOLAR_CONSTANTS.DEFAULT_ALBEDO;
  const dcCleanFactor =
    Number(s.dcCleanFactor) > 0
      ? Math.max(0.75, Math.min(1.0, Number(s.dcCleanFactor)))
      : SOLAR_CONSTANTS.DC_CLEAN_FACTOR;
  const useCalibratedTwin = s.useCalibratedTwin !== false;
  const kanpurMonthly = isKanpurRegion(lat, lon) ? getKanpurProfileForDate(clock.ymd) : null;
  const kSiteApplied = !useCalibratedTwin
    ? 1.0
    : typeof s.kSiteOverride === 'number' && Number.isFinite(s.kSiteOverride) && s.kSiteOverride > 0
      ? Math.min(SOLAR_CONSTANTS.KSITE_MAX, Math.max(SOLAR_CONSTANTS.KSITE_MIN, Number(s.kSiteOverride)))
      : rep?.siteCalibration?.kSiteApplied ?? kanpurMonthly?.kSite ?? 1.0;
  const inverterLossCoeffs =
    typeof s.inverterTareKw === 'number' && Number.isFinite(s.inverterTareKw) && s.inverterTareKw > 0
      ? {
          tareKw: s.inverterTareKw,
          linearLoss: s.inverterLinearLoss ?? SOLAR_CONSTANTS.DEFAULT_INV_LINEAR_LOSS,
          quadLoss: s.inverterQuadLoss ?? SOLAR_CONSTANTS.DEFAULT_INV_QUAD_LOSS,
          cutoffKw: SOLAR_CONSTANTS.DEFAULT_INV_CUTOFF_KW,
          referenceAcKw: acInverterCapacityKw,
        }
      : rep?.siteCalibration?.inverterCoeffs ?? null;
  const hourlyShadeFactors = useCalibratedTwin
    ? (rep?.siteCalibration?.hourlyShadeFactors ?? kanpurMonthly?.hourlyShadeFactors ?? null)
    : null;
  const panelTechPreset = s.panelTechPreset || 'mono_perc';
  const thermalCoeffPerC =
    Number(s.thermalCoeffPerC) > 0 ? Number(s.thermalCoeffPerC) : SOLAR_CONSTANTS.THERMAL_COEFF_PER_C;
  const basePrAtStc =
    Number(s.basePrAtStc) > 0 ? Number(s.basePrAtStc) : SOLAR_CONSTANTS.BASE_PR_AT_STC;
  const inverterEfficiency =
    Number(s.inverterEfficiency) > 0
      ? Number(s.inverterEfficiency)
      : SOLAR_CONSTANTS.INVERTER_EFFICIENCY;
  const panelDegradationPctYr =
    Number(s.panelDegradationPctYr) > 0
      ? Number(s.panelDegradationPctYr)
      : SOLAR_CONSTANTS.DEFAULT_DEGRADATION_PCT_YR;
  const co2FactorKgPerKwh =
    Number(s.co2KgPerKwh) > 0 ? Number(s.co2KgPerKwh) : SOLAR_CONSTANTS.CO2_KG_PER_KWH;
  const washRecommendPct =
    Number(s.washRecommendPct) >= 3 ? Number(s.washRecommendPct) : SOLAR_CONSTANTS.DEFAULT_WASH_RECOMMEND_PCT;
  const rainResetDailyMm =
    Number(s.rainResetDailyMm) >= 1 ? Number(s.rainResetDailyMm) : SOLAR_CONSTANTS.DEFAULT_RAIN_RESET_DAILY_MM;
  const offlineDelayMinutes =
    Number(s.offlineDelayMinutes) >= 5 ? Number(s.offlineDelayMinutes) : 30;
  const underperformanceThresholdPct =
    Number(s.underperformanceThresholdPct) >= 60 ? Number(s.underperformanceThresholdPct) : 82;
  const weatherCacheTtlMin =
    Number(s.weatherCacheTtlMin) >= 5 ? Number(s.weatherCacheTtlMin) : 12;

  const rawEtotalCfg = Number(s.physicalEtotalKwh);
  const physicalEtotalKwh = Number.isFinite(rawEtotalCfg) && rawEtotalCfg > 0 ? +rawEtotalCfg.toFixed(2) : null;
  const rawCloudRefCfg = Number(s.physicalEtotalCloudRefKwh);
  const physicalEtotalCloudRefKwh =
    physicalEtotalKwh !== null && Number.isFinite(rawCloudRefCfg) && rawCloudRefCfg >= 0
      ? +rawCloudRefCfg.toFixed(2)
      : null;
  const physicalEtotalSetAtYmd =
    physicalEtotalKwh !== null &&
    typeof s.physicalEtotalSetAtYmd === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.physicalEtotalSetAtYmd)
      ? s.physicalEtotalSetAtYmd
      : null;
  const physicalEtotalSetAtMin =
    physicalEtotalKwh !== null && Number.isFinite(Number(s.physicalEtotalSetAtMin))
      ? Math.max(0, Math.min(1440, Math.round(Number(s.physicalEtotalSetAtMin))))
      : null;

  const rawEmonthCfg = Number(s.physicalEmonthKwh);
  const physicalEmonthKwh = Number.isFinite(rawEmonthCfg) && rawEmonthCfg > 0 ? +rawEmonthCfg.toFixed(2) : null;
  const rawEmonthCloudRef = Number(s.physicalEmonthCloudRefKwh);
  const physicalEmonthCloudRefKwh =
    physicalEmonthKwh !== null && Number.isFinite(rawEmonthCloudRef) && rawEmonthCloudRef >= 0
      ? +rawEmonthCloudRef.toFixed(2)
      : null;
  const physicalEmonthYm =
    physicalEmonthKwh !== null &&
    typeof s.physicalEmonthYm === 'string' &&
    /^\d{4}-\d{2}$/.test(s.physicalEmonthYm)
      ? s.physicalEmonthYm
      : null;
  const physicalEmonthSetAtYmd =
    physicalEmonthKwh !== null &&
    typeof s.physicalEmonthSetAtYmd === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.physicalEmonthSetAtYmd)
      ? s.physicalEmonthSetAtYmd
      : null;
  const physicalEmonthSetAtMin =
    physicalEmonthKwh !== null && Number.isFinite(Number(s.physicalEmonthSetAtMin))
      ? Math.max(0, Math.min(1440, Math.round(Number(s.physicalEmonthSetAtMin))))
      : null;
  const manualGridOffDates = Array.isArray(s.manualGridOffDates)
    ? Array.from(
        new Set(
          s.manualGridOffDates
            .map((d) => String(d || '').trim())
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        )
      ).sort()
    : [];
  const manualGridOffSet = new Set(manualGridOffDates);

  const effectiveAzimuthDeg =
    useCalibratedTwin &&
    typeof rep?.siteCalibration?.effectiveAzimuthDeg === 'number' &&
    Number.isFinite(rep.siteCalibration.effectiveAzimuthDeg)
      ? rep.siteCalibration.effectiveAzimuthDeg
      : arrayAzimuthDeg;
  const gtiReferenceAzimuthDeg = w?.azimuthDegrees ?? w?.location?.azimuthDegrees ?? arrayAzimuthDeg;

  const physicsOverrides = {
    dcCapacityKwp,
    acInverterCapacityKw,
    arrayTiltDeg,
    arrayAzimuthDeg: effectiveAzimuthDeg,
    gtiReferenceAzimuthDeg,
    mountingType,
    roofAlbedo,
    dcCleanFactor,
    thermalCoeffPerC,
    basePrAtStc,
    inverterEfficiency,
    kSite: kSiteApplied,
    inverterLossCoeffs,
    hourlyShadeFactors,
  };

  // 1. Astronomical Sun & Today Sunrise/Sunset Context
  const astro = computeAstronomicalSunTimes(lat, lon, clock.ymd);
  const fcSunriseMin = parseIsoClockMinutes(w?.todayForecast?.sunrise);
  const fcSunsetMin = parseIsoClockMinutes(w?.todayForecast?.sunset);
  const sunriseMin = fcSunriseMin ?? astro.sunriseMin;
  const sunsetMin = fcSunsetMin ?? astro.sunsetMin;
  const solarNoonMin = Math.round((sunriseMin + sunsetMin) / 2);
  const daylightMinutes = Math.max(0, sunsetMin - sunriseMin);

  const sunriseText = formatMinutes12hUpper(sunriseMin);
  const sunsetText = formatMinutes12hUpper(sunsetMin);
  const solarNoonText = formatMinutes12hUpper(solarNoonMin);
  const daylightDurationText = formatDurationHm(daylightMinutes);

  const isPreSunrise = clock.totalMinutes < sunriseMin;
  const isAfterSunset = clock.totalMinutes > sunsetMin;
  const isNight = isPreSunrise || isAfterSunset;

  // 2. Weather Current & Dynamic Effective PR
  const rawTempC = w?.current?.temperature ?? null;
  const windKmh = w?.current?.windSpeed ?? 6;
  const cloudPct = w?.current?.cloudCover ?? w?.todayForecast?.cloudCover ?? null;
  const shortwaveWm2 = Math.max(0, Number(w?.current?.shortwaveRadiation ?? 0));
  const gtiWm2 = Math.max(0, Number(w?.current?.globalTiltedIrradiance ?? shortwaveWm2));
  const dniWm2 = Math.max(0, Number(w?.current?.directNormalIrradiance ?? 0));
  const diffuseWm2 = Math.max(0, Number(w?.current?.diffuseRadiation ?? 0));
  const directWm2 = Math.max(0, Number(w?.current?.directRadiation ?? 0));

  const pm10Now =
    rep?.soiling?.currentSnapshot?.pm10 ?? w?.current?.pm10 ?? w?.todayForecast?.pm10 ?? 75;
  const pm25Now = rep?.soiling?.currentSnapshot?.pm25 ?? w?.current?.pm25 ?? 0;
  const usAqiNow =
    rep?.soiling?.currentSnapshot?.usAqi ?? w?.current?.usAqi ?? w?.todayForecast?.usAqi ?? 0;
  const aodNow =
    rep?.soiling?.currentSnapshot?.aod ??
    w?.current?.aerosolOpticalDepth ??
    w?.todayForecast?.aerosolOpticalDepth ??
    0.45;
  const precipNow = Number(w?.current?.precipitation ?? w?.todayForecast?.precipitationSum ?? 0);

  // 3. Unified Soiling & Surface Loss
  const monthDays = Array.isArray(input.monthDays) ? input.monthDays : [];
  const rawCachedSoil = input.cachedSoiling ?? null;
  const cachedCleanYmd = rawCachedSoil?.lastClean?.ymd || null;
  const isCachedSoilValid =
    Boolean(rawCachedSoil) &&
    (!input.lastCleanedDate || !cachedCleanYmd || cachedCleanYmd >= input.lastCleanedDate);
  const soilRep = rep?.soiling || (isCachedSoilValid ? rawCachedSoil : null);
  const soilSource: 'intelligence' | 'cached_intelligence' | 'weather_baseline' = rep?.soiling
    ? 'intelligence'
    : soilRep
      ? 'cached_intelligence'
      : 'weather_baseline';

  const surfaceLossPct = Number.isFinite(Number(soilRep?.surfaceLossPct))
    ? Number(soilRep!.surfaceLossPct)
    : Number.isFinite(Number(w?.todayForecast?.currentSurfaceLossPct))
      ? Number(w!.todayForecast!.currentSurfaceLossPct)
      : 0;

  const fallbackLastWashYmd = input.lastCleanedDate || commissioningYmd;
  const fallbackDaysSince = Math.max(0, diffYmdDays(clock.ymd, fallbackLastWashYmd));
  const fallbackNeedsWash = surfaceLossPct >= washRecommendPct;
  const fallbackDewActive =
    Number(w?.current?.temperature ?? 24) - Number(w?.todayForecast?.dewPoint ?? 14) <= 1.5 ||
    (precipNow >= 0.2 && precipNow <= 1.5);

  const soiling = {
    surfaceLossPct: +surfaceLossPct.toFixed(1),
    actionState:
      soilRep?.actionState ||
      (fallbackNeedsWash ? 'WASH_NOW' : surfaceLossPct > 3.0 ? 'MODERATE' : 'CLEAN'),
    actionBadgeText:
      soilRep?.actionBadgeText ||
      (fallbackNeedsWash ? 'Wash Due' : surfaceLossPct > 3.0 ? 'Light Dust' : 'Clean'),
    actionHeadline:
      soilRep?.actionHeadline ||
      (fallbackNeedsWash
        ? `Panel Wash Recommended (-${surfaceLossPct.toFixed(1)}%)`
        : surfaceLossPct > 3.0
          ? `Light Dust Film (-${surfaceLossPct.toFixed(1)}%)`
          : 'Panels Clean'),
    actionAdvice:
      soilRep?.actionAdvice ||
      `PM10 ${Math.round(Number(pm10Now) || 0)} μg/m³ · Surface loss -${surfaceLossPct.toFixed(1)}%`,
    daysSinceWash: soilRep?.lastClean?.daysAgo ?? fallbackDaysSince,
    lastWashYmd: soilRep?.lastClean?.ymd || fallbackLastWashYmd,
    stickyFilmActive: Boolean(soilRep?.stickyFilmActive ?? fallbackDewActive),
    looseLossPct: soilRep?.looseLossPct,
    cementedLossPct: soilRep?.cementedLossPct,
    dewNightsCount: soilRep?.statsSinceWash?.dewNightsCount,
    hasRainHold: Boolean(soilRep?.incomingRainHold),
    recoverableKwhPerDay: soilRep?.recoverableKwhPerDay ?? 0,
    recoverableInrPerWeek: soilRep?.recoverableInrPerWeek ?? 0,
    aod: +Number(aodNow).toFixed(2),
    pm10: Math.round(Number(pm10Now) || 0),
    pm25: Math.round(Number(pm25Now) || 0),
    usAqi: Math.round(Number(usAqiNow) || 0),
    dewActiveNow: Boolean(soilRep?.currentSnapshot?.dewActiveNow ?? fallbackDewActive),
    source: soilSource,
  };

  const effectivePrRes = computeEffectiveSolarPr({
    ambientTempC: rawTempC ?? 25,
    windSpeedKmh: windKmh,
    gtiWm2: gtiWm2 > 0 ? gtiWm2 : w?.todayForecast?.irradianceGti ?? 0,
    surfaceLossPct,
    aod: aodNow,
    pm10: pm10Now,
    pm25: pm25Now,
    ...physicsOverrides,
  });

  // 4. Today Physics Curve
  const todayPhysicsRaw = computeTodayPhysicsAtMinute(
    w,
    capacityKwp,
    clock.totalMinutes,
    surfaceLossPct,
    physicsOverrides
  );
  const daylightElapsedPct =
    daylightMinutes > 0
      ? Math.max(0, Math.min(100, Math.round(((clock.totalMinutes - sunriseMin) / daylightMinutes) * 100)))
      : 0;
  const fullDayTargetKwh = todayPhysicsRaw.model.targetDailyModelKwh;
  const progressPctOfDayModel =
    fullDayTargetKwh > 0
      ? Math.max(0, Math.min(100, Math.round((todayPhysicsRaw.current.cumKwh / fullDayTargetKwh) * 100)))
      : 0;

  // 5. Raw Waaree Inputs & Monotonic Cloud Reference before Truth Gate
  const resolvedFlow: LiveFlowData | null =
    flow && typeof flow === 'object' && 'result' in flow && flow.result
      ? flow.result
      : (flow as LiveFlowData | null | undefined) ?? null;

  const rawSolarKw = Number(resolvedFlow?.node?.solar?.power?.value) || 0;
  const rawDeviceKw = Number(resolvedFlow?.node?.device?.power?.value) || 0;
  const rawGenNode = (resolvedFlow?.node as Record<string, { power?: { value?: string } } | undefined> | undefined)?.gen;
  const rawGenKw = Number(rawGenNode?.power?.value) || 0;
  const rawGenerationKw = rawDeviceKw > 0 ? rawDeviceKw : rawGenKw > 0 ? rawGenKw : rawSolarKw;

  const curveWin = computeTrapezoidalCurveWindow(input.todayRaw, acInverterCapacityKw, sunriseMin);
  const monthDayTodayVal = monthDays.find((d) => d.index === clock.day)?.value ?? 0;
  const rawYieldTodayKwh = +Math.max(
    Number(resolvedFlow?.status?.yieldToday || 0),
    Number(summary?.generationToday || 0),
    monthDayTodayVal,
    curveWin.curveKwh
  ).toFixed(2);
  const deviceState = Number(resolvedFlow?.status?.state ?? 1);
  const lastUpdateStr = resolvedFlow?.status?.lastUpdateDate || summary?.lastUpdateDate || '';
  const realElect = input.realElectrical || null;
  const rVolt = realElect?.grid?.r?.volt ?? getSeriesNumericValue(input.todayRaw, ['rVolt', 'gridVolt', 'pv1Volt']);
  const rFreq = realElect?.grid?.r?.freqHz ?? getSeriesNumericValue(input.todayRaw, ['rFreq', 'gridFreq']);

  const todayRadMj = w?.todayForecast?.radiationMjM2 ?? 15.33;
  const sunContext: TelemetrySunContext = {
    sunriseMin,
    sunsetMin,
    sunriseText,
    sunsetText,
    todayEstKwh: fullDayTargetKwh,
    todayRadMj,
    nowMinutesIst: clock.totalMinutes,
    capacityKwp,
    hasTodayActiveCurve: curveWin.curveKwh > 0.05 || rawYieldTodayKwh > 0.05,
    todayCurveKwh: curveWin.curveKwh,
  };

  const baseTruth = evaluateTelemetryTruth(
    lastUpdateStr,
    rawGenerationKw,
    rawYieldTodayKwh,
    deviceState,
    rVolt,
    rFreq,
    input.simState ?? 'auto',
    sunContext
  );

  const isGridActuallyDown = rawGenerationKw <= 0.05 && (rVolt < 180 || rFreq < 45);
  if (input.alarms?.activeGridDropAlarm && isGridActuallyDown) {
    baseTruth.status = 'GRID_OUTAGE';
    baseTruth.statusHeadline = `Hardware Alarm: ${input.alarms.activeGridDropAlarm.content} (Code ${input.alarms.activeGridDropAlarm.code})`;
    baseTruth.reassuranceBanner = `Utility outage confirmed by inverter: ${input.alarms.activeGridDropAlarm.content}. Anti-islanding contactors opened safely.`;
  }

  const isTruthOnline =
    baseTruth.status === 'LIVE' || baseTruth.status === 'WARMUP' || baseTruth.status === 'DELAYED';
  const isTruthStale = baseTruth.status === 'OFFLINE_STALE';
  const isTruthNight = baseTruth.status === 'NIGHT_SLEEP';
  const isTruthFault = baseTruth.status === 'FAULT' || baseTruth.status === 'GRID_OUTAGE';

  const truth = {
    ...baseTruth,
    isOnline: isTruthOnline,
    isStale: isTruthStale,
    isNight: isTruthNight,
    isFault: isTruthFault,
  };

  // 6. Today Real vs Curve vs Option B Unbroken Buffer + Hybrid Stitch
  const lastUpdateMinIst =
    baseTruth.isFromToday && lastUpdateStr
      ? getIstClockParts(parseTelemetryDate(lastUpdateStr)).totalMinutes
      : null;
  const isNightPostSunsetConfirmed =
    isTruthNight &&
    baseTruth.isFromToday &&
    !isPreSunrise &&
    rawYieldTodayKwh > 0.05 &&
    (baseTruth.isDataTrustworthy ||
      (lastUpdateMinIst !== null && lastUpdateMinIst >= sunsetMin - 15) ||
      (curveWin.endMin !== null && curveWin.endMin >= sunsetMin - 20));
  const isTodayConfirmed =
    (isTruthOnline || isNightPostSunsetConfirmed) && baseTruth.isFromToday && !isPreSunrise;
  const realYieldFromCurveKwh = curveWin.curveKwh;
  const isPartialCurve =
    isTodayConfirmed &&
    rawYieldTodayKwh > realYieldFromCurveKwh + 0.45 &&
    ((curveWin.startMin !== null && curveWin.startMin > sunriseMin + 35) ||
      realYieldFromCurveKwh < rawYieldTodayKwh * 0.9);

  const stitch = computeHybridTodayStitch({
    isTodayConfirmed,
    isPreSunrise,
    isAfterSunset,
    rawYieldTodayKwh,
    lastUpdateInput: lastUpdateStr,
    truthIsFromToday: baseTruth.isFromToday,
    todayModel: todayPhysicsRaw.model,
    nowMinutesIst: clock.totalMinutes,
  });

  const todayNowcast = computeLiveNowcastingBlend({
    baseModel: todayPhysicsRaw.model,
    rawSeries: input.todayRaw,
    isOnline: isTodayConfirmed,
    isAfterSunset,
    nowMinutesIst: clock.totalMinutes,
    acCapacityKw: acInverterCapacityKw,
    hourlyCloudCover: w?.hourly?.cloudCover,
  });

  const parsedTodayTelemetry = parseRawTelemetry(input.todayRaw || [], sunriseMin, sunsetMin);
  const ledgerToday = rep?.dailyLedger?.find((d) => d.ymd === clock.ymd);
  const todayGapClassification =
    !isPreSunrise
      ? classifyDayGapArchitecture({
          parsed: parsedTodayTelemetry,
          physicsModel: todayPhysicsRaw.model,
          eepromKwh: rawYieldTodayKwh,
          surfaceLossPct,
          ymd: clock.ymd,
          todayYmd: clock.ymd,
          commissioningYmd,
          nowMinutesIst: clock.totalMinutes,
          isManualGridOff: manualGridOffSet.has(clock.ymd),
          isWifiOfflineFullDay:
            !isTodayConfirmed && !isPreSunrise && clock.totalMinutes > sunriseMin + 45,
        })
      : null;

  const todayCloudKwh = +(isTodayConfirmed ? rawYieldTodayKwh : stitch.confirmedPartKwh).toFixed(2);
  const rawTodayBufferKwh = todayGapClassification
    ? +todayGapClassification.bufferKwh.toFixed(2)
    : typeof ledgerToday?.bufferKwh === 'number'
      ? +ledgerToday.bufferKwh.toFixed(2)
      : 0;
  const todayEepromConfirmedGapKwh = todayGapClassification
    ? +todayGapClassification.eepromConfirmedPreKwh.toFixed(2)
    : 0;
  const todayBufferKwh = manualGridOffSet.has(clock.ymd)
    ? 0
    : !isTodayConfirmed && todayCloudKwh <= 0.05 && rawTodayBufferKwh <= 0.05
      ? +Math.max(0, stitch.stitchedSatDeltaKwh).toFixed(2)
      : rawTodayBufferKwh;
  const todayDisplayKwh = +(todayCloudKwh + todayBufferKwh).toFixed(2);
  const nowcastDeltaRemainingKwh =
    isTodayConfirmed && !isPreSunrise && !isAfterSunset && todayNowcast.active
      ? todayNowcast.blendedRemainingKwh - todayNowcast.baseRemainingKwh
      : 0;
  const adjustedFullDayTargetKwh = +(
    Math.max(todayDisplayKwh, fullDayTargetKwh + nowcastDeltaRemainingKwh)
  ).toFixed(1);
  const todayIsEstimated =
    !isTodayConfirmed && !(isTruthNight && isAfterSunset && stitch.confirmedPartKwh > 0);
  const effectiveLiveKw = baseTruth.safeGenerationKw ?? 0;
  const todayLiveKw = isTruthNight
    ? 0
    : isTodayConfirmed
      ? effectiveLiveKw
      : todayPhysicsRaw.current.kw;
  const progressPctOfTarget =
    adjustedFullDayTargetKwh > 0
      ? Math.min(150, Math.round((todayDisplayKwh / adjustedFullDayTargetKwh) * 100))
      : 0;

  // 7. Hero State + Yesterday + Month + Two-Pocket Water-Fill Reconciliation
  const heroStatusLabel = resolveHeroStatusLabel({
    isTruthNight,
    isTruthFault,
    isTruthStale,
    isTruthOnline,
  });

  const yesterdayRollup = buildYesterdayRollup({
    clock,
    monthDays,
    prevMonthDays: input.prevMonthDays,
    summary,
    baseTruthIsFromToday: baseTruth.isFromToday,
    baseTruthYesterdayFinalYieldKwh: baseTruth.yesterdayFinalYieldKwh,
    rep,
    weatherData: w,
    capacityKwp,
    lat,
    lon,
    surfaceLossPct,
    aodNow,
    fullDayTargetKwh,
    physicsOverrides,
    tariffPerKwh,
    lastSyncedDay: input.lastSyncedDay,
  });

  const monthRollup = buildMonthMetricsRollup({
    clock,
    monthDays,
    summary,
    isTodayConfirmed,
    rawYieldTodayKwh,
    commissioningYmd,
    commissioningDisplay,
    fullDayTargetKwh,
    lastSyncedDay: input.lastSyncedDay,
  });

  if (!yesterdayRollup.yesterday.lastSyncedLabel && monthRollup.maxSyncedDayIdx > 0) {
    yesterdayRollup.yesterday.lastSyncedLabel = `${clock.monthShort} ${monthRollup.maxSyncedDayIdx}`;
  }

  const wf = reconcileWaterFillBuffers({
    clock,
    ymdYest: yesterdayRollup.ymdYest,
    yestIsConfirmed: yesterdayRollup.yestIsConfirmed,
    isTodayConfirmed,
    todayBufferKwh,
    todayCloudKwh,
    todayGapClassification,
    rep,
    summary,
    monthDaysSum: monthRollup.monthDaysSum,
    resolvedMonthCloudKwh: monthRollup.resolvedMonthCloudKwh,
    mtdKwh: monthRollup.mtdKwh,
    tariffPerKwh,
    co2FactorKgPerKwh,
    manualGridOffSet,
    physicalEmonthKwh,
    physicalEmonthCloudRefKwh,
    physicalEmonthYm,
    physicalEmonthSetAtYmd,
    physicalEmonthSetAtMin,
    physicalEtotalKwh,
    physicalEtotalCloudRefKwh,
    physicalEtotalSetAtYmd,
    physicalEtotalSetAtMin,
  });

  const { discomCycle, roi } = buildDiscomAndRoiRollup({
    clock,
    monthDays,
    prevMonthDays: input.prevMonthDays,
    billingCycleDay,
    tariffPerKwh,
    commissioningYmd,
    monthDayTodayVal: monthRollup.monthDayTodayVal,
    todayCloudKwh,
    isTodayConfirmed,
    dailyAvgKwh: monthRollup.dailyAvgKwh,
    reconciledBufferByYmd: wf.reconciledBufferByYmd,
    systemCost,
    confirmedLifetimeKwh: wf.confirmedLifetimeKwh,
    physicalLifetimeSavingsInr: wf.physicalLifetimeSavingsInr,
    capacityKwp,
  });

  const tomClock = shiftIstFromYmd(clock.ymd, 1);
  const tomOut = rep?.tomorrowOutlook;
  const tomFc = w?.tomorrowForecast;
  const tomorrowExpectedKwh = +(
    tomOut?.asIsExpectedKwh ??
    tomFc?.expectedYieldKwh ??
    fullDayTargetKwh
  ).toFixed(1);

  const directDiffuse = resolveDirectDiffuseOptics({
    isNight,
    shortwaveWm2,
    gtiWm2,
    dniWm2,
    directWm2,
    diffuseWm2,
    sunriseText,
  });

  const thermalAndElectrical = resolveThermalAndElectrical({
    isNight,
    isTodayConfirmed,
    rawTempC,
    tempUnit,
    effectiveCellTempC: effectivePrRes.cellTempC,
    tempFactor: effectivePrRes.tempFactor,
    pr: effectivePrRes.pr,
    inverterEta: effectivePrRes.inverterEta,
    rawSolarKw: realElect?.dc?.totalDcKw ?? rawSolarKw,
    rawDeviceKw: realElect?.grid?.totalAcKw ?? rawDeviceKw,
    rawGenKw,
    rVolt,
    rFreq,
    theoreticalKwAtIrradiance: todayPhysicsRaw.current.kw,
    resolvedFlow,
  });

  const { recent7Daily, sunEfficiencyScore } = buildRecent7AndSunScore({
    clock,
    rep,
    reconciledBufferByYmd: wf.reconciledBufferByYmd,
    todayCloudKwh,
    todayDisplayKwh,
    todayIsEstimated,
    monthDays,
    prevMonthDays: input.prevMonthDays,
    fullDayTargetKwh,
    tariffPerKwh,
    capacityKwp,
  });

  const reportCard = resolveReportCard({
    capacityKwp,
    effectiveTodayDisplayKwh: wf.effectiveTodayDisplayKwh,
    peakKw: todayPhysicsRaw.model.peakKw,
    peakTimeText: todayPhysicsRaw.model.peakTimeText,
    tomorrowExpectedKwh,
    tariffPerKwh,
    co2FactorKgPerKwh,
    lifetimeTrees: wf.lifetimeEnv.trees,
  });

  return {
    clock,
    config: {
      capacityKwp,
      dcCapacityKwp,
      acInverterCapacityKw,
      mountingType,
      roofAlbedo,
      dcCleanFactor,
      useCalibratedTwin,
      kSiteApplied,
      tariffPerKwh,
      systemCost,
      billingCycleDay,
      tempUnit,
      lat,
      lon,
      locationName,
      plantDisplayName,
      commissioningYmd,
      commissioningDisplay,
      arrayTiltDeg,
      arrayAzimuthDeg,
      panelTechPreset,
      thermalCoeffPerC,
      basePrAtStc,
      inverterEfficiency,
      panelDegradationPctYr,
      washRecommendPct,
      rainResetDailyMm,
      offlineDelayMinutes,
      underperformanceThresholdPct,
      weatherCacheTtlMin,
      physicalEtotalKwh,
      physicalEtotalCloudRefKwh,
      physicalEtotalSetAtYmd,
      physicalEtotalSetAtMin,
      physicalEmonthKwh,
      physicalEmonthCloudRefKwh,
      physicalEmonthYm,
      physicalEmonthSetAtYmd,
      physicalEmonthSetAtMin,
      manualGridOffDates,
      co2FactorKgPerKwh,
      coalFactorKgPerKwh: SOLAR_CONSTANTS.COAL_KG_PER_KWH,
      treeCo2KgPerYear: SOLAR_CONSTANTS.CO2_KG_PER_TREE_YEAR,
      physicsOverrides,
    },
    sun: {
      ...sunContext,
      solarNoonMin,
      solarNoonText,
      daylightMinutes,
      daylightDurationText,
      isPreSunrise,
      isAfterSunset,
      isNight,
      isDaylightWindow: !isNight,
    },
    soiling,
    weatherNow: {
      tempC: rawTempC,
      tempDisplayVal: convertTemperature(rawTempC, tempUnit),
      tempFormatted: formatTemperature(rawTempC, tempUnit, 0),
      tempExactFormatted: formatTemperature(rawTempC, tempUnit, 1),
      humidityPct: w?.current?.humidity ?? null,
      windSpeedKmh: w?.current?.windSpeed ?? null,
      cloudCoverPct: cloudPct,
      shortwaveWm2: Math.round(shortwaveWm2),
      gtiWm2: Math.round(gtiWm2),
      dniWm2: Math.round(dniWm2),
      diffuseWm2: Math.round(diffuseWm2),
      directWm2: Math.round(directWm2),
      conditionLabel:
        input.weatherCondition?.label ||
        w?.todayForecast?.condition ||
        (isNight ? 'Clear Night' : 'Clear Sky'),
      conditionType:
        input.weatherCondition?.type || w?.todayForecast?.conditionType || 'sunny',
    },
    effectivePrBreakdown: {
      pr: effectivePrRes.pr,
      prPct: +(effectivePrRes.pr * 100).toFixed(1),
      dcPrPct: +(effectivePrRes.dcPr * 100).toFixed(1),
      inverterEffPct: +(effectivePrRes.inverterEta * 100).toFixed(1),
      cellTempC: effectivePrRes.cellTempC,
      cellTempFormatted: formatTemperature(effectivePrRes.cellTempC, tempUnit, 1),
      tempFactor: effectivePrRes.tempFactor,
      surfaceFactor: effectivePrRes.surfaceFactor,
      smogFactor: effectivePrRes.smogFactor,
      smogLossPct: +(effectivePrRes.smogLossFrac * 100).toFixed(1),
    },
    todayPhysics: {
      model: todayPhysicsRaw.model,
      nowcast: todayNowcast,
      current: {
        kwNow: todayPhysicsRaw.current.kw,
        cumKwh: todayPhysicsRaw.current.cumKwh,
        gti: todayPhysicsRaw.current.gti,
        progressPctOfDay: progressPctOfDayModel,
        daylightElapsedPct,
      },
    },
    truth,
    hero: {
      displayedKw: +(isTruthNight ? 0 : todayLiveKw).toFixed(2),
      peakKw: todayPhysicsRaw.model.peakKw,
      peakTimeText: todayPhysicsRaw.model.peakTimeText,
      statusLabel: heroStatusLabel,
      isEstimated: isTruthStale && !isTruthNight,
      isNight: isTruthNight,
    },
    today: {
      displayKwh: wf.effectiveTodayDisplayKwh,
      cloudKwh: todayCloudKwh,
      bufferKwh: wf.effectiveTodayBufferKwh,
      eepromConfirmedGapKwh: todayEepromConfirmedGapKwh,
      suspectedGridCut: Boolean(todayGapClassification?.suspectedGridCut),
      isManualGridOff: manualGridOffSet.has(clock.ymd),
      rawConfirmedKwh: +rawYieldTodayKwh.toFixed(1),
      fullDayTargetKwh: adjustedFullDayTargetKwh,
      expectedKwNow: todayPhysicsRaw.current.kw,
      liveKw: +todayLiveKw.toFixed(2),
      expectedSoFarKwh: todayPhysicsRaw.current.cumKwh,
      realYieldFromCurveKwh,
      curveStartLabel: curveWin.startLabel,
      curveEndLabel: curveWin.endLabel,
      isPartialCurve,
      progressPctOfTarget,
      daylightElapsedPct,
      savingsInr: +(wf.effectiveTodayDisplayKwh * tariffPerKwh).toFixed(2),
      expectedSavingsInr: Math.round(adjustedFullDayTargetKwh * tariffPerKwh),
      isEstimated: todayIsEstimated,
      isConfirmed: isTodayConfirmed,
      isHybridStitched: stitch.isHybridStitched,
      confirmedPartKwh: stitch.confirmedPartKwh,
      stitchedSatDeltaKwh: stitch.stitchedSatDeltaKwh,
      lastSyncMinIst: stitch.lastSyncMinIst,
      isNightAwaitStart: isPreSunrise,
      isNightDone: isAfterSunset,
    },
    yesterday: yesterdayRollup.yesterday,
    month: {
      mtdKwh: monthRollup.mtdKwh,
      unloggedKwh: wf.unloggedMonthKwh,
      physicalTotalKwh: wf.physicalMonthTotalKwh,
      isEmonthAnchored: wf.isEmonthAnchored,
      hardwareSource: wf.effMonthSource,
      eMonthAnchorKwh: wf.isEmonthAnchored ? wf.effMonthKwh : null,
      eMonthAnchorDeltaKwh: wf.eMonthAnchorDeltaKwh,
      eMonthSetAtYmd: wf.isEmonthAnchored ? wf.effMonthSetAtYmd : null,
      eMonthSyncedLabel: wf.isEmonthAnchored ? wf.effMonthSyncedLabel : null,
      confirmedDaysSumKwh: +monthRollup.monthDaysSum.toFixed(1),
      savingsInr: Math.round(monthRollup.mtdKwh * tariffPerKwh),
      savingsFormatted: formatINR(Math.round(monthRollup.mtdKwh * tariffPerKwh)),
      physicalSavingsInr: wf.physicalMonthSavingsInr,
      physicalSavingsFormatted: wf.physicalMonthSavingsFormatted,
      dailyAvgKwh: monthRollup.dailyAvgKwh,
      activeSyncedDaysCount: monthRollup.activeSyncedDaysCount,
      elapsedDaysInMonth: monthRollup.elapsedDaysInMonth,
      daysInMonth: clock.daysInMonth,
      pendingDaysCount: monthRollup.pendingDaysCount,
      syncedThroughLabel: monthRollup.syncedThroughLabel,
      progressPctOfMonth: Math.min(100, Math.round((clock.day / clock.daysInMonth) * 100)),
      bestDayNum: monthRollup.bestDayNum,
      bestDayLabel: monthRollup.bestDayLabel,
      bestDayKwh: monthRollup.bestDayKwh,
      projectedKwh: monthRollup.projectedKwh,
      projectedSavingsInr: Math.round(monthRollup.projectedKwh * tariffPerKwh),
    },
    lifetime: {
      confirmedKwh: wf.confirmedLifetimeKwh,
      unloggedKwh: wf.unloggedLifetimeKwh,
      physicalTotalKwh: wf.physicalLifetimeKwh,
      savingsInr: roi.totalSavedInr,
      savingsFormatted: formatINR(roi.totalSavedInr),
      physicalSavingsInr: wf.physicalLifetimeSavingsInr,
      physicalSavingsFormatted: wf.physicalLifetimeSavingsFormatted,
      isEtotalAnchored: wf.isEtotalAnchored,
      hardwareSource: wf.effTotalSource,
      eTotalAnchorKwh: wf.isEtotalAnchored ? wf.effTotalKwh : null,
      eTotalAnchorDeltaKwh: wf.eTotalAnchorDeltaKwh,
      eTotalSetAtYmd: wf.isEtotalAnchored ? wf.effTotalSetAtYmd : null,
      eTotalSyncedLabel: wf.isEtotalAnchored ? wf.effTotalSyncedLabel : null,
      commissioningYmd,
      commissioningDisplay,
    },
    environmental: {
      lifetime: wf.lifetimeEnv,
      lifetimePhysical: wf.lifetimePhysicalEnv,
      month: wf.monthEnv,
    },
    discomCycle,
    roi,
    tomorrow: {
      ymd: tomFc?.dateYmd || tomOut?.ymd || tomClock.ymd,
      shortLabel: tomOut?.shortLabel || tomClock.shortLabel,
      expectedKwh: tomorrowExpectedKwh,
      expectedSavingsInr: Math.round(tomorrowExpectedKwh * tariffPerKwh),
      condition: tomOut?.condition || tomFc?.condition || 'Clear Sky',
      conditionType: tomOut?.conditionType || tomFc?.conditionType || 'sunny',
      sunshineHours: tomOut?.sunshineHours ?? tomFc?.sunshineDurationHours ?? 10.5,
      tempMinFormatted: formatTemperature(tomOut?.tempMin ?? tomFc?.minTemp ?? null, tempUnit, 1),
      tempMaxFormatted: formatTemperature(tomOut?.tempMax ?? tomFc?.maxTemp ?? null, tempUnit, 1),
      peakKw: tomOut?.peakKw ?? todayPhysicsRaw.model.peakKw,
      peakTimeLabel: tomOut?.peakTimeLabel || todayPhysicsRaw.model.peakTimeText,
      peakWindowStart: tomOut?.peakWindowStart || '09:15 AM',
      peakWindowEnd: tomOut?.peakWindowEnd || '02:55 PM',
      skyBadgeText: tomOut?.skyBadgeText || 'Clear Dawn',
    },
    directDiffuse,
    thermalAndElectrical,
    recent7Daily,
    sunEfficiencyScore,
    reportCard,
    reconciledBufferByYmd: wf.reconciledBufferByYmd,
    realElectrical: realElect,
    alarms: input.alarms || null,
  };
}
