import type { SolarIntelligenceReport } from './intelligence.ts';
import type { DayComparisonWeather, SolarWeatherResponse } from './weather.ts';

export interface Plant {
  stationID: string;
  plantName: string;
  country?: string;
  capacity?: string | number;
  createdDate?: string;
}

export interface Account {
  id: string;
  username: string;
  plants: Plant[];
  lastSync?: string;
}

export interface PlantSummaryItem {
  stationID: string;
  plantName: string;
  accountUser: string;
  capacity: number;
  liveSolarPower: number;
  liveInverterPower: number;
  liveGridPower: number;
  yieldToday: number;
  monthYield: number;
  lifetimeYield: number;
  statusText: string;
}

export interface CombinedSummary {
  totalPlants: number;
  totalCapacity: number;
  liveSolarPower: number;
  liveInverterPower: number;
  liveGridPower: number;
  yieldToday: number;
  yieldMonth: number;
  yieldLifetime: number;
  plants: PlantSummaryItem[];
}

export interface SinglePlantSummary {
  generationToday: number;
  generationYesterday?: number;
  generationMonth: number;
  generationTotal: number;
  hardwareTodayKwh?: number | null;
  hardwareMonthKwh?: number | null;
  hardwareYearKwh?: number | null;
  hardwareTotalKwh?: number | null;
  hardwareSyncedYmd?: string | null;
  hardwareSyncedMin?: number | null;
  hardwareSyncedLabel?: string | null;
  earningsSource?: string | null;
  earningsCurrency?: string | null;
  monthEarnings?: number | null;
  cumulateEarnings?: number | null;
  lastUpdateDate: string;
  capacity: string;
  country: string;
}

export interface PowerFlowNode {
  solar?: { power?: { value?: string; unit?: string } };
  device?: { power?: { value?: string; unit?: string }; state?: number };
  gen?: { power?: { value?: string; unit?: string } };
  grid?: { power?: { value?: string; unit?: string } };
  load?: { power?: { value?: string; unit?: string } };
  charger?: { power?: { value?: string; unit?: string }; soc?: number };
}

export interface LiveFlowData {
  node?: PowerFlowNode;
  status?: {
    yieldToday?: string | number;
    lastUpdateDate?: string;
    state?: number;
  };
}

export interface RawTelemetryPoint {
  time: string;
  value: number;
}

export interface RawSeries {
  variable: string;
  name?: string;
  unit?: string;
  data: RawTelemetryPoint[];
}

export interface MergedTimePoint {
  time: string;
  combined: number;
  plants: Record<string, number>;
}

export interface HistoryReportDataPoint {
  index: number;
  value: number;
}

export interface HistoryReportSeries {
  variable: string;
  data: HistoryReportDataPoint[];
}

export type TimescaleMode = 'day' | 'week' | 'month' | 'year';

export type TabType = 'home' | 'performance' | 'health' | 'savings' | 'settings';

export interface TableRowData {
  time: string;
  output: string;
  pv: string;
  feedin: string;
  status: string;
  model?: string;
  capturePct?: string;
  note?: string;
}

export interface ServerIstClockSnapshot {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ymd: string;
  ym: string;
  daysInMonth: number;
  monthShort: string;
  monthUpper: string;
  monthFull: string;
  minutesSinceMidnight: number;
  clockLabel: string;
  todayShortLabel: string;
  todayUpperLabel: string;
  yesterdayYmd: string;
  yesterdayDay: number;
  yesterdayMonth: number;
  yesterdayShortLabel: string;
  yesterdayUpperLabel: string;
  tomorrowYmd: string;
  tomorrowDay: number;
  tomorrowMonth: number;
  tomorrowShortLabel: string;
  tomorrowUpperLabel: string;
}

export interface NewWaareePacketEvent {
  eventId: string;
  detectedAtIso: string;
  detectedAtIst: string;
  reason: string;
  details?: string[];
  livePowerKw: number;
  liveDcPowerKw?: number;
  yieldToday: number;
  yesterdayYmd: string;
  yesterdayKwh: number;
  todayGenCount: number;
  todayLastTime?: string | null;
  monthTotal: number;
  calcKwNow?: number;
  calcCumKwhNow?: number;
  calcFullDayKwh?: number;
  deltaKw?: number | null;
  capturePct?: number | null;
}

export interface LiveSyncLastSyncedDay {
  day: number;
  month: number;
  year: number;
  ymd: string;
  shortLabel: string;
  yieldKwh: number;
  raw: any[];
}

export interface DeviceRealAllDcString {
  volt: number | null;
  current?: number | null;
  powerKw: number | null;
  isUnwired?: boolean;
}

export interface DeviceRealAllDc {
  pv1: DeviceRealAllDcString;
  pv2: DeviceRealAllDcString;
  pv3?: DeviceRealAllDcString;
  pv4?: DeviceRealAllDcString;
  totalDcKw: number;
}

