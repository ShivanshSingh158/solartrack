import type { ClassifiedGapHole } from './gap.ts';
import type { SkyAnomalyPeakLensing, UnforecastedSkyEvent } from './physics.ts';
import type { InverterLossCoeffs, MountingType } from './settings.ts';

export type WashEventSource = 'manual' | 'rain_auto' | 'rain_partial';

export interface CleaningEvent {
  ymd: string;
  timestampIso: string;
  type: WashEventSource;
  precipMm?: number;
  note?: string;
}

export interface DailyAtmosphereRecord {
  ymd: string;
  sunrise?: string | null;
  sunset?: string | null;
  radiationMjM2?: number | null;
  clearSkyMjM2?: number | null;
  sunshineDurationHours?: number | null;
  weatherCode?: number | null;
  tempMax?: number | null;
  tempMin?: number | null;
  precipitationSum?: number | null;
  rainSum?: number | null;
  precipitationProbMax?: number | null;
  hourlyGti?: number[];
  hourlyGtiInstant?: number[];
  minutely15Gti?: number[];
  minutely15GtiInstant?: number[];
  hourlyClearSkyGhi?: number[];
  hourlyCloudCover?: number[];
  hourlyTempC?: number[];
  hourlyDewPointC?: number[];
  hourlyRhPct?: number[];
  hourlyRainMm?: number[];
  hourlyPrecipMm?: number[];
  hourlyWindKmh?: number[];
  hourlyVisibilityM?: number[];
  hourlyWeatherCode?: number[];
  hourlyPm10?: number[];
  hourlyPm25?: number[];
  hourlyDust?: number[];
  hourlyAod?: number[];
  hourlyUsAqi?: number[];
  hourlyDni?: number[];
  hourlyDiffuse?: number[];
  gtiFetchedAzimuthDeg?: number;
}

export interface DailyGenerationRecord {
  ymd: string;
  realKwh: number | null;
  isConfirmed: boolean;
  onlineCoveragePct?: number | null;
  coverageNote?: string | null;
  rawSeries?: Array<{ variable?: string; data?: Array<{ time: string; value: number }> }>;
}

export interface SolarIntelligenceInput {
  todayYmd: string;
  todayHasLivePackets?: boolean;
  nowMinutesIst: number;
  commissioningYmd: string;
  capacityKwp: number;
  dcCapacityKwp?: number;
  acInverterCapacityKw?: number;
  tariffPerKwh: number;
  tiltDegrees?: number;
  azimuthDegrees?: number;
  latitudeDeg?: number;
  longitudeDeg?: number;
  mountingType?: MountingType;
  roofAlbedo?: number;
  thermalCoeffPerC?: number;
  dcCleanFactor?: number;
  basePrAtStc?: number;
  inverterEfficiency?: number;
  useCalibratedTwin?: boolean;
  kSiteOverride?: number | null;
  inverterTareKw?: number | null;
  inverterLinearLoss?: number | null;
  inverterQuadLoss?: number | null;
  washRecommendPct?: number;
  rainResetDailyMm?: number;
  currentWeather?: {
    temperatureC?: number | null;
    dewPointC?: number | null;
    humidityPct?: number | null;
    precipitationMm?: number | null;
    windSpeedKmh?: number | null;
    cloudCoverPct?: number | null;
    weatherCode?: number | null;
    pm10?: number | null;
    pm25?: number | null;
    dust?: number | null;
    aod?: number | null;
    usAqi?: number | null;
  };
  days: DailyAtmosphereRecord[];
  generationByYmd: Record<string, DailyGenerationRecord>;
  manualCleanEvents: CleaningEvent[];
  manualGridOffDates?: string[];
}

export type DayAtmosphereTag =
  | 'MANUAL_WASH'
  | 'RAIN_WASH'
  | 'PARTIAL_RINSE'
  | 'DRIZZLE_MUD'
  | 'FOG_DEW'
  | 'DUST_SPIKE'
  | 'DRY_HAZE'
  | 'CLEAR';

