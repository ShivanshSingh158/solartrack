import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  TrendingUp,
  Droplets,
  CloudRain,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  DailyPerformanceLedgerEntry,
  DipAttributionCategory,
  SolarIntelligenceReport,
  WeeklyComparisonWindow,
} from '@solar-track/core';

interface SolarIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SolarIntelligenceReport | null;
  plantName?: string;
  tiltDegrees?: number;
  nominalPrPct?: number;
  onRefresh?: () => Promise<void>;
  onLogWash?: (dateYmd: string, note?: string) => Promise<void>;
  onRemoveWash?: (dateYmd: string) => Promise<void>;
}

const DIP_BADGE_META: Record<
  DipAttributionCategory,
  { label: string; badgeCls: string; barCls: string }
> = {
  OPTIMAL: {
    label: 'Normal Yield',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    barCls: 'bg-emerald-500',
  },
  OUTAGE_GAP: {
    label: 'Offline Interval',
    badgeCls: 'bg-slate-50 text-slate-600 border-slate-200',
    barCls: 'bg-slate-400',
  },
  CLOUD_RAIN: {
    label: 'Cloud & Rain',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    barCls: 'bg-sky-500',
  },
  FOG_HAZE: {
    label: 'Morning Fog & Smog',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    barCls: 'bg-amber-500',
  },
  SOILING_DRIFT: {
    label: 'Surface Dust',
    badgeCls: 'bg-orange-50 text-orange-800 border-orange-200/80',
    barCls: 'bg-orange-500',
  },
  BELOW_BASELINE: {
    label: 'Atmospheric Filter',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
    barCls: 'bg-slate-500',
  },
  WIFI_OUTAGE_UNLOGGED: {
    label: 'Station Standby',
    badgeCls: 'bg-slate-100 text-slate-600 border-slate-200',
    barCls: 'bg-slate-400',
  },
  PENDING_SYNC: {
    label: 'Today In Progress',
    badgeCls: 'bg-slate-100 text-slate-500 border-slate-200/80',
    barCls: 'bg-slate-300',
  },
};

