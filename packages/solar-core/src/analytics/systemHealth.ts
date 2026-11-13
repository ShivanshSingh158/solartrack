import { cleanDayCurveGaps } from '../formatters/solarFormatter.ts';
import { formatMinutes12hUpper } from '../physics/index.ts';
import type { DailyPerformanceLedgerEntry, SolarIntelligenceReport } from '../types/intelligence.ts';
import type { PersistedAppSettings } from '../types/settings.ts';
import type { CanonicalSolarSnapshot } from '../types/snapshot.ts';
import type { LiveFlowData, RawSeries } from '../types/telemetry.ts';
import type { SolarWeatherResponse } from '../types/weather.ts';

export type ConversionPointFlag = 'CLEAN' | 'LOW_LIGHT' | 'RS485_SYNC_SKEW';

export interface HealthConversionPoint {
  minutes: number;
  timeLabel: string;
  dcKw: number;
  acKw: number;
  heatLossWatts: number;
  etaPct: number | null;
  loadPct: number;
  flag: ConversionPointFlag;
}

export interface InverterConversionSummary {
  points: HealthConversionPoint[];
  cleanSamplesCount: number;
  skewedSamplesCount: number;
  weightedEtaPct: number | null;
  weightedSumDcKw: number;
  weightedSumAcKw: number;
  avgHeatLossWatts: number | null;
  liveEtaPct: number | null;
  liveHeatLossWatts: number | null;
  liveLoadPct: number | null;
  peakAcKw: number;
  peakDcKw: number;
  peakLoadPct: number;
}

export interface LoggerIntegritySummary {
  status: 'PRE_DAWN' | 'ACTIVE' | 'NIGHT_COMPLETE' | 'OFFLINE';
  rawDeliveryPct: number | null;
  healedCoveragePct: number | null;
  rawReceivedSlots: number;
  expectedSlots: number;
  healedDropCount: number;
  daylightSyncNote: string;
}

export interface MpptWakeSleepDiagnostic {
  status: 'healthy' | 'moderate' | 'lag_warning' | 'pending';
  basisYmd: string;
  basisLabel: string;
  sunriseMin: number;
  sunsetMin: number;
  sunriseText: string;
  sunsetText: string;
  firstWattMin: number | null;
  firstWattText: string;
  lastWattMin: number | null;
  lastWattText: string;
  wakeLagMinutes: number | null;
  sleepBeforeSunsetMinutes: number | null;
  morningGtiAtWake: number | null;
  headline: string;
  detail: string;
}

export type ChannelAuditState =
  | 'LIVE_ACTIVE'
  | 'ZERO_UNWIRED'
  | 'MIRRORED_NO_CT'
  | 'STANDBY_NIGHT'
  | 'PHYSICS_MODEL'
  | 'NOT_EXPOSED';

export interface TelemetryChannelAuditRow {
  channelKey: string;
  label: string;
  category: 'Waaree Flow & Curve' | 'Optional Field Sensor' | 'Weather & Optics Model';
  liveValueText: string;
  state: ChannelAuditState;
  stateLabel: string;
  detail: string;
}

export interface SyncHealthDayItem {
  ymd: string;
  shortLabel: string;
  coveragePct: number;
  realKwh: number | null;
  modeledKwh: number;
  isConfirmed: boolean;
  dipCategory: DailyPerformanceLedgerEntry['dipCategory'];
  eventLabel: string;
  isPartialOrGap: boolean;
}

export interface SystemHealthReport {
  statusLevel: 'optimal' | 'watch' | 'offline' | 'fault' | 'standby';
  statusBadge: string;
  statusDetail: string;
  conversion: InverterConversionSummary;
  logger: LoggerIntegritySummary;
  mpptTiming: MpptWakeSleepDiagnostic;
  channels: TelemetryChannelAuditRow[];
  syncDays14: SyncHealthDayItem[];
  pendingEepromDays: DailyPerformanceLedgerEntry[];
  unloggedOutageDays: DailyPerformanceLedgerEntry[];
  clearSkyHealthPct: number | null;
  clearCheckDaysCount: number;
  guards: Array<{
    key: string;
    label: string;
    armed: boolean;
    liveState: 'Normal' | 'Triggered' | 'Muted';
    detail: string;
  }>;
  thermalStress: {
    cellTempFormatted: string;
    ambientTempFormatted: string;
    tempFactorPct: number;
    heatDeratingPct: number;
    thermalSafetyMarginC: number;
    windSpeedKmh: number;
    windGustsKmh: number | null;
    gustAlert: boolean;
  };
}

