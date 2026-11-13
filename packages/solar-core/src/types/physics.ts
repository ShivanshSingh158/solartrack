import type { InverterLossCoeffs, MountingType } from './settings.ts';

export interface EffectiveSolarPrParams {
  ambientTempC?: number | null;
  windSpeedKmh?: number | null;
  gtiWm2?: number | null;
  surfaceLossPct?: number | null;
  aod?: number | null;
  pm10?: number | null;
  pm25?: number | null;
  thermalCoeffPerC?: number | null;
  dcCleanFactor?: number | null;
  basePrAtStc?: number | null;
  inverterEfficiency?: number | null;
  mountingType?: MountingType | null;
  dcCapacityKwp?: number | null;
  acInverterCapacityKw?: number | null;
  inverterLossCoeffs?: Partial<InverterLossCoeffs> | null;
  kSite?: number | null;
  iamFactor?: number | null;
  cosThetaZ?: number | null;
  cosThetaInc?: number | null;
}

export interface EffectiveSolarPrResult {
  pr: number;
  dcPr: number;
  dcKw: number;
  acKw: number;
  cellTempC: number;
  tempFactor: number;
  surfaceFactor: number;
  smogFactor: number;
  tauSmog: number;
  smogLossFrac: number;
  inverterEta: number;
}

export interface AtmosphericAerosolResult {
  tauAtmos: number;
  deltaTauCol: number;
  airMass: number;
  tauSmogCompat: number;
  tauSlantCompat: number;
}

export interface EnvironmentEquivalents {
  co2KgNum: number;
  co2Kg: string;
  co2Tons: string;
  coalKgNum: number;
  coalKg: string;
  trees: number;
  exactTrees: number;
  nextTreeTarget: number;
  treeProgressPct: number;
  kmAvoided: string;
}

export interface TelemetrySunContext {
  sunriseMin?: number;
  sunsetMin?: number;
  sunriseText?: string;
  sunsetText?: string;
  todayEstKwh?: number;
  todayRadMj?: number;
  nowMinutesIst?: number;
  capacityKwp?: number;
  hasTodayActiveCurve?: boolean;
  todayCurveKwh?: number;
}

export interface FreshnessReport {
  status: 'LIVE' | 'DELAYED' | 'OFFLINE_STALE' | 'NIGHT_SLEEP' | 'GRID_OUTAGE' | 'FAULT' | 'WARMUP';
  badgeColor: 'green' | 'amber' | 'grey' | 'blue' | 'red';
  statusHeadline: string;
  exactTimestampIST: string;
  relativeAgo: string;
  diffMinutes: number;
  isDataTrustworthy: boolean;
  isFromToday: boolean;
  safeGenerationKw: number | null;
  safeYieldTodayKwh: number | null;
  yesterdayFinalYieldKwh?: number;
  reassuranceBanner: string | null;
  heroNotice?: {
    type: 'info' | 'warning' | 'standby' | 'alert';
    title: string;
    description: string;
    subNote?: string;
  };
}

export type MasterSimulationState = 'auto';

export interface AstronomicalSunTimes {
  sunriseMin: number;
  sunsetMin: number;
  noonMin: number;
  daylightMin: number;
  sunriseText: string;
  sunsetText: string;
  noonText: string;
  daylightText: string;
}

