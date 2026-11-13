/**
 * Intraday curve segmentation, Wi-Fi outage hole classification, and bridged gap reconstruction contracts.
 */

export type IntervalGapState =
  | 'PRESENT_GENERATING'
  | 'PRESENT_ZERO_CONNECTED'
  | 'GAP_MORNING_PRECONNECT'
  | 'GAP_MIDDAY_DROPOUT'
  | 'GAP_EVENING_TAIL'
  | 'GAP_FULL_DAY'
  | 'PARTIAL_COMMISSIONING';

export interface IntradayPoint {
  minutes: number;
  kw: number;
  cumKwh: number;
}

export interface ParsedDayTelemetry {
  segments: IntradayPoint[][];
  gaps: Array<{ startMin: number; endMin: number; durationMin: number; durationText: string }>;
  allPoints: IntradayPoint[];
  peakKw: number;
  peakMinutes: number;
  onlineIntegratedKwh: number;
  hasData: boolean;
  firstPointMin: number | null;
  lastPointMin: number | null;
  firstActiveMin: number | null;
  lastActiveMin: number | null;
  presentZeroMinutes: number;
  presentZeroWindows: Array<{ startMin: number; endMin: number; durationMin: number }>;
}

export interface XAxisClockTick {
  minutes: number;
  label: string;
  compactLabel: string;
  isEdge?: 'sunrise' | 'sunset';
}

export type GapCurvePocket = 'EEPROM_CONFIRMED' | 'BUFFER_ESTIMATED' | 'GRID_OFF_ZERO';

export interface BridgedGapPoint {
  minutes: number;
  kw: number;
  cumGapKwh: number;
}

export interface BridgedGapSegment {
  startMin: number;
  endMin: number;
  durationMin: number;
  isMorningPreConnect: boolean;
  state: IntervalGapState;
  kind: GapCurvePocket;
  recoveredKwh: number;
  suspectedGridCut: boolean;
  kGapApplied: number;
  points: BridgedGapPoint[];
}

export interface ClassifiedGapHole {
  startMin: number;
  endMin: number;
  durationMin: number;
  state: IntervalGapState;
  kind: GapCurvePocket;
  startKw: number;
  endKw: number;
  hasLeftEdge: boolean;
  hasRightEdge: boolean;
  rawEstimatedKwh: number;
  allocatedKwh: number;
  kGapApplied: number;
  suspectedGridCut: boolean;
  isMorningPreConnect: boolean;
}

export interface DayGapClassificationResult {
  onlineKwh: number;
  eepromKwh: number;
  deltaEepromKwh: number;
  eepromConfirmedPreKwh: number;
  bufferKwh: number;
  kGapApplied: number;
  suspectedGridCut: boolean;
  isManualGridOff: boolean;
  hasAnyHole: boolean;
  holes: ClassifiedGapHole[];
}

export interface ReconstructedGapCurveResult {
  hasBridgedGaps: boolean;
  recoveredKwh: number;
  eepromRecoveredKwh: number;
  bufferedKwh: number;
  deficitKwh: number;
  suspectedGridCut: boolean;
  bridgedSegments: BridgedGapSegment[];
}
