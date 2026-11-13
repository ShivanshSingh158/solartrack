import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  TrendingUp,
  Droplets,
  CloudRain,
  Wind,
  AlertTriangle,
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
    label: 'Outage / Telemetry Gap',
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200/80',
    barCls: 'bg-rose-500',
  },
  CLOUD_RAIN: {
    label: 'Cloud / Rain',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    barCls: 'bg-sky-500',
  },
  FOG_HAZE: {
    label: 'Morning Fog / Smog',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    barCls: 'bg-amber-500',
  },
  SOILING_DRIFT: {
    label: 'Surface Soiling',
    badgeCls: 'bg-orange-50 text-orange-800 border-orange-200/80',
    barCls: 'bg-orange-500',
  },
  BELOW_BASELINE: {
    label: 'Below Curve',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
    barCls: 'bg-slate-500',
  },
  WIFI_OUTAGE_UNLOGGED: {
    label: 'Wi-Fi Offline All Day',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    barCls: 'bg-amber-400',
  },
  PENDING_SYNC: {
    label: 'Awaiting Sync (<00:00)',
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
  nominalPrPct = 81.6,
  onRefresh,
  onLogWash,
  onRemoveWash,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'dips' | 'wash'>('all');
  const [hoveredYmd, setHoveredYmd] = useState<string | null>(null);
  const [washDateInput, setWashDateInput] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  const effectiveWashDate = washDateInput || report?.generatedAtIstYmd || '';

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const ledgerDesc = useMemo(() => {
    if (!report) return [];
    const base = [...report.dailyLedger].reverse();
    if (filterMode === 'dips') {
      return base.filter(
        (d) =>
          d.dipCategory === 'OUTAGE_GAP' ||
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
    const latestConfirmed = [...chartDays].reverse().find((d) => d.realKwh !== null);
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
      className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-5xl w-full p-5 sm:p-6 space-y-4 text-slate-900 my-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Weekly Performance & Weather Soiling Audit
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {plantName} · {report.capacityKwp.toFixed(2)} kWp DC
                {report.siteCalibration?.inverterCoeffs?.referenceAcKw
                  ? ` / ${report.siteCalibration.inverterCoeffs.referenceAcKw.toFixed(2)} kW AC`
                  : ''}{' '}
                ({tiltDegrees}° Tilt · {nominalPrPct}% PR) · Commissioned {report.commissioningYmd}
              </p>
              {report.siteCalibration && (
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  {report.siteCalibration.enabled ? 'Satellite-Calibrated Solar Model' : 'Raw Weather Model'} ·{' '}
                  <span className="font-semibold text-slate-700">
                    Calibrated for Kanpur Rooftop ({tiltDegrees}° Tilt)
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isBusy}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                title="Recompute engine"
              >
                <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close audit"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Rolling Week-over-Week Summary & Cards */}
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rolling Week-over-Week Comparison
            </h3>
            <span className="text-xs font-medium text-slate-600">
              {weeklyComparison.headlineSummary}
            </span>
          </div>

          {windows.length > 0 ? (
            <div className={`grid grid-cols-1 gap-3 ${windows.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {windows.map(({ key, win }, idx) => (
                <div
                  key={key}
                  className={`p-4 rounded-2xl border ${
                    idx === 0
                      ? 'bg-emerald-50/35 border-emerald-200/80'
                      : 'bg-slate-50/70 border-slate-200/70'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{win.label}</div>
                      <div className="text-[11px] font-medium text-slate-500">
                        {win.rangeLabel} · {win.confirmedDaysCount}/{win.daysCount} synced days
                      </div>
                    </div>
                    {win.normalizedPerfPct !== null && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            win.normalizedPerfPct >= 90
                              ? 'bg-emerald-500'
                              : win.normalizedPerfPct >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span className="text-[12px] font-bold text-slate-800 tabular-nums">
                          {win.normalizedPerfPct}% Target
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-xl font-bold num text-slate-900">
                        {win.realAvgKwh.toFixed(1)}
                      </span>
                      <span className="text-xs font-medium text-slate-500 ml-1">kWh/day real</span>
                    </div>
                    <div className="text-right text-[11px] font-medium text-slate-500 num">
                      <div>Clean Model: {win.modelAvgKwh.toFixed(1)} kWh/d</div>
                      <div>Ideal Sky: {win.idealAvgKwh.toFixed(1)} kWh/d (-{win.weatherAttenuationPct}% sky)</div>
                    </div>
                  </div>

                  {win.biggestDip && (
                    <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">
                        {win.biggestDip.shortLabel} ({win.biggestDip.pct}%): {win.biggestDip.reason}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500">
              Collecting at least 2 completed days to build week-over-week comparison windows.
            </div>
          )}
        </section>

        {/* Visual Daily Comparison Bar Strip: Ideal Sky vs Clean Model vs Real Hardware */}
        <section className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200/75 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Daily Sky Potential vs Clean Model vs Real Inverter Yield
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pale bar = Clear-sky potential · Orange line = Expected Weather Target · Solid bar = Actual Inverter Yield
              </p>
            </div>
            {hoveredEntry && (
              <div className="text-[11px] font-medium text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs num">
                <span className="font-bold text-slate-900">{hoveredEntry.shortLabel}:</span>{' '}
                Ideal {hoveredEntry.idealClearSkyKwh.toFixed(1)} · Model {hoveredEntry.weatherCleanKwh.toFixed(1)} ·{' '}
                Real {hoveredEntry.realKwh !== null ? `${hoveredEntry.realKwh.toFixed(1)} kWh` : 'Pending'}{' '}
                {hoveredEntry.realVsModelPct !== null ? `(${hoveredEntry.realVsModelPct}%)` : ''} ·{' '}
                Dust -{hoveredEntry.particleSurfaceLossPct.toFixed(1)}%
              </div>
            )}
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex items-end gap-1.5 min-w-[540px] h-28 pt-2 px-1">
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
                    className={`flex-1 min-w-[24px] flex flex-col items-center gap-1 cursor-pointer group ${
                      isSelected ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="w-full h-22 flex items-end justify-center relative">
                      {/* Clear-Sky Ceiling Ghost Bar */}
                      <div
                        style={{ height: `${Math.max(4, idealPct)}%` }}
                        className="w-4/5 bg-slate-200/65 rounded-t-md relative overflow-hidden flex items-end"
                      >
                        {/* Clean Weather Model Marker Line */}
                        <div
                          style={{ height: `${Math.min(100, Math.round((modelPct / Math.max(1, idealPct)) * 100))}%` }}
                          className="w-full border-t-2 border-amber-500/80 bg-amber-100/45 flex items-end"
                        />
                      </div>
                      {/* Real Hardware Bar overlaid cleanly in center */}
                      {day.realKwh !== null ? (
                        <div
                          style={{ height: `${Math.max(3, realPct)}%` }}
                          className={`absolute bottom-0 w-3/5 rounded-t-md transition-all ${meta.barCls} ${
                            isSelected ? 'ring-2 ring-slate-900/30' : ''
                          }`}
                        />
                      ) : (
                        <div
                          style={{ height: `${Math.max(4, Math.min(20, modelPct))}%` }}
                          className="absolute bottom-0 w-3/5 rounded-t-md border border-dashed border-slate-400 bg-white/50"
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-medium text-slate-500 num tracking-tight">
                      {day.shortLabel.replace(' ', '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Surface Soiling Physics Summary & Manual Wash Backdate Control */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-50 border border-slate-200/75 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold text-slate-800">Glass Surface & Atmospheric Split</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {soiling.confidenceLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Glass Dirt Loss</div>
                <div className="font-bold text-slate-900 num mt-0.5">-{soiling.surfaceLossPct.toFixed(1)}%</div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Air Smog Haze</div>
                <div className="font-bold text-slate-900 num mt-0.5">-{soiling.statsSinceWash.skyHazeLossPct}%</div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400 uppercase">PM10 / PM2.5 Avg</div>
                <div className="font-bold text-slate-900 num mt-0.5">{soiling.statsSinceWash.avgPm10} / {soiling.statsSinceWash.avgPm25}</div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Dew / Fog Nights</div>
                <div className="font-bold text-slate-900 num mt-0.5">{soiling.statsSinceWash.dewNightsCount} dew · {soiling.statsSinceWash.fogDaysCount} fog</div>
              </div>
            </div>
            {soiling.empiricalUsed && soiling.empiricalDriftPct !== null && (
              <div className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Verified against real clear-sky drift: Particle physics (-{soiling.particleModelLossPct}%) blended with Cloud clear-day decay (-{soiling.empiricalDriftPct}%).
                </span>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/75 space-y-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Backdate Manual Wash / Rain Events</span>
            </div>
            {onLogWash && (
              <form onSubmit={handleLogDate} className="flex items-center gap-2">
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
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Log Wash
                </button>
              </form>
            )}
            <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
              {[...report.cleaningHistory].reverse().slice(0, 5).map((ev) => (
                <div
                  key={`${ev.ymd}-${ev.type}`}
                  className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200/60"
                >
                  <div className="flex items-center gap-1.5 text-slate-700 truncate">
                    {ev.type === 'manual' ? (
                      <Droplets className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : (
                      <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
                    )}
                    <span className="font-semibold num">{ev.ymd}</span>
                    <span className="text-slate-500 truncate">
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
                      className="text-slate-400 hover:text-rose-600 transition p-0.5 cursor-pointer"
                      title={`Remove manual wash on ${ev.ymd}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Day-by-Day Attribution Table */}
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Day-by-Day Yield & Dip Attribution Ledger
            </h3>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Days ({report.dailyLedger.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('dips')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  filterMode === 'dips' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dips & Outages
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('wash')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  filterMode === 'wash' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Rain / Wash Events
              </button>
            </div>
          </div>

          <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Ideal / Model</th>
                    <th className="py-2.5 px-3">Real Yield</th>
                    <th className="py-2.5 px-3">Glass Dust</th>
                    <th className="py-2.5 px-3">Atmosphere & Event</th>
                    <th className="py-2.5 px-3">Root Cause</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerDesc.map((row) => {
                    const meta = DIP_BADGE_META[row.dipCategory];
                    return (
                      <tr key={row.ymd} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-900 num">
                          {row.shortLabel}
                          <div className="text-[10px] font-normal text-slate-400">{row.ymd}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap num text-slate-700">
                          <span className="font-semibold">{row.weatherCleanKwh.toFixed(1)}</span>
                          <span className="text-slate-400"> / {row.idealClearSkyKwh.toFixed(1)} kWh</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap num">
                          {row.realKwh !== null ? (
                            <div>
                              <span className="font-bold text-slate-900">{row.realKwh.toFixed(1)} kWh</span>
                              {row.realVsModelPct !== null && (
                                <span className="text-slate-500 ml-1">({row.realVsModelPct}%)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">Pending</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap num">
                          <span
                            className={`font-semibold ${
                              row.particleSurfaceLossPct >= 7
                                ? 'text-rose-600'
                                : row.stickyFilmActive
                                ? 'text-amber-700'
                                : 'text-slate-700'
                            }`}
                          >
                            -{row.particleSurfaceLossPct.toFixed(1)}%
                          </span>
                          {row.stickyFilmActive && (
                            <span className="text-[10px] text-amber-700 block">Sticky</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 min-w-[175px]">
                          <div className="font-medium text-slate-800">{row.eventLabel}</div>
                          <div className="text-[10px] text-slate-400 num flex items-center gap-1.5">
                            <span>Dust {Math.round(row.pm10Avg)} µg/m³</span>
                            <span>· Smog & Haze</span>
                            {row.rainMm >= 0.2 && <span>· {row.rainMm.toFixed(1)}mm rain</span>}
                            {row.fogHours > 0 && <span>· {row.fogHours}h fog</span>}
                            {row.dewGlueHours >= 2 && (
                              <span className="inline-flex items-center gap-0.5">
                                · <Wind className="w-2.5 h-2.5" /> {row.dewGlueHours}h morning dew
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 min-w-[190px]">
                          <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-800">
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.barCls} shrink-0`} />
                            <span>{meta.label}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {row.dipReasonLabel}
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
    </div>
  );
};
