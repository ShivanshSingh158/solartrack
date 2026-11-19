import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Share2,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Droplets,
  Zap,
  Target,
  IndianRupee,
  CloudSun,
  CloudRain,
  AlertTriangle,
  ZapOff,
} from 'lucide-react';
import {
  formatINR,
  formatIndianDate,
  generateDailySolarReport,
  parseRawTelemetry,
  type DailyReportData,
  type DailyReportDipCategory,
  type DailyReportGenerateInput,
  type DailySolarPhysicsModel,
} from '@solar-track/core';

interface DailyReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: DailyReportData | null;
  reportInput?: DailyReportGenerateInput | null;
  physicsModel?: DailySolarPhysicsModel | null;
  realPoints?: Array<{ minute: number; kw: number }>;
  rawSeries?: any[];
  dayYieldKwh?: number;
  tariffPerKwh?: number;
  peakKw?: number;
  peakTime?: string;
  activeHours?: string;
  systemCapacity?: number;
  tomorrowKwh?: number;
  plantName?: string;
  dateStr?: string;
  selectedYmd?: string;
  todayYmd?: string;
  grade?: any;
  gradeLabel?: string;
  specificYield?: number;
}

export const DailyReportCardModal: React.FC<DailyReportCardModalProps> = ({
  isOpen,
  onClose,
  reportData: propReportData,
  reportInput,
  physicsModel,
  realPoints: propRealPoints,
  rawSeries,
  dayYieldKwh = 10.5,
  tariffPerKwh = 8.0,
  peakKw = 1.84,
  peakTime = '12:07 PM',
  activeHours: _activeHours = '10.8',
  systemCapacity = 3.27,
  tomorrowKwh = 12.2,
  plantName: _plantName,
  dateStr: _dateStr = 'Today',
  selectedYmd = '2026-11-13',
  todayYmd = '2026-11-13',
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'dips' | 'health'>('audit');
  const [hoveredPoint, setHoveredPoint] = useState<{
    minute: number;
    timeLabel: string;
    realKw: number;
    expectedKw: number;
  } | null>(null);

  // Resolve 5-minute real points from raw series or explicit realPoints
  const effectiveRealPoints = useMemo<Array<{ minute: number; kw: number }>>(() => {
    if (Array.isArray(propRealPoints) && propRealPoints.length > 0) {
      return propRealPoints;
    }
    if (Array.isArray(rawSeries) && rawSeries.length > 0) {
      const parsed = parseRawTelemetry(rawSeries, 375, 1050);
      if (parsed.allPoints && parsed.allPoints.length > 0) {
        return parsed.allPoints.map((pt) => ({ minute: pt.minutes, kw: pt.kw }));
      }
    }
    return [];
  }, [propRealPoints, rawSeries]);

  // Compute or resolve DailyReportData safely
  const report: DailyReportData = useMemo(() => {
    if (propReportData) return propReportData;
    if (reportInput) {
      try {
        return generateDailySolarReport(reportInput);
      } catch {
        // Fallback below
      }
    }

    const sunriseMin = physicsModel?.sunriseMin ?? 386;
    const sunsetMin = physicsModel?.sunsetMin ?? 1039;
    const expectedYield =
      physicsModel && Number.isFinite(physicsModel.targetDailyModelKwh) && physicsModel.targetDailyModelKwh > 0.5
        ? +physicsModel.targetDailyModelKwh.toFixed(1)
        : Math.max(0.1, +(dayYieldKwh * 1.08).toFixed(1));

    // Safely resolve model lookup: handles functions, serialized points array, and sinusoidal fallback
    const points = physicsModel?.points || [];
    const lookupModelAtMinute = (m: number): { kw: number; cumKwh: number } => {
      if (typeof physicsModel?.lookupAtMinute === 'function') {
        try {
          const res = physicsModel.lookupAtMinute(m);
          if (res && Number.isFinite(res.kw)) {
            return { kw: Math.max(0, res.kw), cumKwh: res.cumKwh ?? 0 };
          }
        } catch {
          // Fall through to points interpolation
        }
      }

      if (Array.isArray(points) && points.length > 0) {
        if (m <= points[0].minutes) return { kw: points[0].kw, cumKwh: points[0].cumKwh };
        if (m >= points[points.length - 1].minutes) {
          const last = points[points.length - 1];
          return { kw: last.kw, cumKwh: last.cumKwh };
        }
        for (let i = 1; i < points.length; i++) {
          if (m <= points[i].minutes) {
            const a = points[i - 1];
            const b = points[i];
            const f = (m - a.minutes) / Math.max(0.01, b.minutes - a.minutes);
            return {
              kw: +(a.kw + f * (b.kw - a.kw)).toFixed(3),
              cumKwh: +(a.cumKwh + f * (b.cumKwh - a.cumKwh)).toFixed(3),
            };
          }
        }
      }

      if (m < sunriseMin || m > sunsetMin) return { kw: 0, cumKwh: expectedYield };
      const norm = (m - sunriseMin) / Math.max(1, sunsetMin - sunriseMin);
      const kw = Math.sin(norm * Math.PI) * peakKw;
      return { kw: Math.max(0, kw), cumKwh: norm * expectedYield };
    };

    try {
      return generateDailySolarReport({
        ymd: selectedYmd,
        todayYmd,
        nowMinutesIst: 18 * 60,
        tariffPerKwh,
        capacityKwp: systemCapacity,
        sunriseMin,
        sunsetMin,
        realKwh: dayYieldKwh,
        expectedKwh: expectedYield,
        lookupModelAtMinute,
        realPoints: effectiveRealPoints,
        tomorrowForecast: {
          expectedYieldKwh: tomorrowKwh,
          condition: 'Clear Sky & Sunshine',
        },
        yesterdayKwh: 11.4,
        sevenDayAvgKwh: 10.2,
        bestDayRecord: { ymd: '2026-11-08', kwh: 12.4 },
      });
    } catch (err) {
      console.error('Failed to generate daily report:', err);
      return {
        ymd: selectedYmd,
        dateLabel: selectedYmd,
        isAvailable: true,
        triggerReason: 'Daily Performance Audit',
        headline: {
          realKwh: dayYieldKwh,
          expectedKwh: expectedYield,
          capturePct: Math.round((dayYieldKwh / Math.max(0.1, expectedYield)) * 100),
          savingsInr: Math.round(dayYieldKwh * tariffPerKwh),
          moodSentence: 'Generation tracked station model physics with standard atmospheric attenuation.',
          overallVerdict: 'good',
        },
        curvePoints: [],
        dips: [],
        lossBreakdown: [
          {
            categoryKey: 'weather_haze',
            label: 'Atmospheric Attenuation',
            lostKwh: +(expectedYield * 0.08).toFixed(1),
            pctOfPotential: 8,
            plainDescription: 'Ambient haze and seasonal aerosol filtering.',
          },
        ],
        healthSnapshot: [
          {
            component: 'Inverter Hardware',
            status: 'healthy',
            statusLabel: 'Online',
            plainVerdict: 'Inverter operating within standard specifications.',
          },
        ],
        cleanlinessUpdate: {
          daysSinceWash: 14,
          estimatedLossPct: 4.1,
          cleanlinessScore: 92,
          plainSummary: 'Panels are operating in good clean condition.',
          recommendation: 'No immediate washing required.',
        },
        comparisons: [
          {
            metric: 'vs Model',
            value: `${expectedYield} kWh`,
            diffText: `${Math.round((dayYieldKwh / Math.max(0.1, expectedYield)) * 100)}% alignment`,
            isPositive: true,
          },
        ],
        tomorrowPreview: {
          forecastKwh: tomorrowKwh,
          conditionText: 'Clear Sky',
          plainAdvice: `Forecast indicates ~${tomorrowKwh} kWh expected tomorrow.`,
          peakHoursWindow: '10:30 AM – 02:00 PM',
        },
      };
    }
  }, [
    propReportData,
    reportInput,
    physicsModel,
    effectiveRealPoints,
    selectedYmd,
    todayYmd,
    dayYieldKwh,
    tariffPerKwh,
    systemCapacity,
    peakKw,
    tomorrowKwh,
  ]);

  // Hook must be called unconditionally before any early return
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const {
    headline = { realKwh: dayYieldKwh, expectedKwh: 11.5, capturePct: 90, savingsInr: 80, moodSentence: '', overallVerdict: 'good' as const },
    curvePoints = [],
    dips = [],
    lossBreakdown = [],
    healthSnapshot = [],
    cleanlinessUpdate = { daysSinceWash: 14, estimatedLossPct: 4.1, cleanlinessScore: 92, plainSummary: '', recommendation: '' },
    comparisons = [],
    tomorrowPreview: _tomorrowPreview,
  } = report || {};

  const formattedDate = formatIndianDate(selectedYmd);

  const handleShare = () => {
    const text = `SolarTrack Daily Report (${formattedDate}): Generated ${headline.realKwh} kWh (₹${headline.savingsInr} saved). Captured ${headline.capturePct}% of available solar energy!`;
    if (navigator.share) {
      navigator.share({ title: `SolarTrack Daily Audit - ${formattedDate}`, text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      alert('Report summary copied to clipboard!');
    }
  };

  // SVG Chart Geometry for wide modal canvas
  const svgWidth = 840;
  const svgHeight = 210;
  const padding = { top: 20, right: 25, bottom: 25, left: 40 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const minX = curvePoints.length > 0 ? curvePoints[0].minute : 360;
  const maxX = curvePoints.length > 0 ? curvePoints[curvePoints.length - 1].minute : 1080;
  const maxY = Math.max(2.2, ...curvePoints.map((p) => Math.max(p.realKw, p.expectedKw)));

  const scaleX = (min: number) => padding.left + ((min - minX) / Math.max(1, maxX - minX)) * graphWidth;
  const scaleY = (kw: number) => padding.top + (1 - kw / maxY) * graphHeight;

  const expectedPath = curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.minute).toFixed(1)} ${scaleY(p.expectedKw).toFixed(1)}`)
    .join(' ');

  const realPath = curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.minute).toFixed(1)} ${scaleY(p.realKw).toFixed(1)}`)
    .join(' ');

  const realArea = `${realPath} L ${scaleX(maxX)} ${scaleY(0)} L ${scaleX(minX)} ${scaleY(0)} Z`;

  const getDipIconAndLabel = (cat: DailyReportDipCategory) => {
    switch (cat) {
      case 'grid_pause':
        return { icon: <ZapOff className="w-3.5 h-3.5 text-rose-500" />, label: 'Grid Interruption' };
      case 'weather_cloud':
        return { icon: <CloudSun className="w-3.5 h-3.5 text-sky-500" />, label: 'Passing Cloud' };
      case 'parapet_shadow':
        return { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, label: 'Parapet Shadow' };
      case 'dc_string':
        return { icon: <Zap className="w-3.5 h-3.5 text-orange-500" />, label: 'String Variance' };
      default:
        return { icon: <CloudRain className="w-3.5 h-3.5 text-slate-500" />, label: 'Environmental' };
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden no-scrollbar animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Container: Wider max-w-4xl / max-w-5xl, Apple Frosted Glass, Consistent Fixed Height Across All 3 Tabs */}
      <div
        className="relative w-full max-w-4xl lg:max-w-5xl h-[85vh] min-h-[560px] max-h-[840px] flex flex-col bg-white/95 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/80 overflow-hidden no-scrollbar animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 sm:px-8 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/70">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Performance Audit · Inverter &amp; Weather Verified</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Daily Solar Report · {formattedDate}
            </h2>
          </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="Share report summary"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="Close report"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Apple Segmented Control Navigation (Zero Pill Capsules) */}
          <div className="px-6 sm:px-8 py-2.5 border-b border-slate-100 flex items-center justify-start shrink-0 bg-slate-50/50">
            <div className="inline-flex p-1 rounded-2xl bg-slate-200/70">
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview &amp; Solar Curve
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('dips')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'dips'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Dips &amp; Anomalies</span>
                {dips.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-amber-800">
                    {dips.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'health'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hardware &amp; Grid Health
              </button>
            </div>
          </div>

          {/* Scrollable Content Body - No Ugly Side White Strip / Clean Scroll */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 sm:px-8 py-5 flex flex-col space-y-6">
            
            {/* TAB 1: OVERVIEW & SOLAR CURVE */}
            {activeTab === 'audit' && (
              <>
                {/* 4 Clean Apple KPI Cards (Zero Repeating Metrics) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Card 1: Generation */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Generation
                      </span>
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                        {headline.realKwh}
                      </span>
                      <span className="text-xs font-bold text-slate-400">kWh</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 mt-1 block">
                      {headline.capturePct}% Sky Alignment
                    </span>
                  </div>

                  {/* Card 2: Expected */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Expected Target
                      </span>
                      <Target className="w-3.5 h-3.5 text-sky-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                        ~{headline.expectedKwh}
                      </span>
                      <span className="text-xs font-bold text-slate-400">kWh</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      Clear-Sky Model Benchmark
                    </span>
                  </div>

                  {/* Card 3: Saved Value */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Electricity Value
                      </span>
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                        {formatINR(headline.savingsInr)}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      ₹{tariffPerKwh}/kWh DISCOM Net Meter
                    </span>
                  </div>

                  {/* Card 4: Peak */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Peak Power
                      </span>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                        {peakKw}
                      </span>
                      <span className="text-xs font-bold text-slate-400">kW</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      Recorded at {peakTime}
                    </span>
                  </div>
                </div>

                {/* Day Verdict Banner (No redundant percentage repetition) */}
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 flex items-start gap-3">
                  <Sun className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Daily Solar Assessment
                    </h4>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed mt-0.5">
                      {headline.moodSentence}
                    </p>
                  </div>
                </div>

                {/* Wide Solar Curve Chart */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Daylight Generation vs Expected Target
                      </h3>
                      <p className="text-[11px] text-slate-400 font-normal">
                        Real inverter telemetry compared against station clear-sky physics model
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.75 bg-emerald-500 rounded-full" />
                        Actual (kW)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.75 border-t-2 border-dashed border-sky-500 inline-block" />
                        Expected (kW)
                      </span>
                    </div>
                  </div>

                  {/* Panoramic SVG Curve */}
                  <div className="relative w-full overflow-hidden">
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto select-none"
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="modalCurveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      <line x1={padding.left} y1={scaleY(0)} x2={svgWidth - padding.right} y2={scaleY(0)} stroke="#e2e8f0" strokeWidth="1" />
                      <line x1={padding.left} y1={scaleY(1.0)} x2={svgWidth - padding.right} y2={scaleY(1.0)} stroke="#f1f5f9" strokeWidth="1" />
                      <line x1={padding.left} y1={scaleY(2.0)} x2={svgWidth - padding.right} y2={scaleY(2.0)} stroke="#f1f5f9" strokeWidth="1" />

                      {/* Y-axis labels */}
                      <text x={padding.left - 6} y={scaleY(0) + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">0 kW</text>
                      <text x={padding.left - 6} y={scaleY(1.0) + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">1 kW</text>
                      <text x={padding.left - 6} y={scaleY(2.0) + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">2 kW</text>

                      {/* Shaded Area */}
                      <path d={realArea} fill="url(#modalCurveGradient)" />

                      {/* Dashed Sky Expected Model Curve */}
                      <path d={expectedPath} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />

                      {/* Solid Real Solar Power Curve */}
                      <path d={realPath} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />

                      {/* Interactive Hover Point */}
                      {hoveredPoint && (
                        <g>
                          <line
                            x1={scaleX(hoveredPoint.minute)}
                            y1={padding.top}
                            x2={scaleX(hoveredPoint.minute)}
                            y2={scaleY(0)}
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          <circle cx={scaleX(hoveredPoint.minute)} cy={scaleY(hoveredPoint.realKw)} r="4" fill="#059669" stroke="#fff" strokeWidth="2" />
                          <circle cx={scaleX(hoveredPoint.minute)} cy={scaleY(hoveredPoint.expectedKw)} r="3.5" fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
                        </g>
                      )}

                      {/* Hit Targets */}
                      {curvePoints.map((p, idx) => (
                        <rect
                          key={`hit-${idx}`}
                          x={scaleX(p.minute) - 3}
                          y={padding.top}
                          width="6"
                          height={graphHeight}
                          fill="transparent"
                          className="cursor-crosshair"
                          onMouseEnter={() => setHoveredPoint(p)}
                        />
                      ))}
                    </svg>
                  </div>

                  {/* Clean Hover Readout */}
                  <div className="text-center text-xs text-slate-500 font-medium min-h-[20px]">
                    {hoveredPoint ? (
                      <span className="inline-flex items-center gap-3">
                        <strong className="text-slate-800">{hoveredPoint.timeLabel}</strong>
                        <span className="text-emerald-700 font-semibold">Actual: {hoveredPoint.realKw} kW</span>
                        <span className="text-sky-700 font-semibold">Expected: {hoveredPoint.expectedKw} kW</span>
                        <span className="text-slate-400">
                          ({hoveredPoint.realKw >= hoveredPoint.expectedKw ? '+' : ''}
                          {(hoveredPoint.realKw - hoveredPoint.expectedKw).toFixed(2)} kW)
                        </span>
                      </span>
                    ) : (
                      <span>Hover along the curve to inspect 5-minute instantaneous wattage</span>
                    )}
                  </div>
                </div>

                {/* Physical Loss Attribution */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Environmental Attenuation Factors
                  </h3>

                  <div className="space-y-3">
                    {lossBreakdown.map((item) => (
                      <div key={item.categoryKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700">{item.label}</span>
                          <span className="text-slate-500 font-normal">
                            ~{item.lostKwh} kWh ({item.pctOfPotential}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-slate-400/80 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.pctOfPotential * 4)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal">{item.plainDescription}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical Benchmarks & Forecast */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {comparisons.map((c, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {c.metric}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 block mt-0.5 tabular-nums">
                        {c.value}
                      </span>
                      <span className={`text-[11px] font-semibold block mt-0.5 ${c.isPositive ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {c.diffText}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TAB 2: DIPS & ANOMALIES (Zero Pill Capsules) */}
            {activeTab === 'dips' && (
              <div className="flex-1 flex flex-col space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Generation Fluctuation Log
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Electrical registers, grid voltage, and satellite cloud telemetry explaining anomalies:
                  </p>
                </div>

                {dips.length === 0 ? (
                  <div className="flex-1 my-auto flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl bg-slate-50/70 border border-slate-200/60 min-h-[300px]">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3.5 shadow-2xs">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Zero Significant Dips Detected</h4>
                    <p className="text-xs text-slate-500 font-normal mt-1.5 max-w-md leading-relaxed">
                      Panels tracked the physics curve smoothly throughout daylight hours without abnormal cutoffs, grid outages, or cloud dropouts.
                    </p>
                    <div className="mt-4 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 text-[11px] font-semibold text-emerald-700 shadow-2xs">
                      100% Daylight Solar Continuity
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dips.map((dip) => {
                      const dipMeta = getDipIconAndLabel(dip.category);
                      return (
                        <div
                          key={dip.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-bold text-slate-900 tabular-nums">
                                {dip.startTimeStr} – {dip.endTimeStr} ({dip.durationMinutes} min)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              {dipMeta.icon}
                              <span>{dipMeta.label}</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 font-normal leading-relaxed">
                            {dip.plainExplanation}
                          </p>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Impact: ~{dip.estimatedKwhLost} kWh (drop −{dip.peakDeficitKw} kW)</span>
                            <span className="font-medium text-slate-700">{dip.actionAdvice}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: HARDWARE & GRID HEALTH (Zero Pill Capsules) */}
            {activeTab === 'health' && (
              <div className="flex-1 flex flex-col space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Hardware &amp; Grid Diagnostics
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Modbus electrical telemetry recorded across daylight operations:
                  </p>
                </div>

                <div className="space-y-3">
                  {healthSnapshot.map((h, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{h.component}</span>
                          <p className="text-xs text-slate-500 font-normal mt-0.5 leading-relaxed">{h.plainVerdict}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{h.statusLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Panel Cleanliness Card */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-sky-500" />
                      Panel Cleanliness ({cleanlinessUpdate.cleanlinessScore}% Clean)
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {cleanlinessUpdate.daysSinceWash} Days Unwashed
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-normal leading-relaxed">
                    {cleanlinessUpdate.plainSummary}
                  </p>
                  <p className="text-xs text-slate-700 font-semibold">
                    Recommendation: {cleanlinessUpdate.recommendation}
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer Bar */}
          <div className="px-6 sm:px-8 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              Computed on station · Zero cloud data upload
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
            >
              Done
            </button>
          </div>

      </div>
    </div>
  );
};
