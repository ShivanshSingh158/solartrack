import type { IstClockParts } from '../time/istDate.ts';
import type { SolarIntelligenceReport } from './intelligence.ts';
import type {
  DailySolarPhysicsModel,
  EnvironmentEquivalents,
  FreshnessReport,
  LiveNowcastResult,
  MasterSimulationState,
  TelemetrySunContext,
} from './physics.ts';
import type { CanonicalSettingsInput, MountingType, PanelTechPresetId, TemperatureUnit } from './settings.ts';
import type {
  DeviceRealAllData,
  HistoryReportDataPoint,
  LiveFlowData,
  LiveSyncLastSyncedDay,
  PlantAlarmsPayload,
  RawSeries,
  SinglePlantSummary,
} from './telemetry.ts';
import type { SolarWeatherResponse } from './weather.ts';

export interface BuildCanonicalSolarSnapshotInput {
  now?: Date;
  simState?: MasterSimulationState;
  settings: CanonicalSettingsInput;
  summaryData?: SinglePlantSummary | null;
  flowData?: LiveFlowData | { result?: LiveFlowData } | null;
  monthDays?: HistoryReportDataPoint[];
  prevMonthDays?: HistoryReportDataPoint[];
  todayRaw?: RawSeries[] | null;
  yesterdayRaw?: RawSeries[] | null;
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
  weatherData?: SolarWeatherResponse | null;
  intelligenceReport?: SolarIntelligenceReport | null;
  cachedSoiling?: SolarIntelligenceReport['soiling'] | null;
  lastCleanedDate?: string | null;
  weatherCondition?: { type?: string; label?: string } | null;
  commissioningYmd?: string;
  realElectrical?: DeviceRealAllData | null;
  alarms?: PlantAlarmsPayload | null;
}

export interface CanonicalSnapshotDayRow {
  ymd: string;
  shortLabel: string;
  kwh: number;
  cloudKwh?: number;
  bufferKwh?: number;
  isEstimated: boolean;
  modeledKwh: number;
  savingsInr: number;
  peakKwEst: number | null;
  conditionLabel: string;
}

