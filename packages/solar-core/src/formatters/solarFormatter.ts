import {
  getIstClockParts,
  formatIndianDate,
  daysInIstMonth,
  diffYmdDays,
  parseYmdParts,
  shiftYm,
  shiftYmdDays,
} from '../time/istDate.ts';
import {
  SOLAR_CONSTANTS,
  computeAstronomicalSunTimes,
  computeEffectiveSolarPr,
  computeEnvironmentEquivalents,
  formatMinutes12hUpper,
  parseIsoClockMinutes,
} from '../physics/index.ts';
import type { TemperatureUnit } from '../types/settings.ts';

export type { TemperatureUnit };

export interface FormattedValue {
  value: string;
  unit: string;
  full: string;
}

/**
 * Format instantaneous power in W, kW, or MW (values arrive in kW).
 */
export const formatPower = (kwValue: number | null | undefined): FormattedValue => {
  if (kwValue === null || kwValue === undefined || isNaN(kwValue)) {
    return { value: '0', unit: 'W', full: '0 W' };
  }
  const absVal = Math.abs(kwValue);
  if (absVal > 0 && absVal < 1) {
    const watts = Math.round(kwValue * 1000);
    return { value: `${watts}`, unit: 'W', full: `${watts} W` };
  }
  if (absVal >= 1000) {
    const mw = (kwValue / 1000).toFixed(2);
    return { value: mw, unit: 'MW', full: `${mw} MW` };
  }
  const kw = kwValue.toFixed(2);
  return { value: kw, unit: 'kW', full: `${kw} kW` };
};

/**
 * Format cumulative energy yield in Wh, kWh, or MWh (values arrive in kWh).
 */
export const formatEnergy = (kwhValue: number | null | undefined): FormattedValue => {
  if (kwhValue === null || kwhValue === undefined || isNaN(kwhValue)) {
    return { value: '0', unit: 'kWh', full: '0 kWh' };
  }
  const absVal = Math.abs(kwhValue);
  if (absVal > 0 && absVal < 1) {
    const wh = Math.round(kwhValue * 1000);
    return { value: `${wh}`, unit: 'Wh', full: `${wh} Wh` };
  }
  if (absVal >= 1000) {
    const mwh = (kwhValue / 1000).toFixed(2);
    return { value: mwh, unit: 'MWh', full: `${mwh} MWh` };
  }
  const kwh = kwhValue.toFixed(1);
  return { value: kwh, unit: 'kWh', full: `${kwh} kWh` };
};

/**
 * Format currency amounts in Indian numbering format (e.g. ₹1,23,456).
 */
export const formatINR = (amount: number): string => {
  if (isNaN(amount)) return '₹0';
  const rounded = Math.round(amount);
  return `₹${rounded.toLocaleString('en-IN')}`;
};

export type WeatherConditionType =
  | 'sunny'
  | 'hazy'
  | 'partly_cloudy'
  | 'cloudy'
  | 'sunrise'
  | 'sunset'
  | 'night_clear'
  | 'night_cloudy';

export interface IndianSolarPhaseInfo {
  istTime: string;
  istTimeWithSec: string;
  istDate: string;
  phase: 'pre_dawn' | 'sunrise' | 'morning' | 'midday_peak' | 'afternoon' | 'sunset' | 'night';
  phaseName: string;
  simpleCondition: string;
  conditionType: WeatherConditionType;
  temperatureC?: number;
  phaseWindow: string;
  isDaylight: boolean;
  isNight: boolean;
  sunIcon: string;
  sunDescription: string;
  sunPositionPercent: number;
  sunriseText: string;
  sunsetText: string;
  explanationForZeroPower: string;
}

/**
 * Calculates current time in Indian Standard Time (IST, UTC+5:30).
 */
export const getIndianStandardTime = (now = new Date()): Date => {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
};

/**
 * Evaluates real-time weather & solar daylight conditions across India using actual
 * per-date astronomical / Open-Meteo sunrise & sunset timestamps.
 */