export type DipAttributionCategory =
  | 'OPTIMAL'
  | 'CLOUD_RAIN'
  | 'FOG_HAZE'
  | 'OUTAGE_GAP'
  | 'SOILING_DRIFT'
  | 'BELOW_BASELINE'
  | 'WIFI_OUTAGE_UNLOGGED'
  | 'PENDING_SYNC';

export interface DailyPerformanceLedgerEntry {
  ymd: string;
  shortLabel: string;
  sunrise: string | null;
  sunset: string | null;
  idealClearSkyKwh: number;
  weatherCleanKwh: number;
  radBaselineKwh: number;
  modeledAfterSoilingKwh: number;
  realKwh: number | null;
  isConfirmed: boolean;
  onlineCoveragePct: number | null;
  coverageNote: string | null;
  weatherAttenuationPct: number;
  hazeOpticalLossPct: number;
  realVsModelPct: number | null;
  realVsIdealPct: number | null;
  pm10Avg: number;
  pm25Avg: number;
  dustAvg: number;
  aodAvg: number;
  usAqiMax: number;
  rainMm: number;
  maxHourlyRainMm: number;
  dewGlueHours: number;
  fogHours: number;
  minVisibilityM: number | null;
  windAvgKmh: number;
  dayCloudAvgPct: number;
  dailySoilingDeltaPct: number;
  particleSurfaceLossPct: number;
  stickyFilmActive: boolean;
  eventTag: DayAtmosphereTag;
  eventLabel: string;
  dipCategory: DipAttributionCategory;
  skyAnomalyBadge?: string | null;
  cloudEdgeLensing?: SkyAnomalyPeakLensing | null;
  unforecastedSkyEvent?: UnforecastedSkyEvent | null;
  dipReasonLabel: string;
  unloggedEstimatedKwh?: number;
  bufferKwh?: number;
  eepromConfirmedPreKwh?: number;
  onlineKwh?: number;
  suspectedGridCut?: boolean;
  isManualGridOff?: boolean;
  gapHoles?: ClassifiedGapHole[];
  isClearCheckDay: boolean;
}

export type WashActionState = 'CLEAN' | 'WATCH_BUILDUP' | 'WASH_NOW' | 'HOLD_FOR_RAIN';

export interface WeeklyComparisonWindow {
  label: string;
  rangeLabel: string;
  startYmd: string;
  endYmd: string;
  daysCount: number;
  confirmedDaysCount: number;
  realAvgKwh: number;
  modelAvgKwh: number;
  idealAvgKwh: number;
  realTotalKwh: number;
  modelTotalKwh: number;
  normalizedPerfPct: number | null;
  weatherAttenuationPct: number;
  biggestDip: {
    ymd: string;
    shortLabel: string;
    realKwh: number;
    modelKwh: number;
    pct: number;
    reason: string;
  } | null;
}

export interface ForecastDayOutlook {
  ymd: string;
  shortLabel: string;
  condition: string;
  conditionType: string;
  baselineExpectedKwh: number;
  tiltedCleanExpectedKwh: number;
  asIsExpectedKwh: number;
  soilingPenaltyKwh: number;
  sunshineHours: number;
  tempMin: number;
  tempMax: number;
  peakKw: number;
  peakTimeLabel: string;
  peakWindowStart: string | null;
  peakWindowEnd: string | null;
  peakWindowNote: string;
  rainMm: number;
  rainProbPct: number;
  fogHours: number;
  minVisibilityM: number | null;
  hasDewNight: boolean;
  pm10Avg: number;
  pm25Avg: number;
  dustAvg: number;
  aodAvg: number;
  skyBadgeText: string;
}

