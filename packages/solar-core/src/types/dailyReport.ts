export type DailyReportDipCategory =
  | 'weather_cloud'
  | 'grid_pause'
  | 'parapet_shadow'
  | 'dc_string'
  | 'haze_falloff'
  | 'unexplained';

export type DailyReportTone = 'sky' | 'amber' | 'emerald' | 'rose' | 'slate';

export interface DailyReportDipItem {
  id: string;
  startMin: number;
  endMin: number;
  startTimeStr: string;
  endTimeStr: string;
  durationMinutes: number;
  peakDeficitKw: number;
  estimatedKwhLost: number;
  category: DailyReportDipCategory;
  categoryBadge: string;
  categoryTone: DailyReportTone;
  plainExplanation: string;
  actionAdvice: string;
}

export interface DailyReportLossItem {
  categoryKey: string;
  label: string;
  lostKwh: number;
  pctOfPotential: number;
  plainDescription: string;
}

export interface DailyReportHealthItem {
  component: string;
  status: 'healthy' | 'moderate' | 'action_needed';
  statusLabel: string;
  plainVerdict: string;
}

export interface DailyReportComparison {
  metric: string;
  value: string;
  diffText: string;
  isPositive: boolean;
}

export interface DailyReportCurvePoint {
  minute: number;
  timeLabel: string;
  realKw: number;
  expectedKw: number;
  isDip: boolean;
  dipCategory?: DailyReportDipCategory;
}

export interface DailyReportData {
  ymd: string;
  dateLabel: string;
  isAvailable: boolean;
  triggerReason: string;
  headline: {
    realKwh: number;
    expectedKwh: number;
    capturePct: number;
    savingsInr: number;
    moodSentence: string;
    overallVerdict: 'excellent' | 'good' | 'fair' | 'underperforming';
  };
  curvePoints: DailyReportCurvePoint[];
  dips: DailyReportDipItem[];
  lossBreakdown: DailyReportLossItem[];
  healthSnapshot: DailyReportHealthItem[];
  cleanlinessUpdate: {
    daysSinceWash: number;
    estimatedLossPct: number;
    cleanlinessScore: number;
    plainSummary: string;
    recommendation: string;
  };
  comparisons: DailyReportComparison[];
  tomorrowPreview: {
    forecastKwh: number;
    conditionText: string;
    plainAdvice: string;
    peakHoursWindow: string;
  };
}

export interface DailyReportGenerateInput {
  ymd: string;
  todayYmd: string;
  nowMinutesIst?: number;
  tariffPerKwh?: number;
  capacityKwp?: number;
  // Curve points: 5-minute interval minutes and values
  realPoints?: Array<{
    minute: number;
    kw: number;
    vDc?: number;
    iDc?: number;
    vGrid?: number;
    freqGrid?: number;
  }>;
  lookupModelAtMinute: (minute: number) => { kw: number; cumKwh: number };
  sunriseMin: number;
  sunsetMin: number;
  // Totals
  realKwh: number;
  expectedKwh: number;
  // Weather
  weather?: {
    condition?: string;
    cloudCoverAvg?: number;
    maxTemp?: number;
    minTemp?: number;
    windSpeedMax?: number;
    rainMm?: number;
    aqi?: number;
    pm10?: number;
    hourlyCloudCover?: number[];
    hourlyWindKmh?: number[];
    hourlyTempC?: number[];
    hourlyDni?: number[];
    hourlyGti?: number[];
  };
  tomorrowForecast?: {
    expectedYieldKwh?: number;
    condition?: string;
    cloudCover?: number;
    maxTemp?: number;
    minTemp?: number;
  };
  // Historical benchmarks
  yesterdayKwh?: number | null;
  sevenDayAvgKwh?: number | null;
  bestDayRecord?: { ymd: string; kwh: number } | null;
  // Cleanliness tracking
  cleanlinessState?: {
    daysSinceWash?: number;
    estimatedLossPct?: number;
    rainMmToday?: number;
  };
}