export interface DailySolarPhysicsInput {
  sunriseIso?: string | null;
  sunsetIso?: string | null;
  ymd?: string;
  lat?: number;
  lon?: number;
  hourlyGti?: number[];
  minutely15Gti?: number[];
  radiationMjM2?: number | null;
  capacityKwp?: number;
  dcCapacityKwp?: number | null;
  acInverterCapacityKw?: number | null;
  arrayTiltDeg?: number | null;
  arrayAzimuthDeg?: number | null;
  mountingType?: MountingType | null;
  roofAlbedo?: number | null;
  surfaceLossPct?: number;
  ambientTempC?: number | null;
  windSpeedKmh?: number | null;
  aod?: number | null;
  pm10?: number | null;
  pm25?: number | null;
  hourlyGtiInstant?: number[];
  minutely15GtiInstant?: number[];
  hourlyTempC?: number[];
  hourlyWindKmh?: number[];
  hourlyAod?: number[];
  hourlyPm10?: number[];
  hourlyDiffuse?: number[];
  hourlyDni?: number[];
  hourlyCloudCover?: number[];
  gtiReferenceAzimuthDeg?: number | null;
  hourlyShadeFactors?: number[] | null;
  thermalCoeffPerC?: number | null;
  dcCleanFactor?: number | null;
  basePrAtStc?: number | null;
  inverterEfficiency?: number | null;
  kSite?: number | null;
  inverterLossCoeffs?: Partial<InverterLossCoeffs> | null;
}

export interface DailySolarPhysicsPoint {
  minutes: number;
  gti: number;
  dcKw: number;
  kw: number;
  etaPct: number;
  cumKwh: number;
}

export interface DailySolarPhysicsModel {
  sunriseMin: number;
  sunsetMin: number;
  noonMin: number;
  daylightMin: number;
  sunriseText: string;
  sunsetText: string;
  solarNoonText: string;
  daylightText: string;
  targetDailyModelKwh: number;
  effectivePr: number;
  effectiveDcPr: number;
  weightedInvEtaPct: number;
  tauSmogAvg: number;
  tauSlantAvg?: number;
  kSiteApplied: number;
  iamAtPeak: number;
  cellTempC: number;
  usedTiltedGti: boolean;
  usedInstantGti: boolean;
  points: DailySolarPhysicsPoint[];
  peakDcKw: number;
  peakKw: number;
  peakMinutes: number;
  peakTimeText: string;
  lookupAtMinute: (targetMin: number) => { kw: number; cumKwh: number; gti: number };
}

export interface HybridTodayStitchResult {
  displayKwh: number;
  fullDayTargetKwh: number;
  confirmedPartKwh: number;
  stitchedSatDeltaKwh: number;
  isHybridStitched: boolean;
  lastSyncMinIst: number | null;
}

export type LiveNowcastSkyMode =
  | 'clear_nominal'
  | 'cloud_lensing'
  | 'passing_clouds'
  | 'haze_veil'
  | 'mild_attenuation';

export interface LiveNowcastResult {
  active: boolean;
  ratio: number;
  samplesUsed: number;
  lastPointMinIst: number | null;
  horizonMinutes: number;
  halfLifeMinutes: number;
  sigmaDeltaK: number;
  skyMode: LiveNowcastSkyMode;
  skyBadge: string | null;
  baseRemainingKwh: number;
  blendedRemainingKwh: number;
  blendedFullDayTargetKwh: number;
  evaluateFactorAtMinute: (targetMin: number) => number;
  buildBlendedRemainingPoints: (fromMinIst?: number) => DailySolarPhysicsPoint[];
}

export interface SkyAnomalyPeakLensing {
  minutes: number;
  timeText: string;
  realKw: number;
  modelKw: number;
  boostPct: number;
  ratio: number;
  badge: string;
}

export interface UnforecastedSkyEvent {
  kind: 'unforecasted_haze_veil' | 'unforecasted_clouds';
  startMin: number;
  endMin: number;
  startTimeText: string;
  avgDropPct: number;
  sigmaDeltaK: number;
  badge: string;
  reasonLabel: string;
}

export interface DaySkyAnomalyReport {
  hasCloudLensing: boolean;
  peakLensing: SkyAnomalyPeakLensing | null;
  lensingMinutes: number[];
  unforecastedEvent: UnforecastedSkyEvent | null;
  isLensingAtMinute: (minute: number, toleranceMin?: number) => SkyAnomalyPeakLensing | null;
}
