import type { DipAttributionCategory, TableRowData, TimescaleMode, DailySolarPhysicsModel, ParsedDayTelemetry, ReconstructedGapCurveResult, XAxisClockTick } from '@solar-track/core';

export interface PerformanceBulletBarItem {
  ymd: string;
  shortLabel: string;
  axisLabel: string;
  realKwh: number;
  cloudKwh?: number;
  bufferKwh?: number;
  isManualGridOff?: boolean;
  modelKwh: number;
  idealClearSkyKwh: number;
  prevPeriodKwh?: number | null;
  capturePct: number | null;
  dipCategory: DipAttributionCategory;
  dipReasonLabel: string;
  isToday: boolean;
  isFuture: boolean;
  isConfirmed: boolean;
  todayTargetTotalKwh?: number;
  pm10Avg?: number | null;
  aodAvg?: number | null;
  rainMm?: number;
}

export interface PerformanceYearMonthItem {
  month: number;
  ym: string;
  shortMonth: string;
  label: string;
  realKwh: number;
  isPreCommissioning: boolean;
  isFutureMonth: boolean;
  isPartialCommissioning: boolean;
  activeDays: number;
  dailyAvgKwh: number | null;
  savingsInr: number;
}

export interface StagePlotLayout {
  svgW: number;
  svgH: number;
  isCompact: boolean;
  plotLeft: number;
  plotRight: number;
  plotW: number;
  topY: number;
  baselineY: number;
  plotH: number;
}

export interface RealSplineSegment {
  coords: Array<{ x: number; y: number }>;
  linePath: string;
  areaPath: string;
  lastX: number;
  lastY: number;
}

export interface BridgedGapSplineSegment {
  startMin: number;
  endMin: number;
  recoveredKwh: number;
  isMorningPreConnect: boolean;
  kind: 'EEPROM_CONFIRMED' | 'BUFFER_ESTIMATED';
  linePath: string;
  areaPath: string;
}

export interface DayHoverInfo {
  minuteOfDay: number;
  timeLabel: string;
  x: number;
  modelKw: number;
  modelCumKwh: number;
  modelY: number;
  realKw: number | null;
  realCumKwh: number | null;
  realY: number | null;
  bridgedKw: number | null;
  bridgedY: number | null;
  bridgedSegmentKwh: number | null;
  compareKw: number | null;
  compareCumKwh: number | null;
  compareY: number | null;
  diffKw: number | null;
  diffKwPct: number | null;
  diffCumKwh: number | null;
  diffCumPct: number | null;
  dcKw: number | null;
  dcY: number | null;
  instantCapturePct: number | null;
  instantEtaPct: number | null;
}

export interface DayStageGeometryResult {
  dayStartMin: number;
  dayEndMin: number;
  daySpanMin: number;
  timeToX: (m: number) => number;
  kwToY: (kw: number) => number;
  yTicksKw: number[];
  xTicksDay: { interior: XAxisClockTick[] };
  calcLinePath: string;
  calcAreaPath: string;
  realSegments: RealSplineSegment[];
  bridgedGapSegments: BridgedGapSplineSegment[];
  pvDcPaths: string[];
  dcAcGapBandPaths: string[];
  comparePaths: string[];
}

export interface PerformanceChartStageProps {
  timescale: TimescaleMode;
  periodKey: string;
  viewMode: 'chart' | 'table';
  isLoading: boolean;
  isCombined: boolean;
  capacityKwp: number;
  chartTitle: string;
  chartSubtitle: string;
  showModelOverlay: boolean;
  onToggleModelOverlay: () => void;
  showPvDcOverlay: boolean;
  onTogglePvDcOverlay: () => void;
  showPriorWeekOverlay: boolean;
  onTogglePriorWeekOverlay: () => void;
  showClearSkyTicks: boolean;
  onToggleClearSkyTicks: () => void;
  showCaptureLineOverlay: boolean;
  onToggleCaptureLineOverlay: () => void;
  selectedDate: string;
  todayYmd: string;
  nowMinutesIst: number;
  physicsModel: DailySolarPhysicsModel;
  primaryParsed: ParsedDayTelemetry;
  primaryGapCurve?: ReconstructedGapCurveResult | null;
  pvDcParsed: ParsedDayTelemetry | null;
  compareDateYmd: string | null;
  compareParsed: ParsedDayTelemetry | null;
  compareRadiationMjM2?: number | null;
  dayRadiationMjM2?: number | null;
  dayConditionLabel?: string;
  hasLiveBeacon: boolean;
  bulletBars: PerformanceBulletBarItem[];
  monthAvgKwh: number | null;
  hoveredBarYmd: string | null;
  onHoverBarYmd: (ymd: string | null) => void;
  onSelectDay: (ymd: string) => void;
  yearMonths: PerformanceYearMonthItem[];
  onSelectMonth: (ym: string) => void;
  tableRows: TableRowData[];
}