export interface DeviceRealAllGridPhase {
  volt: number | null;
  current?: number | null;
  freqHz?: number | null;
  powerKw: number | null;
}

export interface DeviceRealAllGrid {
  r: DeviceRealAllGridPhase;
  s?: { volt: number; powerKw: number };
  t?: { volt: number; powerKw: number };
  totalAcKw: number;
  phaseCount: number;
}

export interface DeviceRealAllEfficiency {
  etaPct: number | null;
  conversionLossWatts: number | null;
}

export interface DeviceRealAllData {
  deviceID: string;
  status: number;
  timestamp: number;
  timeText: string;
  dc: DeviceRealAllDc;
  grid: DeviceRealAllGrid;
  efficiency: DeviceRealAllEfficiency;
  temperatures?: {
    invTemp?: number | null;
    ambientTemp?: number | null;
    boostTemp?: number | null;
  };
  safety?: {
    isoResistance?: number | null;
  };
  rawValues?: Array<{ variable: string; value: any }>;
}

export interface HardwareAlarmItem {
  deviceSN: string;
  alarmType: number;
  code: number;
  content: string;
  time: string;
  isGridDrop: boolean;
}

export interface PlantAlarmsPayload {
  alarms: HardwareAlarmItem[];
  total: number;
  hasActiveAlarm: boolean;
  activeGridDropAlarm: HardwareAlarmItem | null;
  fromCache?: boolean;
}

export interface LiveSyncSnapshot {
  errno: number;
  stationId: string;
  trigger: string;
  syncedAtIso: string;
  syncedAtIstLabel: string;
  istClock: ServerIstClockSnapshot;
  weather: SolarWeatherResponse;
  alignment?: {
    calcKwNow: number;
    calcCumKwhNow?: number;
    calcFullDayKwh?: number;
    realKwNow: number;
    liveDcPowerKw?: number;
    deltaKw: number;
    capturePct: number | null;
  };
  waaree: {
    fetchedAtIso: string;
    fromCache: boolean;
    isHardwareLive?: boolean;
    inBackoff: boolean;
    backoffRemainingSec: number;
    flow: any;
    realElectrical?: DeviceRealAllData | null;
    alarms?: PlantAlarmsPayload | null;
    summary: {
      generationToday: number;
      flowYieldTodayRaw?: number;
      generationYesterday?: number;
      generationMonth: number;
      generationTotal: number;
      hardwareTodayKwh?: number | null;
      hardwareMonthKwh?: number | null;
      hardwareYearKwh?: number | null;
      hardwareTotalKwh?: number | null;
      hardwareSyncedYmd?: string | null;
      hardwareSyncedMin?: number | null;
      hardwareSyncedLabel?: string | null;
      earningsSource?: string | null;
      earningsCurrency?: string | null;
      monthEarnings?: number | null;
      cumulateEarnings?: number | null;
      lastUpdateDate: string;
      capacity: string;
      country: string;
    };
    monthlyDays: Array<{ index: number; value: number }>;
    yearMonths?: Array<{ index: number; value: number }>;
    prevMonthYm?: string;
    prevMonthDays?: Array<{ index: number; value: number }>;
    todayRaw: any[];
    yesterdayRaw: any[];
    lastSyncedDay: LiveSyncLastSyncedDay | null;
  };
  realElectrical?: DeviceRealAllData | null;
  alarms?: PlantAlarmsPayload | null;
  intelligenceReport?: SolarIntelligenceReport | null;
  events: {
    dayRolloverDetected: boolean;
    preSunriseSynced: boolean;
    newDataDetected: boolean;
    latestNewData: NewWaareePacketEvent | null;
  };
  syncHealth: {
    nextPollInSec: number;
    mode: string;
    sseClients: number;
  };
}

export interface DayComparisonCalendarDay {
  ymd: string;
  day: number;
  kwh: number;
}

export interface DayComparisonResponse {
  errno: number;
  stationId: string;
  commissioningYmd: string;
  minDateYmd: string;
  maxDateYmd: string;
  dateYmd?: string;
  isToday?: boolean;
  isPastDate?: boolean;
  capacityKwp?: number;
  location?: {
    name: string;
    lat: number;
    lon: number;
  };
  weather?: DayComparisonWeather | null;
  waaree?: {
    eepromKwh: number;
    hasEeprom: boolean;
    rawSeries: RawSeries[];
    hasRawCurve: boolean;
  };
  calendar: {
    ym: string;
    days: DayComparisonCalendarDay[];
  };
  inBackoff?: boolean;
  fetchedAtIso?: string;
}

export interface ProxyStatusResponse {
  errno: number;
  rules: Record<string, string>;
  backoffActive: boolean;
  backoffRemainingSec: number;
  backoffReason: string | null;
  activeFlowCachedStations: string[];
  lastKnownCachedEndpointsCount: number;
  systemTimeIST: string;
}
