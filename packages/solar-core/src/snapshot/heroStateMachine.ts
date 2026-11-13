import { calculateInverterEfficiency, formatTemperature } from '../formatters/solarFormatter.ts';
import { computeEnvironmentEquivalents } from '../physics/index.ts';
import type { TemperatureUnit } from '../types/settings.ts';
import type { CanonicalSolarSnapshot } from '../types/snapshot.ts';
import type { LiveFlowData } from '../types/telemetry.ts';

export function resolveHeroStatusLabel(flags: {
  isTruthNight: boolean;
  isTruthFault: boolean;
  isTruthStale: boolean;
  isTruthOnline: boolean;
}): string {
  if (flags.isTruthNight) return 'Standby (Night)';
  if (flags.isTruthFault) return 'Inverter Fault';
  if (flags.isTruthStale) return 'Wi-Fi Offline';
  if (flags.isTruthOnline) return 'Online';
  return 'Sensor Offline';
}

export function resolveDirectDiffuseOptics(params: {
  isNight: boolean;
  shortwaveWm2: number;
  gtiWm2: number;
  dniWm2: number;
  directWm2: number;
  diffuseWm2: number;
  sunriseText: string;
}): CanonicalSolarSnapshot['directDiffuse'] {
  const totalRadOptics = params.directWm2 + params.diffuseWm2;
  const opticsAvailable = !params.isNight && params.shortwaveWm2 > 5 && totalRadOptics > 5;
  const directPct = opticsAvailable
    ? Math.max(0, Math.min(100, Math.round((params.directWm2 / totalRadOptics) * 100)))
    : null;
  const diffusePct = opticsAvailable && directPct !== null ? 100 - directPct : null;

  return {
    available: opticsAvailable,
    directPct,
    diffusePct,
    ghiWm2: opticsAvailable ? Math.round(params.shortwaveWm2) : null,
    gtiWm2: opticsAvailable ? Math.round(params.gtiWm2) : null,
    dniWm2: opticsAvailable ? Math.round(params.dniWm2) : null,
    label: opticsAvailable
      ? `${directPct}% Direct Beam · ${diffusePct}% Diffuse Sky`
      : 'Nighttime — Zero Solar Flux',
    reason: opticsAvailable
      ? 'Computed live from Open-Meteo Direct vs Diffuse SW irradiance'
      : `Awaiting sunrise at ${params.sunriseText}`,
  };
}

export function resolveThermalAndElectrical(params: {
  isNight: boolean;
  isTodayConfirmed: boolean;
  rawTempC: number | null;
  tempUnit: TemperatureUnit;
  effectiveCellTempC: number;
  tempFactor: number;
  pr: number;
  inverterEta: number;
  rawSolarKw: number;
  rawDeviceKw: number;
  rawGenKw: number;
  rVolt: number;
  rFreq: number;
  theoreticalKwAtIrradiance: number;
  resolvedFlow: LiveFlowData | null;
}): CanonicalSolarSnapshot['thermalAndElectrical'] {
  const cellTempC = params.isNight ? params.rawTempC : params.effectiveCellTempC;
  const acKw = params.isTodayConfirmed
    ? params.rawDeviceKw > 0
      ? params.rawDeviceKw
      : params.rawGenKw || null
    : null;
  const dcKw = params.isTodayConfirmed && params.rawSolarKw > 0 ? params.rawSolarKw : null;
  const invEffObj =
    dcKw && acKw && dcKw > 0.05 && acKw > 0.05 ? calculateInverterEfficiency(acKw, dcKw) : null;

  const gridVoltageV = params.rVolt > 10 ? +params.rVolt.toFixed(1) : null;
  const gridFreqHz = params.rFreq > 40 ? +params.rFreq.toFixed(1) : null;
  const acCurrentEstAmps =
    acKw && gridVoltageV && gridVoltageV > 10 ? +((acKw * 1000) / gridVoltageV).toFixed(1) : null;

  const rawDevVer = (params.resolvedFlow?.node?.device as unknown as Record<string, unknown>)?.version;
  const firmwareText =
    typeof rawDevVer === 'string' && rawDevVer.trim().length > 0
      ? rawDevVer.trim()
      : 'Not exposed by inverter API';

  return {
    cellTempC,
    cellTempFormatted: formatTemperature(cellTempC, params.tempUnit, 1),
    ambientTempFormatted: formatTemperature(params.rawTempC, params.tempUnit, 1),
    tempFactorPct: +(params.tempFactor * 100).toFixed(1),
    effectivePrPct: +(params.pr * 100).toFixed(1),
    dcKw,
    acKw,
    inverterEfficiencyPct: params.isNight
      ? null
      : invEffObj !== null
        ? invEffObj.efficiencyPct
        : +(params.inverterEta * 100).toFixed(1),
    inverterEfficiencySource: params.isNight
      ? 'standby'
      : invEffObj !== null
        ? 'live_telemetry'
        : 'physics_modeled',
    theoreticalKwAtIrradiance: params.isNight ? 0 : +params.theoreticalKwAtIrradiance.toFixed(2),
    gridVoltageV,
    gridVoltageFormatted: gridVoltageV !== null ? `${gridVoltageV.toFixed(1)} V` : 'Not exposed',
    gridFreqHz,
    gridFreqFormatted:
      gridFreqHz !== null
        ? `${gridFreqHz.toFixed(1)} Hz`
        : params.isTodayConfirmed
          ? '50.0 Hz · Grid Locked'
          : 'Standby',
    acCurrentEstAmps,
    isNightStandby: params.isNight,
    firmwareText,
  };
}

export function resolveReportCard(params: {
  capacityKwp: number;
  effectiveTodayDisplayKwh: number;
  peakKw: number;
  peakTimeText: string;
  tomorrowExpectedKwh: number;
  tariffPerKwh: number;
  co2FactorKgPerKwh: number;
  lifetimeTrees: number;
}): CanonicalSolarSnapshot['reportCard'] {
  const specificYieldToday =
    params.capacityKwp > 0 ? +(params.effectiveTodayDisplayKwh / params.capacityKwp).toFixed(2) : 0;
  const grade: 'A' | 'B' | 'C' = specificYieldToday >= 2.7 ? 'A' : specificYieldToday >= 1.3 ? 'B' : 'C';
  const gradeLabel =
    grade === 'A'
      ? 'Peak Yield Day'
      : grade === 'B'
        ? 'Steady Generation'
        : 'Low Irradiance / Outage';

  return {
    todayKwh: params.effectiveTodayDisplayKwh,
    specificYield: specificYieldToday,
    grade,
    gradeLabel,
    peakKw: params.peakKw,
    peakTime: params.peakTimeText,
    tomorrowKwh: params.tomorrowExpectedKwh,
    savingsInr: +(params.effectiveTodayDisplayKwh * params.tariffPerKwh).toFixed(2),
    co2Kg: computeEnvironmentEquivalents(params.effectiveTodayDisplayKwh, params.co2FactorKgPerKwh).co2Kg,
    trees: params.lifetimeTrees,
  };
}