function parsePointMinutesIst(timeStr: string): number | null {
  const m = String(timeStr || '').match(/(\d{2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function findSeriesPts(rawSeries: RawSeries[] | null | undefined, varName: string): Array<{ minutes: number; kw: number; rawTime: string }> {
  if (!Array.isArray(rawSeries)) return [];
  const target = rawSeries.find((s) => s.variable === varName);
  if (!target || !Array.isArray(target.data)) return [];
  const out: Array<{ minutes: number; kw: number; rawTime: string }> = [];
  for (const pt of target.data) {
    const mins = parsePointMinutesIst(pt?.time);
    if (mins === null) continue;
    const kw = parseFloat(String(pt?.value ?? 0));
    out.push({ minutes: mins, kw: Number.isFinite(kw) ? Math.max(0, kw) : 0, rawTime: String(pt?.time) });
  }
  return out.sort((a, b) => a.minutes - b.minutes);
}

export function analyzeInverterConversionSeries(
  todayRaw: RawSeries[] | null | undefined,
  capacityKwp: number,
  sunriseMin: number,
  sunsetMin: number,
  liveDcKw?: number | null,
  liveAcKw?: number | null
): InverterConversionSummary {
  const safeCap = capacityKwp > 0 ? capacityKwp : 3.0;
  const dcPts = findSeriesPts(todayRaw, 'pvPower');
  const acPts = findSeriesPts(todayRaw, 'generationPower');

  const dcByBucket = new Map<number, number>();
  for (const p of dcPts) {
    dcByBucket.set(Math.round(p.minutes / 5) * 5, p.kw);
  }
  const acByBucket = new Map<number, number>();
  for (const p of acPts) {
    acByBucket.set(Math.round(p.minutes / 5) * 5, p.kw);
  }

  const allBuckets = Array.from(new Set([...dcByBucket.keys(), ...acByBucket.keys()]))
    .filter((m) => m >= sunriseMin - 15 && m <= sunsetMin + 15)
    .sort((a, b) => a - b);

  let weightedSumDcKw = 0;
  let weightedSumAcKw = 0;
  let cleanSamplesCount = 0;
  let skewedSamplesCount = 0;
  let sumHeatLossCleanW = 0;
  let peakAcKw = 0;
  let peakDcKw = 0;

  const rawPoints: HealthConversionPoint[] = allBuckets.map((m) => {
    const dcKw = dcByBucket.get(m) ?? 0;
    const acKw = acByBucket.get(m) ?? 0;
    if (acKw > peakAcKw) peakAcKw = acKw;
    if (dcKw > peakDcKw) peakDcKw = dcKw;

    if (dcKw < 0.08) {
      return {
        minutes: m,
        timeLabel: formatMinutes12hUpper(m),
        dcKw: +dcKw.toFixed(3),
        acKw: +acKw.toFixed(3),
        heatLossWatts: Math.max(0, Math.round((dcKw - acKw) * 1000)),
        etaPct: null,
        loadPct: +Math.min(100, (acKw / safeCap) * 100).toFixed(1),
        flag: 'LOW_LIGHT',
      };
    }

    const ratio = acKw / dcKw;
    const isSkewed = dcKw <= acKw * 1.01 || ratio > 0.988 || ratio < 0.42;
    if (isSkewed) {
      skewedSamplesCount++;
      return {
        minutes: m,
        timeLabel: formatMinutes12hUpper(m),
        dcKw: +dcKw.toFixed(3),
        acKw: +acKw.toFixed(3),
        heatLossWatts: 0,
        etaPct: null,
        loadPct: +Math.min(100, (acKw / safeCap) * 100).toFixed(1),
        flag: 'RS485_SYNC_SKEW',
      };
    }

    const eta = +Math.min(98.5, Math.max(45.0, ratio * 100)).toFixed(1);
    const heatW = Math.max(0, Math.round((dcKw - acKw) * 1000));
    cleanSamplesCount++;
    weightedSumDcKw += dcKw;
    weightedSumAcKw += acKw;
    sumHeatLossCleanW += heatW;

    return {
      minutes: m,
      timeLabel: formatMinutes12hUpper(m),
      dcKw: +dcKw.toFixed(3),
      acKw: +acKw.toFixed(3),
      heatLossWatts: heatW,
      etaPct: eta,
      loadPct: +Math.min(100, (acKw / safeCap) * 100).toFixed(1),
      flag: 'CLEAN',
    };
  });

  const points = rawPoints.map((pt, idx) => {
    if (pt.flag !== 'RS485_SYNC_SKEW') return pt;
    let prevClean: HealthConversionPoint | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (rawPoints[i].flag === 'CLEAN' && rawPoints[i].etaPct !== null) {
        prevClean = rawPoints[i];
        break;
      }
    }
    let nextClean: HealthConversionPoint | null = null;
    for (let i = idx + 1; i < rawPoints.length; i++) {
      if (rawPoints[i].flag === 'CLEAN' && rawPoints[i].etaPct !== null) {
        nextClean = rawPoints[i];
        break;
      }
    }
    const interpEta =
      prevClean && nextClean
        ? +(((prevClean.etaPct! + nextClean.etaPct!) / 2).toFixed(1))
        : prevClean?.etaPct ?? nextClean?.etaPct ?? null;
    const interpHeatW =
      interpEta !== null && pt.dcKw >= 0.08
        ? Math.max(0, Math.round(pt.dcKw * (1 - interpEta / 100) * 1000))
        : 0;
    return {
      ...pt,
      etaPct: interpEta,
      heatLossWatts: interpHeatW,
    };
  });

  const weightedEtaPct =
    cleanSamplesCount > 0 && weightedSumDcKw >= 0.1
      ? +Math.min(98.5, Math.max(45.0, (weightedSumAcKw / weightedSumDcKw) * 100)).toFixed(1)
      : null;
  const avgHeatLossWatts =
    cleanSamplesCount > 0 ? Math.round(sumHeatLossCleanW / cleanSamplesCount) : null;

  let liveEtaPct: number | null = null;
  let liveHeatLossWatts: number | null = null;
  if (
    typeof liveDcKw === 'number' &&
    typeof liveAcKw === 'number' &&
    liveDcKw >= 0.08 &&
    liveAcKw >= 0.02
  ) {
    const liveRatio = liveAcKw / liveDcKw;
    if (liveDcKw > liveAcKw * 1.01 && liveRatio >= 0.42 && liveRatio <= 0.988) {
      liveEtaPct = +Math.min(98.5, Math.max(45.0, liveRatio * 100)).toFixed(1);
      liveHeatLossWatts = Math.round((liveDcKw - liveAcKw) * 1000);
    } else if (weightedEtaPct !== null) {
      liveEtaPct = weightedEtaPct;
      liveHeatLossWatts = Math.round(liveDcKw * (1 - weightedEtaPct / 100) * 1000);
    }
  }

  return {
    points,
    cleanSamplesCount,
    skewedSamplesCount,
    weightedEtaPct,
    weightedSumDcKw: +weightedSumDcKw.toFixed(1),
    weightedSumAcKw: +weightedSumAcKw.toFixed(1),
    avgHeatLossWatts,
    liveEtaPct,
    liveHeatLossWatts,
    liveLoadPct:
      typeof liveAcKw === 'number' && liveAcKw > 0.01
        ? +Math.min(100, (liveAcKw / safeCap) * 100).toFixed(1)
        : null,
    peakAcKw: +peakAcKw.toFixed(2),
    peakDcKw: +peakDcKw.toFixed(2),
    peakLoadPct: +Math.min(100, (peakAcKw / safeCap) * 100).toFixed(1),
  };
}

export function computeLoggerPacketIntegrity(
  todayRaw: RawSeries[] | null | undefined,
  sunriseMin: number,
  sunsetMin: number,
  nowMinutesIst: number,
  isStaleOrOffline: boolean
): LoggerIntegritySummary {
  const startMin = sunriseMin + 20;
  const endMin = Math.min(nowMinutesIst - 5, sunsetMin - 20);

  if (nowMinutesIst < startMin || endMin <= startMin) {
    return {
      status: 'PRE_DAWN',
      rawDeliveryPct: null,
      healedCoveragePct: null,
      rawReceivedSlots: 0,
      expectedSlots: 0,
      healedDropCount: 0,
      daylightSyncNote: 'Awaiting post-sunrise logging window',
    };
  }

  const expectedSlots = Math.max(1, Math.floor((endMin - startMin) / 5) + 1);
  const rawGenSeries = todayRaw?.find((s) => s.variable === 'generationPower')?.data || [];
  const cleaned = cleanDayCurveGaps(
    rawGenSeries.map((p) => ({
      time: String(p?.time || ''),
      value: parseFloat(String(p?.value ?? 0)) || 0,
    }))
  );
  const healedDropCount = cleaned.filter((p) => p.isInterpolated).length;

  const rawBuckets = new Set<number>();
  for (let i = 0; i < rawGenSeries.length; i++) {
    const p = rawGenSeries[i];
    const mins = parsePointMinutesIst(String(p?.time || ''));
    if (mins === null || mins < startMin || mins > endMin) continue;
    const val = parseFloat(String(p?.value ?? 0)) || 0;
    const wasHealedZeroDrop = Boolean(cleaned[i]?.isInterpolated);
    if (!wasHealedZeroDrop && val >= 0) {
      rawBuckets.add(Math.floor((mins - startMin) / 5));
    }
  }

  const rawReceivedSlots = Math.min(expectedSlots, rawBuckets.size);
  const rawDeliveryPct = Math.min(100, Math.round((rawReceivedSlots / expectedSlots) * 100));
  const healedCoveragePct = Math.min(
    100,
    Math.round((Math.min(expectedSlots, rawReceivedSlots + healedDropCount) / expectedSlots) * 100)
  );

  let status: LoggerIntegritySummary['status'] = 'ACTIVE';
  if (nowMinutesIst > sunsetMin + 15) status = 'NIGHT_COMPLETE';
  else if (isStaleOrOffline && rawReceivedSlots === 0) status = 'OFFLINE';

  const healedNote =
    healedDropCount > 0 ? ` · +${healedDropCount} single-pkt drop healed` : '';
  return {
    status,
    rawDeliveryPct,
    healedCoveragePct,
    rawReceivedSlots,
    expectedSlots,
    healedDropCount,
    daylightSyncNote: `${rawReceivedSlots}/${expectedSlots} raw 5m pkts (${rawDeliveryPct}%)${healedNote}`,
  };
}

export function evaluateMpptWakeAndSleep(
  todayRaw: RawSeries[] | null | undefined,
  yesterdayRaw: RawSeries[] | null | undefined,
  lastSyncedRaw: RawSeries[] | null | undefined,
  lastSyncedLabel: string | null | undefined,
  lastSyncedYmd: string | null | undefined,
  todayYmd: string,
  sunriseMin: number,
  sunsetMin: number,
  weatherData?: SolarWeatherResponse | null
): MpptWakeSleepDiagnostic {
  const pickSeries = (raw: RawSeries[] | null | undefined) => {
    const pv = findSeriesPts(raw, 'pvPower');
    const gen = findSeriesPts(raw, 'generationPower');
    const chosen = pv.some((p) => p.kw > 0.02) ? pv : gen;
    return chosen.filter((p) => p.kw > 0.015);
  };

  let activePts = pickSeries(todayRaw);
  let basisYmd = todayYmd;
  let basisLabel = 'Today';

  if (activePts.length === 0) {
    const yPts = pickSeries(yesterdayRaw);
    if (yPts.length > 0) {
      activePts = yPts;
      basisYmd = lastSyncedYmd || todayYmd;
      basisLabel = 'Yesterday';
    } else {
      const lsPts = pickSeries(lastSyncedRaw);
      if (lsPts.length > 0) {
        activePts = lsPts;
        basisYmd = lastSyncedYmd || todayYmd;
        basisLabel = lastSyncedLabel || 'Last Verified';
      }
    }
  }

  const sunriseText = formatMinutes12hUpper(sunriseMin);
  const sunsetText = formatMinutes12hUpper(sunsetMin);

  if (activePts.length === 0) {
    return {
      status: 'pending',
      basisYmd,
      basisLabel,
      sunriseMin,
      sunsetMin,
      sunriseText,
      sunsetText,
      firstWattMin: null,
      firstWattText: '--',
      lastWattMin: null,
      lastWattText: '--',
      wakeLagMinutes: null,
      sleepBeforeSunsetMinutes: null,
      morningGtiAtWake: null,
      headline: 'Awaiting Dawn Telemetry',
      detail: `Waiting for first >15W DC sample after sunrise (${sunriseText}).`,
    };
  }

  const firstWattMin = activePts[0].minutes;
  const lastWattMin = activePts[activePts.length - 1].minutes;
  const wakeLagMinutes = firstWattMin - sunriseMin;
  const sleepBeforeSunsetMinutes =
    lastWattMin >= 15 * 60 ? sunsetMin - lastWattMin : null;

  const wakeHour = Math.max(0, Math.min(23, Math.floor(firstWattMin / 60)));
  const gtiArr = weatherData?.hourly?.globalTiltedIrradiance;
  const morningGtiAtWake =
    Array.isArray(gtiArr) && typeof gtiArr[wakeHour] === 'number'
      ? Math.round(gtiArr[wakeHour])
      : null;

  let status: MpptWakeSleepDiagnostic['status'] = 'healthy';
  let headline = 'Fast MPPT Lock';
  let detail = `${basisLabel}: First >15W at ${formatMinutes12hUpper(firstWattMin)} (${wakeLagMinutes >= 0 ? '+' : ''}${wakeLagMinutes}m vs dawn)`;

  if (wakeLagMinutes > 45 && (morningGtiAtWake === null || morningGtiAtWake > 150)) {
    status = 'lag_warning';
    headline = 'Delayed MPPT Start-Up';
    detail = `${basisLabel}: Woke +${wakeLagMinutes}m after sunrise despite ${morningGtiAtWake ?? '>150'} W/m² GTI — check morning east shade or V_start threshold.`;
  } else if (wakeLagMinutes > 30) {
    status = 'moderate';
    headline = 'Moderate Dawn Ramp';
    detail = `${basisLabel}: Woke +${wakeLagMinutes}m after sunrise (low horizon angle or morning haze).`;
  }

  return {
    status,
    basisYmd,
    basisLabel,
    sunriseMin,
    sunsetMin,
    sunriseText,
    sunsetText,
    firstWattMin,
    firstWattText: formatMinutes12hUpper(firstWattMin),
    lastWattMin,
    lastWattText: formatMinutes12hUpper(lastWattMin),
    wakeLagMinutes,
    sleepBeforeSunsetMinutes,
    morningGtiAtWake,
    headline,
    detail,
  };
}

export function auditRawChannelsFromTelemetry(
  todayRaw: RawSeries[] | null | undefined,
  liveFlow: LiveFlowData | { result?: LiveFlowData } | null | undefined,
  canonical: CanonicalSolarSnapshot,
  lastSyncedRaw?: RawSeries[] | null
): TelemetryChannelAuditRow[] {
  const rawSrc =
    Array.isArray(todayRaw) && todayRaw.length > 0
      ? todayRaw
      : Array.isArray(lastSyncedRaw)
        ? lastSyncedRaw
        : [];
  const srMin = canonical.sun.sunriseMin ?? 375;
  const ssMin = canonical.sun.sunsetMin ?? 1045;

  const inspectVar = (varName: string) => {
    const pts = findSeriesPts(rawSrc, varName).filter((p) => p.minutes >= srMin && p.minutes <= ssMin);
    const maxKw = pts.reduce((mx, p) => Math.max(mx, p.kw), 0);
    const latestKw = pts.length > 0 ? pts[pts.length - 1].kw : null;
    const allZero = pts.length > 0 && maxKw <= 0.005;
    return { pts, maxKw, latestKw, allZero };
  };

  const genInfo = inspectVar('generationPower');
  const pvInfo = inspectVar('pvPower');
  const feedinInfo = inspectVar('feedinPower');
  const gridConsInfo = inspectVar('gridConsumptionPower');
  const loadsInfo = inspectVar('loadsPower');
  const radInfo = inspectVar('radiation');

  let isMirroredFeedin = false;
  if (feedinInfo.pts.length > 2 && genInfo.pts.length > 2) {
    let matches = 0;
    const len = Math.min(feedinInfo.pts.length, genInfo.pts.length);
    for (let i = 0; i < len; i++) {
      if (Math.abs(feedinInfo.pts[i].kw - genInfo.pts[i].kw) <= 0.025) matches++;
    }
    if (matches / len >= 0.9) isMirroredFeedin = true;
  }

  const te = canonical.thermalAndElectrical;
  const rows: TelemetryChannelAuditRow[] = [
    {
      channelKey: 'generationPower',
      label: 'Inverter AC Output (generationPower)',
      category: 'Waaree Flow & Curve',
      liveValueText: canonical.truth.isNight
        ? '0.00 kW (Standby)'
        : te.acKw !== null
          ? `${te.acKw.toFixed(3)} kW`
          : genInfo.latestKw !== null
            ? `${genInfo.latestKw.toFixed(3)} kW`
            : '0.00 kW',
      state: canonical.truth.isNight ? 'STANDBY_NIGHT' : genInfo.maxKw > 0.01 ? 'LIVE_ACTIVE' : 'STANDBY_NIGHT',
      stateLabel: canonical.truth.isNight
        ? 'Night Standby'
        : `${genInfo.pts.length} pts · Peak ${genInfo.maxKw.toFixed(2)} kW`,
      detail: 'Primary AC meter register driving overview, KPIs, and Cloud ledger parity.',
    },
    {
      channelKey: 'pvPower',
      label: 'Solar Array DC Input (pvPower)',
      category: 'Waaree Flow & Curve',
      liveValueText: canonical.truth.isNight
        ? '0.00 kW (Standby)'
        : te.dcKw !== null
          ? `${te.dcKw.toFixed(3)} kW`
          : pvInfo.latestKw !== null
            ? `${pvInfo.latestKw.toFixed(3)} kW`
            : '0.00 kW',
      state: canonical.truth.isNight ? 'STANDBY_NIGHT' : pvInfo.maxKw > 0.01 ? 'LIVE_ACTIVE' : 'STANDBY_NIGHT',
      stateLabel: canonical.truth.isNight
        ? 'Night Standby'
        : `${pvInfo.pts.length} pts · Peak ${pvInfo.maxKw.toFixed(2)} kW`,
      detail: 'DC MPPT string power sum measured prior to inverter DC→AC stage.',
    },
    {
      channelKey: 'loadsPower',
      label: 'Home Consumption CT (loadsPower)',
      category: 'Optional Field Sensor',
      liveValueText: loadsInfo.allZero ? '0.00 kW All Day' : `${(loadsInfo.latestKw ?? 0).toFixed(2)} kW`,
      state: loadsInfo.allZero || loadsInfo.pts.length === 0 ? 'ZERO_UNWIRED' : 'LIVE_ACTIVE',
      stateLabel:
        loadsInfo.allZero || loadsInfo.pts.length === 0
          ? '0.00 kW All Day — External RS485 CT Clamp Not Wired'
          : `Active (${loadsInfo.pts.length} pts)`,
      detail:
        loadsInfo.allZero || loadsInfo.pts.length === 0
          ? 'Cloud channel exists in Waaree schema but reports zero all day without an external breaker CT.'
          : 'Bi-directional home load telemetry active.',
    },
    {
      channelKey: 'feedinPower',
      label: 'Grid Export / Import CT (feedinPower / gridConsumptionPower)',
      category: 'Optional Field Sensor',
      liveValueText:
        gridConsInfo.allZero && isMirroredFeedin
          ? 'Mirrors AC Output / 0 Import'
          : `${(feedinInfo.latestKw ?? 0).toFixed(2)} kW`,
      state: gridConsInfo.allZero && (feedinInfo.allZero || isMirroredFeedin) ? 'MIRRORED_NO_CT' : 'LIVE_ACTIVE',
      stateLabel:
        gridConsInfo.allZero && isMirroredFeedin
          ? 'Mirrors Generation (Gross Metering Proxy · No CT Clamp)'
          : 'Live Bi-Directional Flow',
      detail: 'Requires Chint DDSU666 / Acrel RS485 smart meter to split house self-consumption vs DISCOM export.',
    },
    {
      channelKey: 'radiation',
      label: 'Local Pyranometer (radiation)',
      category: 'Optional Field Sensor',
      liveValueText: radInfo.allZero || radInfo.pts.length === 0 ? '0.00 All Day' : `${radInfo.maxKw.toFixed(0)} W/m²`,
      state: radInfo.allZero || radInfo.pts.length === 0 ? 'ZERO_UNWIRED' : 'LIVE_ACTIVE',
      stateLabel:
        radInfo.allZero || radInfo.pts.length === 0
          ? '0.00 All Day — Local Sensor Unwired (Open-Meteo GTI Active)'
          : 'Live On-Site Sensor',
      detail: 'Open-Meteo Tilted GTI (26.5°) & 15-min satellite physics supply real irradiance instead.',
    },
    {
      channelKey: 'rVolt_pv1Volt_heatsink',
      label: 'String Volts, AC Line Volts, Hz & Heatsink Temp',
      category: 'Waaree Flow & Curve',
      liveValueText:
        canonical.realElectrical
          ? `PV1: ${canonical.realElectrical.dc.pv1.volt?.toFixed(1) ?? '—'}V · Grid: ${canonical.realElectrical.grid.r.volt?.toFixed(1) ?? '—'}V · ${canonical.realElectrical.grid.r.freqHz?.toFixed(2) ?? '50.00'}Hz`
          : te.gridVoltageV !== null
            ? `${te.gridVoltageV.toFixed(1)} V · ${te.gridFreqFormatted}`
            : 'Not Exposed',
      state: canonical.realElectrical || te.gridVoltageV !== null ? 'LIVE_ACTIVE' : 'NOT_EXPOSED',
      stateLabel:
        canonical.realElectrical
          ? 'Live Hardware Modbus Stream'
          : te.gridVoltageV !== null
            ? 'Exposed by Device Feed'
            : 'Not Exposed by Cloud Flow API (Use Real P_dc−P_ac)',
      detail:
        canonical.realElectrical
          ? `Direct high-frequency telemetry from /c/v0/device/real/all. Inverter internal IGBT temp: ${canonical.realElectrical.temperatures?.invTemp ?? 'Normal'}°C.`
          : te.gridVoltageV !== null
            ? 'Direct voltage & frequency read from hardware feed.'
            : 'Waaree plant-level flow/raw endpoints omit per-string V/A and AC voltage; internal waste heat & MPPT wake lag replace synthetic guesses.',
    },
    ...(canonical.realElectrical
      ? [
          {
            channelKey: 'pv1_string_diagnostics',
            label: 'DC String 1 (PV1 Live MPPT)',
            category: 'Waaree Flow & Curve' as const,
            liveValueText: `${canonical.realElectrical.dc.pv1.volt?.toFixed(1) ?? '0.0'} V · ${canonical.realElectrical.dc.pv1.current?.toFixed(1) ?? '0.0'} A (${(canonical.realElectrical.dc.pv1.powerKw ?? 0).toFixed(3)} kW)`,
            state: 'LIVE_ACTIVE' as const,
            stateLabel: 'String 1 Operational (Active MPPT)',
            detail: 'Direct measured DC string voltage and current prior to inverter DC/DC booster stage.',
          },
          {
            channelKey: 'pv2_string_unwired',
            label: 'DC String 2 (PV2 Secondary MPPT)',
            category: 'Optional Field Sensor' as const,
            liveValueText: '0.0 V · 0.0 A (0.0 kW)',
            state: 'ZERO_UNWIRED' as const,
            stateLabel: '⚪ Unwired / Reserved Port (Single-String 3.00 kWp Configuration)',
            detail: 'String 2 MPPT port is intentionally unpopulated in this 3.00 kWp single-string rooftop array.',
          },
          {
            channelKey: 'grid_r_sync_diagnostics',
            label: 'Grid Phase R Power Quality & Frequency',
            category: 'Waaree Flow & Curve' as const,
            liveValueText: `${canonical.realElectrical.grid.r.volt?.toFixed(1) ?? '0.0'} V · ${canonical.realElectrical.grid.r.current?.toFixed(1) ?? '0.0'} A · ${canonical.realElectrical.grid.r.freqHz?.toFixed(2) ?? '50.00'} Hz`,
            state: 'LIVE_ACTIVE' as const,
            stateLabel: 'Single-Phase Grid Locked',
            detail: 'Direct AC grid synchronization parameters measured at inverter connection point.',
          },
          {
            channelKey: 'silicon_conversion_efficiency',
            label: 'Silicon Modbus Conversion Efficiency',
            category: 'Waaree Flow & Curve' as const,
            liveValueText:
              canonical.realElectrical.efficiency.etaPct !== null
                ? `${canonical.realElectrical.efficiency.etaPct.toFixed(2)}% (${canonical.realElectrical.efficiency.conversionLossWatts ?? 0}W Thermal Loss)`
                : 'Standby / Low-Light',
            state: 'LIVE_ACTIVE' as const,
            stateLabel: 'Real Measured Silicon η',
            detail: 'Dynamic conversion efficiency calculated directly from simultaneous DC input and AC output power registers.',
          },
        ]
      : []),
    {
      channelKey: 'openMeteoGTI',
      label: 'Tilted GTI, NOCT Cell Temp & PM10 / AOD',
      category: 'Weather & Optics Model',
      liveValueText: `${canonical.weatherNow.gtiWm2} W/m² · ${canonical.effectivePrBreakdown.cellTempFormatted}`,
      state: 'PHYSICS_MODEL',
      stateLabel: 'Open-Meteo Satellite + NOCT Active',
      detail: `AOD ${canonical.soiling.aod.toFixed(2)} · PM10 ${Math.round(canonical.soiling.pm10)} µg/m³ · Surface Film -${canonical.soiling.surfaceLossPct.toFixed(1)}%`,
    },
  ];

  void liveFlow;
  return rows;
}

export function buildSystemHealthReport(input: {
  canonicalSnapshot: CanonicalSolarSnapshot;
  todayRaw?: RawSeries[] | null;
  yesterdayRaw?: RawSeries[] | null;
  lastSyncedRaw?: RawSeries[] | null;
  liveFlow?: LiveFlowData | { result?: LiveFlowData } | null;
  weatherData?: SolarWeatherResponse | null;
  intelligenceReport?: SolarIntelligenceReport | null;
  settings?: Partial<PersistedAppSettings> | null;
}): SystemHealthReport {
  const {
    canonicalSnapshot: snap,
    todayRaw,
    yesterdayRaw,
    lastSyncedRaw,
    liveFlow,
    weatherData,
    intelligenceReport: rep,
    settings,
  } = input;

  const te = snap.thermalAndElectrical;
  const srMin = snap.sun.sunriseMin ?? 375;
  const ssMin = snap.sun.sunsetMin ?? 1045;
  const conversion = analyzeInverterConversionSeries(
    todayRaw,
    snap.config.capacityKwp,
    srMin,
    ssMin,
    te.dcKw,
    te.acKw
  );

  const logger = computeLoggerPacketIntegrity(
    todayRaw,
    srMin,
    ssMin,
    snap.clock.totalMinutes,
    snap.truth.isStale
  );

  const mpptTiming = evaluateMpptWakeAndSleep(
    todayRaw,
    yesterdayRaw,
    lastSyncedRaw,
    snap.yesterday.lastSyncedLabel,
    null,
    snap.clock.ymd,
    srMin,
    ssMin,
    weatherData
  );

  const channels = auditRawChannelsFromTelemetry(todayRaw, liveFlow, snap, lastSyncedRaw);

  const ledger = Array.isArray(rep?.dailyLedger) ? rep!.dailyLedger : [];
  const trailing14 = ledger.slice(-14);
  const syncDays14: SyncHealthDayItem[] = trailing14.map((d) => {
    let coveragePct = d.onlineCoveragePct ?? (d.isConfirmed ? 100 : 0);
    if (d.ymd === snap.clock.ymd && logger.rawDeliveryPct !== null) {
      coveragePct = logger.rawDeliveryPct;
    }
    const isPartialOrGap =
      (!d.isConfirmed && d.ymd < snap.clock.ymd) ||
      (coveragePct < 80 && d.ymd <= snap.clock.ymd) ||
      d.dipCategory === 'OUTAGE_GAP';
    return {
      ymd: d.ymd,
      shortLabel: d.shortLabel,
      coveragePct,
      realKwh: d.realKwh,
      modeledKwh: d.modeledAfterSoilingKwh,
      isConfirmed: d.isConfirmed,
      dipCategory: d.dipCategory,
      eventLabel: d.dipReasonLabel || d.eventLabel,
      isPartialOrGap,
    };
  });

  const commYmd = snap.config.commissioningYmd;
  const unloggedOutageDays = ledger.filter(
    (d) =>
      d.dipCategory === 'WIFI_OUTAGE_UNLOGGED' ||
      (d.ymd < snap.clock.ymd &&
        (!commYmd || d.ymd !== commYmd) &&
        !d.isConfirmed &&
        d.dipCategory !== 'PENDING_SYNC')
  );
  const pendingEepromDays = ledger.filter(
    (d) =>
      !d.isConfirmed &&
      (d.dipCategory === 'PENDING_SYNC' || (d.ymd >= snap.clock.ymd && d.dipCategory !== 'WIFI_OUTAGE_UNLOGGED'))
  );

  const clearDays = ledger.filter(
    (d) => d.isConfirmed && d.isClearCheckDay && d.realVsModelPct !== null && (d.onlineCoveragePct ?? 100) >= 85
  );
  const clearSkyHealthPct =
    clearDays.length > 0
      ? Math.round(clearDays.reduce((s, d) => s + (d.realVsModelPct || 100), 0) / clearDays.length)
      : snap.sunEfficiencyScore.scorePct;

  const windSpeedKmh = snap.weatherNow.windSpeedKmh ?? 5;
  const windGustsKmh = weatherData?.current?.windGusts ?? null;
  const gustAlert = (windGustsKmh ?? 0) > 40;
  const heatDeratingPct = +((1 - snap.effectivePrBreakdown.tempFactor) * 100).toFixed(1);
  const thermalSafetyMarginC = +(65 - snap.effectivePrBreakdown.cellTempC).toFixed(1);

  const offlineDelayMins = Math.max(5, Math.min(180, Number(settings?.offlineDelayMinutes) || 30));
  const underperfThreshold = Math.max(
    60,
    Math.min(95, Number(settings?.underperformanceThresholdPct) || 82)
  );
  const underperfArmed = settings?.alertUnderperformance ?? false;

  const guards: SystemHealthReport['guards'] = [
    {
      key: 'offlineDelay',
      label: `Offline Delay Guard (>${offlineDelayMins}m)`,
      armed: settings?.alertOfflineDelay ?? true,
      liveState: !(settings?.alertOfflineDelay ?? true)
        ? 'Muted'
        : snap.truth.isStale
          ? 'Triggered'
          : 'Normal',
      detail: snap.truth.isStale ? `Stale ${snap.truth.relativeAgo}` : 'Heartbeat active',
    },
    {
      key: 'morningYield',
      label: 'Dawn Startup & Soiling Guard',
      armed: settings?.alertMorningYield ?? true,
      liveState: !(settings?.alertMorningYield ?? true)
        ? 'Muted'
        : mpptTiming.status === 'lag_warning' || snap.soiling.actionState === 'WASH_NOW'
          ? 'Triggered'
          : 'Normal',
      detail:
        mpptTiming.wakeLagMinutes !== null
          ? `MPPT wake ${mpptTiming.wakeLagMinutes >= 0 ? '+' : ''}${mpptTiming.wakeLagMinutes}m`
          : mpptTiming.headline,
    },
    {
      key: 'antiIslanding',
      label: 'Grid Safety / Anti-Islanding',
      armed: settings?.alertVoltageSpike ?? true,
      liveState: !(settings?.alertVoltageSpike ?? true)
        ? 'Muted'
        : snap.truth.status === 'GRID_OUTAGE'
          ? 'Triggered'
          : 'Normal',
      detail:
        te.gridVoltageV !== null
          ? `${te.gridVoltageV.toFixed(1)} V · ${te.gridFreqFormatted}`
          : snap.truth.status === 'GRID_OUTAGE'
            ? 'Grid outage detected'
            : 'Inverter grid-tied state OK',
    },
    {
      key: 'washThreshold',
      label: 'Wash & Clear-Sky PR Guard',
      armed: true,
      liveState:
        snap.soiling.actionState === 'WASH_NOW' ||
        (underperfArmed && clearSkyHealthPct !== null && clearSkyHealthPct < underperfThreshold)
          ? 'Triggered'
          : 'Normal',
      detail:
        underperfArmed && clearSkyHealthPct !== null
          ? `-${snap.soiling.surfaceLossPct.toFixed(1)}% film · Clear-sky ${clearSkyHealthPct}% (min ${underperfThreshold}%)`
          : `-${snap.soiling.surfaceLossPct.toFixed(1)}% film · ${snap.soiling.actionBadgeText}`,
    },
  ];

  let statusLevel: SystemHealthReport['statusLevel'] = 'optimal';
  let statusBadge = 'All Systems Optimal';
  let statusDetail = `Inverter grid-tied · ${channels.filter((c) => c.state === 'LIVE_ACTIVE').length} active power channels verified`;

  if (snap.truth.status === 'FAULT' || snap.truth.status === 'GRID_OUTAGE') {
    statusLevel = 'fault';
    statusBadge = snap.truth.status === 'GRID_OUTAGE' ? 'Grid Outage (Anti-Islanding)' : 'Inverter Trip Alert';
    statusDetail = snap.truth.statusHeadline;
  } else if (snap.truth.isStale) {
    statusLevel = 'offline';
    statusBadge = 'Logger Offline (Roof Generating)';
    statusDetail = `Wi-Fi silent ${snap.truth.relativeAgo} · Same-day EDay accumulates until 00:00 IST`;
  } else if (
    (logger.rawDeliveryPct !== null && logger.rawDeliveryPct < 75) ||
    mpptTiming.status === 'lag_warning' ||
    snap.soiling.actionState === 'WASH_NOW' ||
    (underperfArmed && clearSkyHealthPct !== null && clearSkyHealthPct < underperfThreshold) ||
    gustAlert
  ) {
    statusLevel = 'watch';
    statusBadge = 'Attention Recommended';
    statusDetail =
      snap.soiling.actionState === 'WASH_NOW'
        ? `Wash advised (-${snap.soiling.surfaceLossPct.toFixed(1)}% soil)`
        : mpptTiming.status === 'lag_warning'
          ? mpptTiming.headline
          : unloggedOutageDays.length > 0
            ? `${unloggedOutageDays.length} past day missed in Cloud (Wi-Fi offline past 00:00)`
            : pendingEepromDays.length > 0
              ? `${pendingEepromDays.length}d awaiting pre-midnight Wi-Fi sync`
              : 'Check telemetry completeness or wind gusts';
  } else if (snap.truth.isNight) {
    statusLevel = 'standby';
    statusBadge = 'Night Bus Standby';
    statusDetail = `DC isolator resting until dawn (${snap.sun.sunriseText})`;
  }

  return {
    statusLevel,
    statusBadge,
    statusDetail,
    conversion,
    logger,
    mpptTiming,
    channels,
    syncDays14,
    pendingEepromDays,
    unloggedOutageDays,
    clearSkyHealthPct,
    clearCheckDaysCount: clearDays.length,
    guards,
    thermalStress: {
      cellTempFormatted: snap.effectivePrBreakdown.cellTempFormatted,
      ambientTempFormatted: snap.weatherNow.tempExactFormatted,
      tempFactorPct: +(snap.effectivePrBreakdown.tempFactor * 100).toFixed(1),
      heatDeratingPct,
      thermalSafetyMarginC,
      windSpeedKmh,
      windGustsKmh,
      gustAlert,
    },
  };
}
