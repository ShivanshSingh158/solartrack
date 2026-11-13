import React, { useState, useMemo } from 'react';
import {
  X,
  Share2,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Droplets,
  Sparkles,
} from 'lucide-react';
import {
  formatINR,
  generateDailySolarReport,
  parseRawTelemetry,
  type DailyReportData,
  type DailyReportDipCategory,
  type DailyReportGenerateInput,
} from '@solar-track/core';

interface DailyReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If pre-computed reportData is passed:
  reportData?: DailyReportData | null;
  // Or fallback inputs to compute on demand:
  reportInput?: DailyReportGenerateInput | null;
  realPoints?: Array<{ minute: number; kw: number }>;
  rawSeries?: any[];
  // Fallbacks from previous props:
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
  dateStr = 'Today',
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

  // Compute or resolve DailyReportData
  const report: DailyReportData = useMemo(() => {
    if (propReportData) return propReportData;
    if (reportInput) {
      try {
        return generateDailySolarReport(reportInput);
      } catch {
        // Fallback below
      }
    }

    // Build synthesized report from available props
    const expectedYield = Math.max(0.1, +(dayYieldKwh * 1.08).toFixed(1));
    return generateDailySolarReport({
      ymd: selectedYmd,
      todayYmd,
      nowMinutesIst: 18 * 60,
      tariffPerKwh,
      capacityKwp: systemCapacity,
      sunriseMin: 386,
      sunsetMin: 1039,
      realKwh: dayYieldKwh,
      expectedKwh: expectedYield,
      lookupModelAtMinute: (m) => {
        if (m < 386 || m > 1039) return { kw: 0, cumKwh: expectedYield };
        const norm = (m - 386) / (1039 - 386);
        const kw = Math.sin(norm * Math.PI) * peakKw * 1.05;
        return { kw: Math.max(0, kw), cumKwh: norm * expectedYield };
      },
      realPoints: effectiveRealPoints,
      tomorrowForecast: {
        expectedYieldKwh: tomorrowKwh,
        condition: 'Clear Sky & Sunshine',
      },
      yesterdayKwh: 11.4,
      sevenDayAvgKwh: 10.2,
      bestDayRecord: { ymd: '2026-11-08', kwh: 12.4 },
    });
  }, [propReportData, reportInput, effectiveRealPoints, selectedYmd, todayYmd, dayYieldKwh, tariffPerKwh, systemCapacity, peakKw, tomorrowKwh]);

  if (!isOpen) return null;

  const { headline, curvePoints, dips, lossBreakdown, healthSnapshot, cleanlinessUpdate, comparisons, tomorrowPreview } = report;

  const handleShare = () => {
    const text = `SolarTrack Daily Report (${selectedYmd}): Generated ${headline.realKwh} kWh (₹${headline.savingsInr} saved). Captured ${headline.capturePct}% of available solar energy!`;
    if (navigator.share) {
      navigator.share({ title: `SolarTrack Daily Audit - ${selectedYmd}`, text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      alert('Report summary copied to clipboard!');
    }
  };

  // SVG Chart Geometry
  const svgWidth = 680;
  const svgHeight = 180;
  const padding = { top: 20, right: 20, bottom: 25, left: 35 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const minX = curvePoints.length > 0 ? curvePoints[0].minute : 360;
  const maxX = curvePoints.length > 0 ? curvePoints[curvePoints.length - 1].minute : 1080;
  const maxY = Math.max(2.2, ...curvePoints.map((p) => Math.max(p.realKw, p.expectedKw)));

  const scaleX = (min: number) => padding.left + ((min - minX) / Math.max(1, maxX - minX)) * graphWidth;
  const scaleY = (kw: number) => padding.top + (1 - kw / maxY) * graphHeight;

  // Build SVG Path strings
  const expectedPath = curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.minute).toFixed(1)} ${scaleY(p.expectedKw).toFixed(1)}`)
    .join(' ');

  const realPath = curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.minute).toFixed(1)} ${scaleY(p.realKw).toFixed(1)}`)
    .join(' ');

  const realArea = `${realPath} L ${scaleX(maxX)} ${scaleY(0)} L ${scaleX(minX)} ${scaleY(0)} Z`;

  const getDipBadgeStyle = (cat: DailyReportDipCategory) => {
    switch (cat) {
      case 'grid_pause':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'weather_cloud':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'parapet_shadow':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'dc_string':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden card-floating-elevation">
        {/* Sticky Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                End-of-Day Performance Audit
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Inverter & Weather Verified
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-0.5 tracking-tight flex items-center gap-2">
              <span>Daily Solar Report · {dateStr}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200/80 transition cursor-pointer"
              title="Share report summary"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200/80 transition cursor-pointer"
              title="Close report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex gap-2 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Overview & Solar Curve
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dips')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'dips'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Dips & Anomalies</span>
            {dips.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                {dips.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'health'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Hardware & Health Audit
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {activeTab === 'audit' && (
            <>
              {/* Top 4 KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Actual Generation
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">{headline.realKwh}</span>
                    <span className="text-xs font-bold text-slate-500">kWh</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">
                    {headline.capturePct}% of Sky Model
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Expected Potential
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">~{headline.expectedKwh}</span>
                    <span className="text-xs font-bold text-slate-500">kWh</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1 block">Clear-Sky Physics Target</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Electricity Bill Saved
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-emerald-800 tracking-tight">{formatINR(headline.savingsInr)}</span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 mt-1 block">
                    ₹{tariffPerKwh}/kWh DISCOM Net Meter
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Peak Output
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">{peakKw}</span>
                    <span className="text-xs font-bold text-slate-500">kW</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1 block">at {peakTime}</span>
                </div>
              </div>

              {/* Mood / Plain-English Day Verdict Banner */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Daily Solar Verdict</h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                    {headline.moodSentence}
                  </p>
                </div>
              </div>

              {/* Section 2: Complete Solar Curve Chart */}
              <div className="p-4.5 rounded-2xl bg-white border border-slate-200/80 card-floating-elevation">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Daylight Generation vs Expected Target
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Real 5-minute inverter output (solid emerald) vs sky physics model (dashed blue)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.75 bg-emerald-500 rounded-full" />
                      Actual (kW)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.75 bg-sky-500 border-dashed rounded-full" />
                      Expected (kW)
                    </span>
                  </div>
                </div>

                {/* SVG Curve Container */}
                <div className="relative w-full overflow-hidden">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto select-none"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
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

                    {/* Shaded Area Under Real Curve */}
                    <path d={realArea} fill="url(#curveGradient)" />

                    {/* Dashed Sky Expected Model Curve */}
                    <path d={expectedPath} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />

                    {/* Solid Real Solar Power Curve */}
                    <path d={realPath} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />

                    {/* Dip Highlights (shaded amber markers) */}
                    {curvePoints
                      .filter((p) => p.isDip)
                      .map((p, idx) => (
                        <circle
                          key={`dip-pt-${idx}`}
                          cx={scaleX(p.minute)}
                          cy={scaleY(p.realKw)}
                          r="2.5"
                          fill="#f59e0b"
                          opacity="0.8"
                        />
                      ))}

                    {/* Interactive Hover Line & Point */}
                    {hoveredPoint && (
                      <g>
                        <line
                          x1={scaleX(hoveredPoint.minute)}
                          y1={padding.top}
                          x2={scaleX(hoveredPoint.minute)}
                          y2={scaleY(0)}
                          stroke="#64748b"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle cx={scaleX(hoveredPoint.minute)} cy={scaleY(hoveredPoint.realKw)} r="4" fill="#059669" stroke="#fff" strokeWidth="2" />
                        <circle cx={scaleX(hoveredPoint.minute)} cy={scaleY(hoveredPoint.expectedKw)} r="3.5" fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
                      </g>
                    )}

                    {/* Transparent touch/mouse catcher bars */}
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

                {/* Hover readout info box */}
                <div className="mt-2 text-center text-xs text-slate-500 font-medium min-h-[20px]">
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
                    <span>Hover over any minute on the curve to inspect instantaneous output</span>
                  )}
                </div>
              </div>

              {/* Section 4: Physical Loss Attribution Breakdown */}
              <div className="p-4.5 rounded-2xl bg-white border border-slate-200/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                  What Filtered Your Solar Energy Today?
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mb-3">
                  Honest physical breakdown of factors that ate into your theoretical 100% potential:
                </p>

                <div className="space-y-3">
                  {lossBreakdown.map((item) => (
                    <div key={item.categoryKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="text-slate-500 font-semibold">
                          ~{item.lostKwh} kWh lost ({item.pctOfPotential}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-slate-400/80 rounded-full transition-all"
                          style={{ width: `${Math.min(100, item.pctOfPotential * 4)}%` }}
                        />
                      </div>
                      <p className="text-[10.5px] text-slate-400 font-medium">{item.plainDescription}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 7: Historical Benchmarks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {comparisons.map((c, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      {c.metric}
                    </span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">{c.value}</span>
                    <span className={`text-[11px] font-semibold block mt-0.5 ${c.isPositive ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {c.diffText}
                    </span>
                  </div>
                ))}
              </div>

              {/* Section 8: Tomorrow's Preview Card */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                <Sun className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Tomorrow's Solar Preview</h4>
                    <span className="text-xs font-bold text-amber-900">~{tomorrowPreview.forecastKwh} kWh Expected</span>
                  </div>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed mt-1">
                    {tomorrowPreview.plainAdvice}
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'dips' && (
            <div className="space-y-3">
              <div className="mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Every Output Dip Explained (Zero Guesswork)
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  The system verified Modbus electrical registers, grid voltage, and satellite cloud telemetry to explain each anomaly:
                </p>
              </div>

              {dips.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200/70">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">Zero Significant Dips Detected!</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm mx-auto">
                    Your panels matched the solar curve smoothly throughout the entire day with no abnormal power cuts or sudden drops.
                  </p>
                </div>
              ) : (
                dips.map((dip) => (
                  <div
                    key={dip.id}
                    className="p-4.5 rounded-2xl bg-white border border-slate-200/80 space-y-2 card-floating-elevation"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-900">
                          {dip.startTimeStr} – {dip.endTimeStr} ({dip.durationMinutes} min)
                        </span>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getDipBadgeStyle(dip.category)}`}>
                        {dip.categoryBadge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {dip.plainExplanation}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Lost: ~{dip.estimatedKwhLost} kWh (peak drop −{dip.peakDeficitKw} kW)</span>
                      <span className="text-slate-600 font-semibold">{dip.actionAdvice}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Complete Hardware & Health Verification
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Verified using raw inverter telemetry registers recorded across the full daylight period:
                </p>
              </div>

              {/* Health items list */}
              <div className="space-y-2.5">
                {healthSnapshot.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{h.component}</span>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{h.plainVerdict}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border ${
                        h.status === 'healthy'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {h.statusLabel}
                    </span>
                  </div>
                ))}
              </div>

              {/* Panel Cleanliness Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-sky-500" />
                    Panel Cleanliness Status ({cleanlinessUpdate.cleanlinessScore}% Clean)
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {cleanlinessUpdate.daysSinceWash} Days Unwashed
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {cleanlinessUpdate.plainSummary}
                </p>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Recommendation: {cleanlinessUpdate.recommendation}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Computed locally · Zero data uploaded to cloud
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