export const getIndianSolarPhase = (date = new Date(), weatherData?: any): IndianSolarPhaseInfo => {
  const istParts = getIstClockParts(date);
  const hours = istParts.hours;
  const minutes = istParts.minutes;
  const totalMins = istParts.totalMinutes;

  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const timeStr = `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  const timeWithSecStr = `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    istParts.seconds
  ).padStart(2, '0')} ${ampm}`;
  const dateStr = formatIndianDate(istParts.ymd, 'weekday');

  const lat = Number(weatherData?.location?.lat) || SOLAR_CONSTANTS.DEFAULT_LAT;
  const lon = Number(weatherData?.location?.lon) || SOLAR_CONSTANTS.DEFAULT_LON;
  const fallbackSun = computeAstronomicalSunTimes(lat, lon, istParts.ymd);
  const srMin = parseIsoClockMinutes(weatherData?.todayForecast?.sunrise) ?? fallbackSun.sunriseMin;
  const ssMin = parseIsoClockMinutes(weatherData?.todayForecast?.sunset) ?? fallbackSun.sunsetMin;
  const nextSrMin = parseIsoClockMinutes(weatherData?.tomorrowForecast?.sunrise) ?? srMin;
  const srText = formatMinutes12hUpper(srMin);
  const ssText = formatMinutes12hUpper(ssMin);
  const nextSrText = formatMinutes12hUpper(nextSrMin);

  const sunriseStartMin = srMin - 25;
  const morningStartMin = srMin + 55;
  const sunsetStartMin = ssMin - 30;
  const nightStartMin = ssMin + 25;

  let sunPositionPercent = -1;
  if (totalMins >= srMin && totalMins <= ssMin) {
    sunPositionPercent = Math.min(100, Math.max(0, ((totalMins - srMin) / Math.max(1, ssMin - srMin)) * 100));
  }

  const tempC =
    weatherData?.current?.temperature !== undefined
      ? Math.round(weatherData.current.temperature)
      : undefined;
  const cloudCover = weatherData?.current?.cloudCover ?? 0;
  const shortwaveRad = weatherData?.current?.shortwaveRadiation ?? 550;

  const formatWithTemp = (condition: string) => {
    return tempC !== undefined ? `${condition} • ${tempC}°C` : condition;
  };

  if (totalMins < sunriseStartMin) {
    const isCloudy = cloudCover > 60;
    const simple = isCloudy ? 'Cloudy Night' : 'Clear Night';
    const cType: WeatherConditionType = isCloudy ? 'night_cloudy' : 'night_clear';
    return {
      istTime: timeStr,
      istTimeWithSec: timeWithSecStr,
      istDate: dateStr,
      phase: 'pre_dawn',
      phaseName: formatWithTemp(simple),
      simpleCondition: simple,
      conditionType: cType,
      temperatureC: tempC,
      phaseWindow: `12:00 AM – ${formatMinutes12hUpper(sunriseStartMin)}`,
      isDaylight: false,
      isNight: true,
      sunIcon: isCloudy ? '☁️' : '🌙',
      sunDescription: isCloudy
        ? `Passing clouds in night sky • Resumes at sunrise (${srText})`
        : `Clear night sky • Resting until sunrise (${srText})`,
      sunPositionPercent: -1,
      sunriseText: srText,
      sunsetText: ssText,
      explanationForZeroPower: `Normal night standby. Generation begins at sunrise (${srText}).`,
    };
  }

  if (totalMins < morningStartMin) {
    const simple = 'Golden Sunrise';
    return {
      istTime: timeStr,
      istTimeWithSec: timeWithSecStr,
      istDate: dateStr,
      phase: 'sunrise',
      phaseName: formatWithTemp(simple),
      simpleCondition: simple,
      conditionType: 'sunrise',
      temperatureC: tempC,
      phaseWindow: `${formatMinutes12hUpper(sunriseStartMin)} – ${formatMinutes12hUpper(morningStartMin)}`,
      isDaylight: true,
      isNight: false,
      sunIcon: '🌅',
      sunDescription: `Sunrise at ${srText} • Plant waking up & grid sync`,
      sunPositionPercent,
      sunriseText: srText,
      sunsetText: ssText,
      explanationForZeroPower: 'Early dawn low light (< 50 W). Inverter warming up and synchronizing with grid.',
    };
  }

  if (totalMins < 11 * 60) {
    let simple = 'Morning Sunshine';
    let cType: WeatherConditionType = 'sunny';
    if (cloudCover >= 70) {
      simple = 'Overcast Morning';
      cType = 'cloudy';
    } else if (cloudCover >= 30) {
      simple = 'Partly Cloudy';
      cType = 'partly_cloudy';
    } else if (shortwaveRad < 400) {
      simple = 'Hazy Sunshine';
      cType = 'hazy';
    }

    return {
      istTime: timeStr,
      istTimeWithSec: timeWithSecStr,
      istDate: dateStr,
      phase: 'morning',
      phaseName: formatWithTemp(simple),
      simpleCondition: simple,
      conditionType: cType,
      temperatureC: tempC,
      phaseWindow: `${formatMinutes12hUpper(morningStartMin)} – 11:00 AM`,
      isDaylight: true,
      isNight: false,
      sunIcon: cType === 'cloudy' ? '☁️' : cType === 'partly_cloudy' ? '🌤️' : '☀️',
      sunDescription:
        cType === 'hazy'
          ? 'Morning haze • Warm solar absorption'
          : 'Bright morning sun • Rapid generation climb',
      sunPositionPercent,
      sunriseText: srText,
      sunsetText: ssText,
      explanationForZeroPower: 'Daylight is active. If 0 kW, checking if grid power is down or Wi-Fi dongle awaiting sync.',
    };
  }

  if (totalMins < 14 * 60 + 30) {
    let simple = 'Clear & Sunny';
    let cType: WeatherConditionType = 'sunny';
    if (cloudCover >= 70) {
      simple = 'Mostly Cloudy';
      cType = 'cloudy';
    } else if (cloudCover >= 30) {
      simple = 'Partly Cloudy';
      cType = 'partly_cloudy';
    } else if (shortwaveRad < 450) {
      simple = 'Hazy Sunshine';
      cType = 'hazy';
    }

    return {
      istTime: timeStr,
      istTimeWithSec: timeWithSecStr,
      istDate: dateStr,
      phase: 'midday_peak',
      phaseName: formatWithTemp(simple),
      simpleCondition: simple,
      conditionType: cType,
      temperatureC: tempC,
      phaseWindow: '11:00 AM – 02:30 PM',
      isDaylight: true,
      isNight: false,
      sunIcon: cType === 'cloudy' ? '☁️' : cType === 'partly_cloudy' ? '🌤️' : '☀️',
      sunDescription:
        cType === 'hazy'
          ? 'Warm sun through gentle haze • High absorption'
          : 'Peak sunshine hours • Ideal solar generation',
      sunPositionPercent,
      sunriseText: srText,
      sunsetText: ssText,
      explanationForZeroPower: 'Sun is high in the sky! If 0 kW, cloud telemetry has a sync delay or inverter is in standby.',
    };
  }

  if (totalMins < sunsetStartMin) {
    let simple = 'Afternoon Sun';
    let cType: WeatherConditionType = 'sunny';
    if (cloudCover >= 70) {
      simple = 'Cloudy Afternoon';
      cType = 'cloudy';
    } else if (cloudCover >= 30) {
      simple = 'Partly Cloudy';
      cType = 'partly_cloudy';
    } else if (shortwaveRad < 350) {
      simple = 'Hazy Sunshine';
      cType = 'hazy';
    }

    return {
      istTime: timeStr,
      istTimeWithSec: timeWithSecStr,
      istDate: dateStr,
      phase: 'afternoon',
      phaseName: formatWithTemp(simple),
      simpleCondition: simple,
      conditionType: cType,
      temperatureC: tempC,
      phaseWindow: `02:30 PM – ${formatMinutes12hUpper(sunsetStartMin)}`,
      isDaylight: true,
      isNight: false,
      sunIcon: cType === 'cloudy' ? '☁️' : cType === 'partly_cloudy' ? '🌤️' : '☀️',
      sunDescription: 'Sun moving west • Steady daytime output',
      sunPositionPercent,
      sunriseText: srText,
      sunsetText: ssText,
      explanationForZeroPower: 'Daylight is active. Awaiting fresh cloud telemetry packet.',
    };
  }

  if (totalMins <= nightStartMin) {
    const simple = 'Golden Sunset';
    return {
      istTime: timeStr,
      istTimeWithSec: timeWithSecStr,
      istDate: dateStr,
      phase: 'sunset',
      phaseName: formatWithTemp(simple),
      simpleCondition: simple,
      conditionType: 'sunset',
      temperatureC: tempC,
      phaseWindow: `${formatMinutes12hUpper(sunsetStartMin)} – ${formatMinutes12hUpper(nightStartMin)}`,
      isDaylight: totalMins < ssMin,
      isNight: totalMins >= ssMin + 10,
      sunIcon: '🌇',
      sunDescription: `Sunset at ${ssText} • Solar generation concluding`,
      sunPositionPercent,
      sunriseText: srText,
      sunsetText: ssText,
      explanationForZeroPower: `Sun set at ${ssText}. Inverter entering standby mode for the night.`,
    };
  }

  const isCloudy = cloudCover > 60;
  const simple = isCloudy ? 'Cloudy Night' : 'Clear Night';
  const cType: WeatherConditionType = isCloudy ? 'night_cloudy' : 'night_clear';
  return {
    istTime: timeStr,
    istTimeWithSec: timeWithSecStr,
    istDate: dateStr,
    phase: 'night',
    phaseName: formatWithTemp(simple),
    simpleCondition: simple,
    conditionType: cType,
    temperatureC: tempC,
    phaseWindow: `${formatMinutes12hUpper(nightStartMin)} – 11:59 PM`,
    isDaylight: false,
    isNight: true,
    sunIcon: isCloudy ? '☁️' : '🌙',
    sunDescription: isCloudy
      ? `Night clouds • Resumes tomorrow at ${nextSrText}`
      : `Clear starry night • Solar resting until sunrise (${nextSrText})`,
    sunPositionPercent: -1,
    sunriseText: nextSrText,
    sunsetText: ssText,
    explanationForZeroPower: `Normal night standby. Generation resumes at sunrise (${nextSrText}).`,
  };
};

export const calculateEnvironmentalSavings = (kwh: number) => {
  const eq = computeEnvironmentEquivalents(kwh);
  return {
    co2Kg: eq.co2Kg,
    co2Tons: eq.co2Tons,
    trees: eq.trees,
    exactTrees: eq.exactTrees,
    nextTreeTarget: eq.nextTreeTarget,
    treeProgressPct: eq.treeProgressPct,
    coalKg: eq.coalKg,
    kmAvoided: eq.kmAvoided,
  };
};

export const calculateInverterEfficiency = (
  acPowerKw: number,
  dcPowerKw: number
): { efficiencyPct: number | null; label: string; badgeColor: string } => {
  if (dcPowerKw < 0.08 || acPowerKw < 0.02) {
    return {
      efficiencyPct: null,
      label: 'Standby threshold',
      badgeColor: 'bg-gray-100 text-gray-600 border border-gray-200',
    };
  }

  const rawPct = (acPowerKw / dcPowerKw) * 100;
  const clamped = Math.min(98.5, Math.max(45.0, rawPct));

  return {
    efficiencyPct: parseFloat(clamped.toFixed(1)),
    label: `${clamped.toFixed(1)}% Conversion Efficiency`,
    badgeColor: 'bg-emerald-50 text-emerald-800 border border-emerald-200/70',
  };
};

export const cleanDayCurveGaps = (
  rawPoints: Array<{ time: string; value: number }>
): Array<{ time: string; value: number; isInterpolated?: boolean }> => {
  if (!rawPoints || rawPoints.length < 3) return rawPoints || [];

  return rawPoints.map((pt, i, arr) => {
    if (i === 0 || i === arr.length - 1) return pt;

    const timeStr = (pt.time.split(' ')[1] || pt.time).slice(0, 5);
    const [hh, mm] = timeStr.split(':').map(Number);
    const hourFloat = hh + (mm || 0) / 60;
    const isDaylight = hourFloat >= 8.0 && hourFloat <= 16.5;

    const prev = arr[i - 1].value;
    const next = arr[i + 1].value;

    if (isDaylight && pt.value <= 0.02 && prev >= 0.5 && next >= 0.5) {
      const interpolatedVal = parseFloat(((prev + next) / 2).toFixed(3));
      return {
        ...pt,
        value: interpolatedVal,
        isInterpolated: true,
      };
    }

    return pt;
  });
};

export const estimateLivePowerFromRadiation = (
  gtiOrGhiW: number,
  capacityKwp: number = SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP,
  tAmbientC: number = 23,
  windSpeedKmh: number = 4.5,
  soilingLossPct: number = 0,
  aod: number = 0.4,
  physicsOverrides?: {
    thermalCoeffPerC?: number | null;
    dcCleanFactor?: number | null;
    basePrAtStc?: number | null;
    inverterEfficiency?: number | null;
    dcCapacityKwp?: number | null;
    acInverterCapacityKw?: number | null;
    mountingType?: 'open_rack' | 'flush_rcc' | null;
    pm10?: number | null;
    kSite?: number | null;
    cosThetaZ?: number | null;
    cosThetaInc?: number | null;
    hourlyShadeFactors?: number[] | null;
    hourIst?: number | null;
    inverterLossCoeffs?: {
      tareKw?: number;
      linearLoss?: number;
      quadLoss?: number;
      cutoffKw?: number;
      referenceAcKw?: number;
    } | null;
  }
): {
  estimatedKw: number;
  dcEstimatedKw: number;
  tCell: number;
  thermalDeratingPct: number;
  isCoolingBoost: boolean;
  thermalText: string;
  effectivePr: number;
} => {
  const dcCap =
    Number.isFinite(physicsOverrides?.dcCapacityKwp as number) && Number(physicsOverrides?.dcCapacityKwp) > 0
      ? Number(physicsOverrides?.dcCapacityKwp)
      : capacityKwp > 0
        ? capacityKwp
        : SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP;
  const acCap =
    Number.isFinite(physicsOverrides?.acInverterCapacityKw as number) && Number(physicsOverrides?.acInverterCapacityKw) > 0
      ? Number(physicsOverrides?.acInverterCapacityKw)
      : capacityKwp > 0
        ? capacityKwp
        : SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const safeIrradiance = Math.max(0, gtiOrGhiW || 0);
  if (safeIrradiance < 10) {
    return {
      estimatedKw: 0,
      dcEstimatedKw: 0,
      tCell: tAmbientC,
      thermalDeratingPct: 0,
      isCoolingBoost: false,
      thermalText: 'Ambient Standby',
      effectivePr: SOLAR_CONSTANTS.DEFAULT_PR_ANCHOR,
    };
  }

  const shadeArr = Array.isArray(physicsOverrides?.hourlyShadeFactors) ? physicsOverrides.hourlyShadeFactors : null;
  const hourIdx = Number.isInteger(physicsOverrides?.hourIst) ? Math.max(0, Math.min(23, Number(physicsOverrides?.hourIst))) : null;
  const shadeFactor = shadeArr && hourIdx !== null && Number.isFinite(shadeArr[hourIdx]) ? shadeArr[hourIdx] : 1.0;

  const prRes = computeEffectiveSolarPr({
    ambientTempC: tAmbientC,
    windSpeedKmh,
    gtiWm2: safeIrradiance * shadeFactor,
    surfaceLossPct: soilingLossPct,
    aod,
    pm10: physicsOverrides?.pm10 ?? null,
    cosThetaZ: physicsOverrides?.cosThetaZ ?? null,
    cosThetaInc: physicsOverrides?.cosThetaInc ?? null,
    thermalCoeffPerC: physicsOverrides?.thermalCoeffPerC,
    dcCleanFactor: physicsOverrides?.dcCleanFactor,
    basePrAtStc: physicsOverrides?.basePrAtStc,
    inverterEfficiency: physicsOverrides?.inverterEfficiency,
    mountingType: physicsOverrides?.mountingType,
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    inverterLossCoeffs: physicsOverrides?.inverterLossCoeffs,
    kSite: physicsOverrides?.kSite,
  });

  const thermalDeratingPct = parseFloat(((1 - prRes.tempFactor) * 100).toFixed(1));
  const isCoolingBoost = thermalDeratingPct < 0;

  return {
    estimatedKw: +prRes.acKw.toFixed(2),
    dcEstimatedKw: +prRes.dcKw.toFixed(2),
    tCell: prRes.cellTempC,
    thermalDeratingPct,
    isCoolingBoost,
    thermalText: isCoolingBoost
      ? `+${Math.abs(thermalDeratingPct)}% Cool Breeze Boost`
      : `-${thermalDeratingPct}% Heat Derating`,
    effectivePr: prRes.pr,
  };
};

export interface DiscomBillEstimate {
  billingCycleDay: number;
  cyclePeriodText: string;
  cycleStartYmd: string;
  cycleEndYmd: string;
  cycleTotalDays: number;
  daysElapsedInCycle: number;
  cycleUnitsKwh: number;
  cycleBillSavingsINR: string;
  daysRemainingInCycle: number;
}

export const calculateDiscomBillingCycleYield = (
  monthDays: Array<{ day: number; yield: number }> = [],
  billingCycleDay: number = 1,
  tariff: number = SOLAR_CONSTANTS.DEFAULT_TARIFF_INR,
  options?: {
    prevMonthDays?: Array<{ day: number; yield: number }>;
    commissioningYmd?: string;
    todayYmd?: string;
    todayExtraKwh?: number;
  }
): DiscomBillEstimate => {
  const safeBillingDay = Math.max(1, Math.min(28, Math.round(billingCycleDay || 1)));
  const clock = (options?.todayYmd ? parseYmdParts(options.todayYmd) : null) || getIstClockParts();
  const todayYmd = clock.ymd;
  const curYm = clock.ym;
  const prevYm = shiftYm(curYm, -1);
  const commYmd =
    options?.commissioningYmd && /^\d{4}-\d{2}-\d{2}$/.test(options.commissioningYmd)
      ? options.commissioningYmd
      : '2026-10-28';
  const pad2 = (n: number) => String(n).padStart(2, '0');

  let cycleStartYmd: string;
  let cycleEndYmd: string;

  if (safeBillingDay === 1) {
    cycleStartYmd = `${curYm}-01`;
    cycleEndYmd = `${curYm}-${pad2(daysInIstMonth(clock.year, clock.month))}`;
  } else if (clock.day >= safeBillingDay) {
    const nextYm = shiftYm(curYm, 1);
    cycleStartYmd = `${curYm}-${pad2(safeBillingDay)}`;
    cycleEndYmd = shiftYmdDays(`${nextYm}-${pad2(safeBillingDay)}`, -1);
  } else {
    cycleStartYmd = `${prevYm}-${pad2(safeBillingDay)}`;
    cycleEndYmd = shiftYmdDays(`${curYm}-${pad2(safeBillingDay)}`, -1);
  }

  const effectiveStartYmd = cycleStartYmd < commYmd ? commYmd : cycleStartYmd;
  const byYmd = new Map<string, number>();

  for (const d of options?.prevMonthDays || []) {
    const ymd = `${prevYm}-${pad2(d.day)}`;
    if (ymd >= effectiveStartYmd && ymd <= todayYmd && Number.isFinite(d.yield)) {
      byYmd.set(ymd, Math.max(0, d.yield));
    }
  }
  for (const d of monthDays || []) {
    const ymd = `${curYm}-${pad2(d.day)}`;
    if (ymd >= effectiveStartYmd && ymd <= todayYmd && Number.isFinite(d.yield)) {
      byYmd.set(ymd, Math.max(0, d.yield));
    }
  }
  if (typeof options?.todayExtraKwh === 'number' && Number.isFinite(options.todayExtraKwh) && options.todayExtraKwh > 0) {
    if (todayYmd >= effectiveStartYmd && todayYmd <= cycleEndYmd) {
      byYmd.set(todayYmd, Math.max(byYmd.get(todayYmd) || 0, options.todayExtraKwh));
    }
  }

  const cycleUnits = Array.from(byYmd.values()).reduce((sum, val) => sum + val, 0);
  const cycleTotalDays = Math.max(1, diffYmdDays(cycleEndYmd, cycleStartYmd) + 1);
  const daysElapsedInCycle = Math.max(1, Math.min(cycleTotalDays, diffYmdDays(todayYmd, effectiveStartYmd) + 1));
  const daysRemaining = Math.max(0, diffYmdDays(cycleEndYmd, todayYmd));

  return {
    billingCycleDay: safeBillingDay,
    cyclePeriodText: `${formatIndianDate(cycleStartYmd, 'short')} – ${formatIndianDate(cycleEndYmd, 'short')}`,
    cycleStartYmd,
    cycleEndYmd,
    cycleTotalDays,
    daysElapsedInCycle,
    cycleUnitsKwh: parseFloat(cycleUnits.toFixed(1)),
    cycleBillSavingsINR: formatINR(cycleUnits * tariff),
    daysRemainingInCycle: daysRemaining,
  };
};

export {
  SOLAR_CONSTANTS,
  computeEffectiveSolarPr,
  computeEnvironmentEquivalents,
  computeHybridTodayStitch,
  evaluateTelemetryTruth,
  parseTelemetryDate,
  isSameDayIST,
  formatRelativeAgo,
  isBeforeCommissioning,
  calculateNormalizedMonthlyAverage,
} from '../physics/index.ts';
export type { FreshnessReport, TelemetrySunContext } from '../types/physics.ts';

export function convertTemperature(
  tempC: number | null | undefined,
  unit: TemperatureUnit = 'C',
): number | null {
  if (tempC === null || tempC === undefined || !Number.isFinite(tempC)) return null;
  if (unit === 'F') {
    return +((tempC * 9) / 5 + 32).toFixed(1);
  }
  return +tempC.toFixed(1);
}

export function formatTemperature(
  tempC: number | null | undefined,
  unit: TemperatureUnit = 'C',
  decimals = 0,
): string {
  const converted = convertTemperature(tempC, unit);
  if (converted === null) return `--°${unit}`;
  return `${converted.toFixed(decimals)}°${unit}`;
}