export interface CanonicalSolarSnapshot {
  clock: IstClockParts;
  config: {
    capacityKwp: number;
    dcCapacityKwp: number;
    acInverterCapacityKw: number;
    mountingType: MountingType;
    roofAlbedo: number;
    dcCleanFactor: number;
    useCalibratedTwin: boolean;
    kSiteApplied: number;
    tariffPerKwh: number;
    systemCost: number;
    billingCycleDay: number;
    tempUnit: TemperatureUnit;
    lat: number;
    lon: number;
    locationName: string;
    plantDisplayName: string;
    commissioningYmd: string;
    commissioningDisplay: string;
    arrayTiltDeg: number;
    arrayAzimuthDeg: number;
    panelTechPreset: PanelTechPresetId;
    thermalCoeffPerC: number;
    basePrAtStc: number;
    inverterEfficiency: number;
    panelDegradationPctYr: number;
    washRecommendPct: number;
    rainResetDailyMm: number;
    offlineDelayMinutes: number;
    underperformanceThresholdPct: number;
    weatherCacheTtlMin: number;
    physicalEtotalKwh: number | null;
    physicalEtotalCloudRefKwh: number | null;
    physicalEtotalSetAtYmd: string | null;
    physicalEtotalSetAtMin: number | null;
    physicalEmonthKwh: number | null;
    physicalEmonthCloudRefKwh: number | null;
    physicalEmonthYm: string | null;
    physicalEmonthSetAtYmd: string | null;
    physicalEmonthSetAtMin: number | null;
    manualGridOffDates: string[];
    co2FactorKgPerKwh: number;
    coalFactorKgPerKwh: number;
    treeCo2KgPerYear: number;
    physicsOverrides: {
      dcCapacityKwp: number;
      acInverterCapacityKw: number;
      arrayTiltDeg: number;
      arrayAzimuthDeg: number;
      gtiReferenceAzimuthDeg?: number;
      mountingType: MountingType;
      roofAlbedo: number;
      dcCleanFactor: number;
      thermalCoeffPerC: number;
      basePrAtStc: number;
      inverterEfficiency: number;
      kSite: number;
      inverterLossCoeffs: {
        tareKw?: number;
        linearLoss?: number;
        quadLoss?: number;
        cutoffKw?: number;
        referenceAcKw?: number;
      } | null;
      hourlyShadeFactors: number[] | null;
    };
  };
  sun: TelemetrySunContext & {
    solarNoonMin: number;
    solarNoonText: string;
    daylightMinutes: number;
    daylightDurationText: string;
    isPreSunrise: boolean;
    isAfterSunset: boolean;
    isNight: boolean;
    isDaylightWindow: boolean;
  };
  soiling: {
    surfaceLossPct: number;
    actionState: string;
    actionBadgeText: string;
    actionHeadline: string;
    actionAdvice: string;
    daysSinceWash: number;
    lastWashYmd: string;
    stickyFilmActive: boolean;
    hasRainHold: boolean;
    recoverableKwhPerDay: number;
    recoverableInrPerWeek: number;
    aod: number;
    pm10: number;
    pm25: number;
    usAqi: number;
    dewActiveNow: boolean;
    source: 'intelligence' | 'cached_intelligence' | 'weather_baseline';
  };
  weatherNow: {
    tempC: number | null;
    tempDisplayVal: number | null;
    tempFormatted: string;
    tempExactFormatted: string;
    humidityPct: number | null;
    windSpeedKmh: number | null;
    cloudCoverPct: number | null;
    shortwaveWm2: number;
    gtiWm2: number;
    dniWm2: number;
    diffuseWm2: number;
    directWm2: number;
    conditionLabel: string;
    conditionType: string;
  };
  effectivePrBreakdown: {
    pr: number;
    prPct: number;
    dcPrPct: number;
    inverterEffPct: number;
    cellTempC: number;
    cellTempFormatted: string;
    tempFactor: number;
    surfaceFactor: number;
    smogFactor: number;
    smogLossPct: number;
  };
  todayPhysics: {
    model: DailySolarPhysicsModel;
    nowcast: LiveNowcastResult;
    current: {
      kwNow: number;
      cumKwh: number;
      gti: number;
      progressPctOfDay: number;
      daylightElapsedPct: number;
    };
  };
  truth: FreshnessReport & {
    isOnline: boolean;
    isStale: boolean;
    isNight: boolean;
    isFault: boolean;
  };
  hero: {
    displayedKw: number;
    peakKw: number;
    peakTimeText: string;
    statusLabel: string;
    isEstimated: boolean;
    isNight: boolean;
  };
  today: {
    displayKwh: number;
    cloudKwh: number;
    bufferKwh: number;
    eepromConfirmedGapKwh: number;
    suspectedGridCut: boolean;
    isManualGridOff: boolean;
    rawConfirmedKwh: number;
    fullDayTargetKwh: number;
    expectedKwNow: number;
    liveKw: number;
    expectedSoFarKwh: number;
    realYieldFromCurveKwh: number;
    curveStartLabel: string | null;
    curveEndLabel: string | null;
    isPartialCurve: boolean;
    progressPctOfTarget: number;
    daylightElapsedPct: number;
    savingsInr: number;
    expectedSavingsInr: number;
    isEstimated: boolean;
    isConfirmed: boolean;
    isHybridStitched: boolean;
    confirmedPartKwh: number;
    stitchedSatDeltaKwh: number;
    lastSyncMinIst: number | null;
    isNightAwaitStart: boolean;
    isNightDone: boolean;
  };
  yesterday: {
    ymd: string;
    shortLabel: string;
    displayKwh: number;
    isEstimated: boolean;
    isConfirmed: boolean;
    savingsInr: number;
    expectedKwh: number;
    vsModelPct: number | null;
    lastSyncedLabel: string | null;
    lastSyncedKwh: number | null;
  };
  month: {
    mtdKwh: number;
    unloggedKwh: number;
    physicalTotalKwh: number;
    isEmonthAnchored: boolean;
    hardwareSource: 'waaree-api' | 'manual' | null;
    eMonthAnchorKwh: number | null;
    eMonthAnchorDeltaKwh: number;
    eMonthSetAtYmd: string | null;
    eMonthSyncedLabel: string | null;
    confirmedDaysSumKwh: number;
    savingsInr: number;
    savingsFormatted: string;
    physicalSavingsInr: number;
    physicalSavingsFormatted: string;
    dailyAvgKwh: number;
    activeSyncedDaysCount: number;
    elapsedDaysInMonth: number;
    daysInMonth: number;
    pendingDaysCount: number;
    syncedThroughLabel: string;
    progressPctOfMonth: number;
    bestDayNum: number | null;
    bestDayLabel: string;
    bestDayKwh: number;
    projectedKwh: number;
    projectedSavingsInr: number;
  };
  lifetime: {
    confirmedKwh: number;
    unloggedKwh: number;
    physicalTotalKwh: number;
    savingsInr: number;
    savingsFormatted: string;
    physicalSavingsInr: number;
    physicalSavingsFormatted: string;
    isEtotalAnchored: boolean;
    hardwareSource: 'waaree-api' | 'manual' | null;
    eTotalAnchorKwh: number | null;
    eTotalAnchorDeltaKwh: number;
    eTotalSetAtYmd: string | null;
    eTotalSyncedLabel: string | null;
    commissioningYmd: string;
    commissioningDisplay: string;
  };
  environmental: {
    lifetime: EnvironmentEquivalents;
    lifetimePhysical: EnvironmentEquivalents;
    month: EnvironmentEquivalents;
  };
  discomCycle: {
    billingCycleDay: number;
    cyclePeriodText: string;
    cycleYieldKwh: number;
    unloggedCycleKwh: number;
    physicalCycleYieldKwh: number;
    physicalCycleBillInr: number;
    cycleEstimatedBillInr: number;
    cycleBillFormatted: string;
    cycleStartYmd: string;
    cycleEndYmd: string;
    cycleStartLabel: string;
    cycleEndLabel: string;
    cycleTotalDays: number;
    daysElapsedInCycle: number;
    daysRemainingInCycle: number;
    dailyCycleAvgKwh: number;
    projectedCycleKwh: number;
    projectedCycleBillInr: number;
  };
  roi: {
    systemCost: number;
    totalSavedInr: number;
    physicalSavedInr: number;
    paybackPct: number;
    physicalPaybackPct: number;
    remainingInr: number;
    physicalRemainingInr: number;
    isPaybackComplete: boolean;
    monthlyProjectedInr: number;
    annualProjectedInr: number;
    paybackYearsRemaining: number | null;
    specificYieldKwhPerKwp: number;
    specificYieldDailyAvg: number;
  };
  tomorrow: {
    ymd: string;
    shortLabel: string;
    expectedKwh: number;
    expectedSavingsInr: number;
    condition: string;
    conditionType: string;
    sunshineHours: number;
    tempMinFormatted: string;
    tempMaxFormatted: string;
    peakKw: number;
    peakTimeLabel: string;
    peakWindowStart: string;
    peakWindowEnd: string;
    skyBadgeText: string;
  };
  directDiffuse: {
    available: boolean;
    directPct: number | null;
    diffusePct: number | null;
    ghiWm2: number | null;
    gtiWm2: number | null;
    dniWm2: number | null;
    label: string;
    reason: string;
  };
  thermalAndElectrical: {
    cellTempC: number | null;
    cellTempFormatted: string;
    ambientTempFormatted: string;
    tempFactorPct: number;
    effectivePrPct: number;
    dcKw: number | null;
    acKw: number | null;
    inverterEfficiencyPct: number | null;
    inverterEfficiencySource: 'live_telemetry' | 'physics_modeled' | 'standby';
    theoreticalKwAtIrradiance: number;
    gridVoltageV: number | null;
    gridVoltageFormatted: string;
    gridFreqHz: number | null;
    gridFreqFormatted: string;
    acCurrentEstAmps: number | null;
    isNightStandby: boolean;
    firmwareText: string;
  };
  recent7Daily: CanonicalSnapshotDayRow[];
  sunEfficiencyScore: {
    scorePct: number | null;
    totalRealKwh: number;
    totalExpectedKwh: number;
    syncedDaysEvaluated: number;
    gradeLabel: string;
    note: string;
  };
  reportCard: {
    todayKwh: number;
    specificYield: number;
    grade: 'A' | 'B' | 'C';
    gradeLabel: string;
    peakKw: number;
    peakTime: string;
    tomorrowKwh: number;
    savingsInr: number;
    co2Kg: string;
    trees: number;
  };
  reconciledBufferByYmd: Record<string, number>;
  realElectrical?: DeviceRealAllData | null;
  alarms?: PlantAlarmsPayload | null;
}