export interface SiteCalibrationReport {
  enabled: boolean;
  kSiteApplied: number;
  kSiteLearned: number | null;
  kSiteSource: 'clean_day_fitted' | 'manual_override' | 'raw_uncalibrated' | 'insufficient_clean_days';
  cleanDaysUsed: number;
  cleanDayYmds: string[];
  apparentDcCapacityKwp: number | null;
  effectiveAzimuthDeg?: number | null;
  azimuthOffsetDeg?: number | null;
  azimuthLearned?: boolean;
  azimuthSampleDays?: number;
  inverterCoeffs: InverterLossCoeffs;
  inverterSource: 'empirical_fitted' | 'waaree_baseline' | 'manual_override';
  inverterSamplesCount: number;
  inverterRmseWatts: number | null;
  hourlyShadeFactors: number[];
  shadedHoursSummary: Array<{ hour: number; factor: number }>;
  note: string;
}

export interface SolarIntelligenceReport {
  generatedAtIstYmd: string;
  capacityKwp: number;
  tariffPerKwh: number;
  commissioningYmd: string;
  siteCalibration?: SiteCalibrationReport;
  soiling: {
    surfaceLossPct: number;
    particleModelLossPct: number;
    empiricalDriftPct: number | null;
    empiricalUsed: boolean;
    confidenceLabel: string;
    confidenceSource: 'empirical_blended' | 'clear_verified' | 'particle_physics';
    stickyFilmActive: boolean;
    lastClean: {
      ymd: string;
      shortLabel: string;
      source: WashEventSource;
      daysAgo: number;
      precipMm?: number;
      label: string;
    };
    recentRainWash: CleaningEvent | null;
    actionState: WashActionState;
    actionBadgeText: string;
    actionHeadline: string;
    actionAdvice: string;
    bestWashTimeText: string;
    recoverableKwhPerDay: number;
    recoverableKwhPerWeek: number;
    recoverableInrPerWeek: number;
    estimatedDaysToThreshold: number | null;
    estimatedNextWashYmd: string | null;
    estimatedNextWashLabel: string | null;
    incomingRainHold: {
      ymd: string;
      shortLabel: string;
      rainMm: number;
      probPct: number;
    } | null;
    statsSinceWash: {
      daysCount: number;
      avgPm10: number;
      avgPm25: number;
      avgDust: number;
      avgAod: number;
      dewNightsCount: number;
      fogDaysCount: number;
      drizzleMudEvents: number;
      skyHazeLossPct: number;
      dailyAccumRatePct: number;
    };
    currentSnapshot: {
      pm10: number;
      pm25: number;
      dust: number;
      aod: number;
      usAqi: number;
      dewSpreadC: number | null;
      dewActiveNow: boolean;
      precipitationMm: number;
      windKmh: number;
    };
  };
  weeklyComparison: {
    latestWindow: WeeklyComparisonWindow | null;
    priorWindow: WeeklyComparisonWindow | null;
    olderWindow: WeeklyComparisonWindow | null;
    perfDeltaVsPriorPct: number | null;
    weatherDeltaVsPriorPct: number | null;
    headlineSummary: string;
  };
  tomorrowOutlook: ForecastDayOutlook | null;
  extendedForecast: ForecastDayOutlook[];
  dailyLedger: DailyPerformanceLedgerEntry[];
  cleaningHistory: CleaningEvent[];
}

export interface UnifiedPhysicsOptions {
  dcCapacityKwp?: number;
  acInverterCapacityKw?: number;
  lonDeg?: number;
  azimuthDegrees?: number;
  mountingType?: MountingType;
  roofAlbedo?: number;
  thermalCoeffPerC?: number;
  dcCleanFactor?: number;
  basePrAtStc?: number;
  inverterEfficiency?: number;
  kSite?: number;
  inverterLossCoeffs?: Partial<InverterLossCoeffs> | null;
  hourlyShadeFactors?: number[] | null;
  gtiReferenceAzimuthDeg?: number | null;
}

export interface SolarIntelligenceResponse {
  errno: number;
  stationId: string;
  plantName?: string;
  plantLocation?: {
    name: string;
    lat: number;
    lon: number;
  };
  inBackoff?: boolean;
  report: SolarIntelligenceReport;
  error?: string;
}