export const SolarIntelligenceModal: React.FC<SolarIntelligenceModalProps> = ({
  isOpen,
  onClose,
  report,
  plantName = 'Solar Plant',
  tiltDegrees = 26.5,
  nominalPrPct: _nominalPrPct = 81.6,
  onRefresh,
  onLogWash,
  onRemoveWash,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'dips' | 'wash'>('all');
  const [hoveredYmd, setHoveredYmd] = useState<string | null>(null);
  const [washDateInput, setWashDateInput] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  const effectiveWashDate = washDateInput || report?.generatedAtIstYmd || '';

  // Unconditional keydown & body scroll lock hook
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

  const ledgerDesc = useMemo(() => {
    if (!report) return [];
    const base = report.dailyLedger.toReversed();
    if (filterMode === 'dips') {
      // Focus strictly on real environmental & soiling dips — zero outage noise
      return base.filter(
        (d) =>
          d.dipCategory === 'CLOUD_RAIN' ||
          d.dipCategory === 'FOG_HAZE' ||
          d.dipCategory === 'SOILING_DRIFT' ||
          d.dipCategory === 'BELOW_BASELINE'
      );
    }
    if (filterMode === 'wash') {
      return base.filter(
        (d) =>
          d.eventTag === 'MANUAL_WASH' ||
          d.eventTag === 'RAIN_WASH' ||
          d.eventTag === 'PARTIAL_RINSE' ||
          d.eventTag === 'DRIZZLE_MUD'
      );
    }
    return base;
  }, [report, filterMode]);

  const chartDays = useMemo(() => {
    if (!report) return [];
    return report.dailyLedger.slice(-21);
  }, [report]);

  const chartMaxKwh = useMemo(() => {
    let mx = 15;
    for (const d of chartDays) {
      mx = Math.max(mx, d.idealClearSkyKwh, d.weatherCleanKwh, d.realKwh ?? 0);
    }
    return Math.ceil(mx / 2) * 2;
  }, [chartDays]);

  const hoveredEntry: DailyPerformanceLedgerEntry | null = useMemo(() => {
    if (!chartDays.length) return null;
    if (hoveredYmd) {
      return chartDays.find((d) => d.ymd === hoveredYmd) || null;
    }
    const latestConfirmed = chartDays.findLast((d) => d.realKwh !== null);
    return latestConfirmed || chartDays[chartDays.length - 1] || null;
  }, [chartDays, hoveredYmd]);

  if (!isOpen || !report) return null;

  const { soiling, weeklyComparison } = report;
  const windows: Array<{ key: string; win: WeeklyComparisonWindow }> = [];
  if (weeklyComparison.latestWindow) windows.push({ key: 'latest', win: weeklyComparison.latestWindow });
  if (weeklyComparison.priorWindow) windows.push({ key: 'prior', win: weeklyComparison.priorWindow });
  if (weeklyComparison.olderWindow) windows.push({ key: 'older', win: weeklyComparison.olderWindow });

  const handleLogDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogWash || !effectiveWashDate) return;
    setIsBusy(true);
    try {
      await onLogWash(effectiveWashDate, `Manual wash (${effectiveWashDate})`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteWash = async (ymd: string) => {
    if (!onRemoveWash) return;
    setIsBusy(true);
    try {
      await onRemoveWash(ymd);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    setIsBusy(true);
    try {
      await onRefresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden no-scrollbar animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Container: Apple Glass, Fixed Height, No Scrollbars on Screen */}
      <div
        className="relative w-full max-w-5xl h-[88vh] min-h-[600px] max-h-[860px] flex flex-col bg-white/95 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/80 overflow-hidden no-scrollbar animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 sm:px-8 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/70">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                Weekly Performance &amp; Weather Soiling Audit
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                {plantName} · {report.capacityKwp.toFixed(2)} kWp DC · {tiltDegrees}° Array Tilt · Commissioned {report.commissioningYmd}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isBusy}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                title="Recompute analysis"
              >
                <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Close audit"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body: Clean No-Scrollbar */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 sm:px-8 py-5 space-y-6">
          
          {/* 1. Rolling Week-over-Week Comparison */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Rolling Week-over-Week Performance
              </h3>
              <span className="text-xs font-medium text-slate-600">
                {weeklyComparison.headlineSummary}
              </span>
            </div>

            {windows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {windows.map(({ key, win }, idx) => (
                  <div
                    key={key}
                    className={`p-4 rounded-2xl border ${
                      idx === 0
                        ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200/70'
                    } space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{win.label}</div>
                        <div className="text-[11px] font-medium text-slate-400">
                          {win.rangeLabel}
                        </div>
                      </div>
                      {win.normalizedPerfPct !== null && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              win.normalizedPerfPct >= 85
                                ? 'bg-emerald-500'
                                : win.normalizedPerfPct >= 70
                                ? 'bg-sky-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-800 tabular-nums">
                            {win.normalizedPerfPct}% Target
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-2xl font-black text-slate-900 tabular-nums">
                          {win.realAvgKwh.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400 ml-1">kWh/day</span>
                      </div>
                      <div className="text-right text-[11px] font-medium text-slate-500">
                        <div>Model: <strong className="text-slate-700">{win.modelAvgKwh.toFixed(1)} kWh/d</strong></div>
                        <div className="text-slate-400">Ideal: {win.idealAvgKwh.toFixed(1)} kWh/d</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Atmospheric Filter</span>
                      <span className="font-semibold text-slate-700">−{win.weatherAttenuationPct}% Sky Loss</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 text-center">
                Collecting telemetry to establish baseline rolling comparisons.
              </div>
            )}
          </section>

          {/* 2. Visual Daily Comparison Bar Strip (21-Day Horizon) */}
          <section className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Daily Sky Potential vs Weather Target vs Inverter Output
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pale bar = Clear-sky ceiling · Orange line = Weather Model · Solid bar = Inverter Generation
                </p>
              </div>

              {hoveredEntry && (
                <div className="text-xs font-medium text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="font-bold text-slate-900">{hoveredEntry.shortLabel}:</span>{' '}
                  Actual <strong className="text-emerald-700 font-bold">{hoveredEntry.realKwh !== null ? `${hoveredEntry.realKwh.toFixed(1)} kWh` : 'In Progress'}</strong>
                  {hoveredEntry.realVsModelPct !== null ? ` (${hoveredEntry.realVsModelPct}% of model)` : ''} ·{' '}
                  Target {hoveredEntry.weatherCleanKwh.toFixed(1)} kWh ·{' '}
                  Dust −{hoveredEntry.particleSurfaceLossPct.toFixed(1)}%
                </div>
              )}
            </div>

            {/* Seamless 21-Day Bar Strip */}
            <div className="w-full flex items-end gap-1.5 sm:gap-2 h-28 pt-2 px-1">
              {chartDays.map((day) => {
                const idealPct = Math.min(100, Math.round((day.idealClearSkyKwh / chartMaxKwh) * 100));
                const modelPct = Math.min(100, Math.round((day.weatherCleanKwh / chartMaxKwh) * 100));
                const realPct =
                  day.realKwh !== null ? Math.min(100, Math.round((day.realKwh / chartMaxKwh) * 100)) : 0;
                const meta = DIP_BADGE_META[day.dipCategory];
                const isSelected = hoveredYmd === day.ymd;

                return (
                  <div
                    key={day.ymd}
                    onMouseEnter={() => setHoveredYmd(day.ymd)}
                    className={`flex-1 min-w-[20px] flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      isSelected ? 'opacity-100 scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="w-full h-22 flex items-end justify-center relative">
                      {/* Clear-Sky Ghost Bar */}
                      <div
                        style={{ height: `${Math.max(6, idealPct)}%` }}
                        className="w-4/5 bg-slate-200/70 rounded-t-lg relative overflow-hidden flex items-end"
                      >
                        {/* Weather Target Line */}
                        <div
                          style={{ height: `${Math.min(100, Math.round((modelPct / Math.max(1, idealPct)) * 100))}%` }}
                          className="w-full border-t-2 border-amber-500 bg-amber-100/50 flex items-end"
                        />
                      </div>
                      {/* Real Solar Generation Bar */}
                      {day.realKwh !== null ? (
                        <div
                          style={{ height: `${Math.max(4, realPct)}%` }}
                          className={`absolute bottom-0 w-3/5 rounded-t-lg transition-all ${meta.barCls} ${
                            isSelected ? 'ring-2 ring-slate-900/40' : ''
                          }`}
                        />
                      ) : (
                        <div
                          style={{ height: `${Math.max(6, Math.min(25, modelPct))}%` }}
                          className="absolute bottom-0 w-3/5 rounded-t-lg border border-dashed border-slate-300 bg-white/70"
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                      {day.shortLabel.replace(' ', '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Surface Soiling Physics & Wash Event Logging */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Atmospheric & Soiling Telemetry */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-800">Glass Surface &amp; Atmospheric Split</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {soiling.confidenceLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
                <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Glass Dust</div>
                  <div className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">−{soiling.surfaceLossPct.toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Air Smog Haze</div>
                  <div className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">−{soiling.statsSinceWash.skyHazeLossPct}%</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PM10 / PM2.5</div>
                  <div className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">{soiling.statsSinceWash.avgPm10} / {soiling.statsSinceWash.avgPm25}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dew Nights</div>
                  <div className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">{soiling.statsSinceWash.dewNightsCount} Nights</div>
                </div>
              </div>

              {soiling.empiricalUsed && soiling.empiricalDriftPct !== null && (
                <div className="text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-200/70 rounded-xl px-3.5 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Verified against real clear-sky drift: Particle physics (−{soiling.particleModelLossPct}%) calibrated with rooftop clear-day decay.
                  </span>
                </div>
              )}
            </div>

            {/* Right: Manual Wash & Rain Log */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">Record Panel Washing / Rain</span>
                </div>

                {onLogWash && (
                  <form onSubmit={handleLogDate} className="flex items-center gap-2 pt-1">
                    <input
                      type="date"
                      value={effectiveWashDate}
                      min={report.commissioningYmd}
                      max={report.generatedAtIstYmd}
                      onChange={(e) => setWashDateInput(e.target.value)}
                      className="flex-1 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="submit"
                      disabled={isBusy || !effectiveWashDate}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      Log Wash
                    </button>
                  </form>
                )}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 max-h-24 overflow-y-auto no-scrollbar">
                {report.cleaningHistory.toReversed().slice(0, 4).map((ev) => (
                  <div
                    key={`${ev.ymd}-${ev.type}`}
                    className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200/60"
                  >
                    <div className="flex items-center gap-2 text-slate-700 truncate">
                      {ev.type === 'manual' ? (
                        <Droplets className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <CloudRain className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      )}
                      <span className="font-bold tabular-nums">{ev.ymd}</span>
                      <span className="text-slate-400 truncate">
                        {ev.type === 'rain_auto'
                          ? `Auto rain (${ev.precipMm?.toFixed(1)}mm)`
                          : ev.type === 'rain_partial'
                          ? `Partial rain (${ev.precipMm?.toFixed(1)}mm)`
                          : 'Manual panel wash'}
                      </span>
                    </div>
                    {ev.type === 'manual' && onRemoveWash && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWash(ev.ymd)}
                        disabled={isBusy}
                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title={`Remove wash on ${ev.ymd}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Day-by-Day Attribution Ledger */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Daily Generation &amp; Weather Attribution Ledger
              </h3>
              
              {/* Apple Segmented Control */}
              <div className="inline-flex p-1 rounded-2xl bg-slate-200/70">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Days ({report.dailyLedger.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('dips')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    filterMode === 'dips'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Weather &amp; Soiling Dips
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('wash')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    filterMode === 'wash'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rain &amp; Washes
                </button>
              </div>
            </div>

            {/* Clean Apple Table: No Scroller */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="w-full overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Generation</th>
                      <th className="py-3 px-4">Weather Target</th>
                      <th className="py-3 px-4">Surface Dust</th>
                      <th className="py-3 px-4">Atmospheric Conditions</th>
                      <th className="py-3 px-4">Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerDesc.map((row) => {
                      const meta = DIP_BADGE_META[row.dipCategory];
                      return (
                        <tr key={row.ymd} className="hover:bg-slate-50/70 transition">
                          {/* Date */}
                          <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 tabular-nums">
                            {row.shortLabel}
                            <span className="text-[11px] font-normal text-slate-400 block">{row.ymd}</span>
                          </td>

                          {/* Generation */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.realKwh !== null ? (
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-extrabold text-slate-900 tabular-nums">{row.realKwh.toFixed(1)} kWh</span>
                                {row.realVsModelPct !== null && (
                                  <span className="text-[11px] font-semibold text-emerald-700">({row.realVsModelPct}%)</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium">In Progress</span>
                            )}
                          </td>

                          {/* Weather Target */}
                          <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-600">
                            <span className="font-bold text-slate-800">{row.weatherCleanKwh.toFixed(1)}</span>
                            <span className="text-slate-400 text-[11px]"> / {row.idealClearSkyKwh.toFixed(1)} kWh</span>
                          </td>

                          {/* Surface Dust */}
                          <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                            <span
                              className={`font-bold ${
                                row.particleSurfaceLossPct >= 7
                                  ? 'text-rose-600'
                                  : row.stickyFilmActive
                                  ? 'text-amber-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              −{row.particleSurfaceLossPct.toFixed(1)}%
                            </span>
                            {row.stickyFilmActive && (
                              <span className="text-[10px] text-amber-600 block font-medium">Sticky Film</span>
                            )}
                          </td>

                          {/* Atmospheric Conditions */}
                          <td className="py-3 px-4 text-slate-600">
                            <div className="font-medium text-slate-800">{row.eventLabel}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>AQI PM10 {Math.round(row.pm10Avg)}</span>
                              {row.rainMm >= 0.2 && <span>· {row.rainMm.toFixed(1)}mm rain</span>}
                              {row.fogHours > 0 && <span>· {row.fogHours}h fog</span>}
                            </div>
                          </td>

                          {/* Assessment */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${meta.barCls} shrink-0`} />
                              <span className="text-xs font-bold text-slate-800">{meta.label}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>

        {/* Footer Bar */}
        <div className="px-6 sm:px-8 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            Computed on station · Physics model calibrated against clear-sky irradiance
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
