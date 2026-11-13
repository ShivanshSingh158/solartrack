/**
 * Plant configuration, physics calibration overrides, and persisted user settings contracts.
 */

export type MountingType = 'open_rack' | 'flush_rcc';
export type TemperatureUnit = 'C' | 'F';
export type PanelTechPresetId = 'mono_perc' | 'topcon' | 'hjt' | 'poly' | 'custom';

export interface InverterLossCoeffs {
  tareKw: number;
  linearLoss: number;
  quadLoss: number;
  cutoffKw: number;
  referenceAcKw?: number;
}

export interface DashboardCapabilities {
  hasSmartMeter: boolean;
  hasWeatherSensor: boolean;
  hasBattery: boolean;
}

export interface DashboardInitResponse {
  errno: number;
  capabilities: DashboardCapabilities;
  defaultTariff: number;
  systemCapacity: number;
  currency: string;
  timezone: string;
}

export interface PersistedAppSettings {
  billingCycleDay: number;
  lastCleanedDate?: string | null;
  cleaningEvents?: Array<{ ymd: string; timestampIso?: string; type?: string; note?: string }>;
  plantLocation?: { name: string; lat: number; lon: number };
  plantDisplayName?: string | null;
  commissioningDateOverride?: string | null;
  tariffPerKwh: number;
  systemCapacity: number;
  dcCapacityKwp?: number;
  acInverterCapacityKw?: number;
  mountingType?: MountingType;
  roofAlbedo?: number;
  dcCleanFactor?: number;
  useCalibratedTwin?: boolean;
  kSiteOverride?: number | null;
  inverterTareKw?: number | null;
  inverterLinearLoss?: number | null;
  inverterQuadLoss?: number | null;
  physicalEtotalKwh?: number | null;
  physicalEtotalCloudRefKwh?: number | null;
  physicalEtotalSetAtYmd?: string | null;
  physicalEtotalSetAtMin?: number | null;
  physicalEmonthKwh?: number | null;
  physicalEmonthCloudRefKwh?: number | null;
  physicalEmonthYm?: string | null;
  physicalEmonthSetAtYmd?: string | null;
  physicalEmonthSetAtMin?: number | null;
  manualGridOffDates?: string[];
  systemCost: number;
  govtSubsidyInr?: number;
  panelWashCostInr?: number;
  tariffEscalationPct?: number;
  arrayTiltDeg?: number;
  arrayAzimuthDeg?: number;
  panelTechPreset?: PanelTechPresetId;
  thermalCoeffPerC?: number;
  basePrAtStc?: number;
  inverterEfficiency?: number;
  panelDegradationPctYr?: number;
  co2KgPerKwh?: number;
  tempUnit: TemperatureUnit;
  packetAlertsEnabled: boolean;
  alertOfflineDelay: boolean;
  offlineDelayMinutes?: number;
  alertMorningYield: boolean;
  alertUnderperformance: boolean;
  underperformanceThresholdPct?: number;
  alertVoltageSpike: boolean;
  washRecommendPct?: number;
  rainResetDailyMm?: number;
  weatherCacheTtlMin?: number;
}

export interface CanonicalSettingsInput {
  tariffPerKwh: number;
  systemCost: number;
  systemCapacity: number;
  dcCapacityKwp?: number;
  acInverterCapacityKw?: number;
  mountingType?: MountingType;
  roofAlbedo?: number;
  dcCleanFactor?: number;
  useCalibratedTwin?: boolean;
  kSiteOverride?: number | null;
  inverterTareKw?: number | null;
  inverterLinearLoss?: number | null;
  inverterQuadLoss?: number | null;
  physicalEtotalKwh?: number | null;
  physicalEtotalCloudRefKwh?: number | null;
  physicalEtotalSetAtYmd?: string | null;
  physicalEtotalSetAtMin?: number | null;
  physicalEmonthKwh?: number | null;
  physicalEmonthCloudRefKwh?: number | null;
  physicalEmonthYm?: string | null;
  physicalEmonthSetAtYmd?: string | null;
  physicalEmonthSetAtMin?: number | null;
  manualGridOffDates?: string[];
  billingCycleDay: number;
  tempUnit?: TemperatureUnit;
  plantLocation?: { name?: string; lat?: number; lon?: number };
  plantDisplayName?: string | null;
  commissioningDateOverride?: string | null;
  arrayTiltDeg?: number;
  arrayAzimuthDeg?: number;
  panelTechPreset?: PanelTechPresetId;
  thermalCoeffPerC?: number;
  basePrAtStc?: number;
  inverterEfficiency?: number;
  panelDegradationPctYr?: number;
  co2KgPerKwh?: number;
  washRecommendPct?: number;
  rainResetDailyMm?: number;
  offlineDelayMinutes?: number;
  underperformanceThresholdPct?: number;
  weatherCacheTtlMin?: number;
}
