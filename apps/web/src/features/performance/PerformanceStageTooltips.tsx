import React from 'react';
import {
  formatIndianDate,
  formatWeekdayShort,
  type TimescaleMode,
} from '@solar-track/core';
import type {
  DayHoverInfo,
  PerformanceBulletBarItem,
  PerformanceYearMonthItem,
  StagePlotLayout,
} from './performanceStageTypes';

interface PerformanceStageTooltipsProps {
  timescale: TimescaleMode;
  layout: StagePlotLayout;
  selectedDate: string;
  compareDateYmd: string | null;
  showModelOverlay: boolean;
  showPriorWeekOverlay: boolean;
  dayHoverInfo: DayHoverInfo | null;
  bulletBars: PerformanceBulletBarItem[];
  activeHoveredBarYmd: string | null;
  yearMonths: PerformanceYearMonthItem[];
  hoveredYearIdx: number | null;
}

/**
 * Floating dark-glass tooltips clamped within the Performance SVG stage bounds.
 */
export const PerformanceStageTooltips: React.FC<PerformanceStageTooltipsProps> = ({
  timescale,
  layout,
  selectedDate,
  compareDateYmd,
  showModelOverlay,
  showPriorWeekOverlay,
  dayHoverInfo,
  bulletBars,
  activeHoveredBarYmd,
  yearMonths,
  hoveredYearIdx,
}) => {
  const { svgW, plotLeft, plotW } = layout;

  if (timescale === 'day' && dayHoverInfo) {
    return (
      <div
        className="pointer-events-none absolute top-2 z-30 w-64 rounded-2xl bg-slate-900/95 text-white border border-slate-700/80 shadow-xl px-3.5 py-2.5 text-[11px] backdrop-blur-md"
        style={{
          left:
            dayHoverInfo.x > svgW * 0.56
              ? `${Math.max(8, dayHoverInfo.x - 270)}px`
              : `${Math.min(svgW - 264, dayHoverInfo.x + 14)}px`,
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
          <span className="font-bold text-slate-100 tabular-nums">{dayHoverInfo.timeLabel} IST</span>
          <span className="text-[10px] font-medium text-slate-400 tabular-nums">
            {formatIndianDate(selectedDate, 'short')}
          </span>
        </div>

        <div className="space-y-1 tabular-nums">
          {showModelOverlay && (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sky-300">
                <span className="w-2.5 border-t border-dashed border-sky-400" />
                Model
              </span>
              <span className="font-semibold">
                ~{dayHoverInfo.modelKw.toFixed(2)} kW · {dayHoverInfo.modelCumKwh.toFixed(1)} kWh
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {dayHoverInfo.realKw !== null
                ? 'Real AC'
                : dayHoverInfo.bridgedKw !== null
                  ? 'EDay Bridged'
                  : 'Real AC'}
            </span>
            <span className={`font-bold ${dayHoverInfo.bridgedKw !== null ? 'text-amber-200' : 'text-emerald-200'}`}>
              {dayHoverInfo.realKw !== null
                ? `${dayHoverInfo.realKw.toFixed(2)} kW · ${dayHoverInfo.realCumKwh!.toFixed(1)} kWh`
                : dayHoverInfo.bridgedKw !== null
                  ? `~${dayHoverInfo.bridgedKw.toFixed(2)} kW (+${dayHoverInfo.bridgedSegmentKwh?.toFixed(1)} kWh gap)`
                  : 'Standby / No pt'}
            </span>
          </div>

          {dayHoverInfo.dcKw !== null && (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 border-t border-dashed border-amber-400" />
                PV DC
              </span>
              <span className="font-semibold text-amber-200">
                {dayHoverInfo.dcKw.toFixed(2)} kW
                {dayHoverInfo.instantEtaPct !== null ? ` (η ${dayHoverInfo.instantEtaPct}%)` : ''}
              </span>
            </div>
          )}

          {compareDateYmd && (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-indigo-300">
                <span className="w-2.5 border-t border-dotted border-indigo-400" />
                {formatIndianDate(compareDateYmd, 'short')}
              </span>
              <span className="font-semibold text-indigo-200">
                {dayHoverInfo.compareKw !== null
                  ? `${dayHoverInfo.compareKw.toFixed(2)} kW · ${dayHoverInfo.compareCumKwh!.toFixed(1)} kWh`
                  : 'No pt'}
              </span>
            </div>
          )}

          {(dayHoverInfo.diffKw !== null || dayHoverInfo.instantCapturePct !== null) && (
            <div className="pt-1.5 mt-1 border-t border-white/10 space-y-0.5 text-[10px]">
              {compareDateYmd && dayHoverInfo.diffKw !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Instant Δ vs {formatIndianDate(compareDateYmd, 'short')}</span>
                  <span
                    className={`font-bold ${
                      dayHoverInfo.diffKw >= 0 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {dayHoverInfo.diffKw >= 0 ? '+' : ''}
                    {dayHoverInfo.diffKw.toFixed(2)} kW
                    {dayHoverInfo.diffKwPct !== null
                      ? ` (${dayHoverInfo.diffKwPct >= 0 ? '+' : ''}${dayHoverInfo.diffKwPct}%)`
                      : ''}
                  </span>
                </div>
              )}
              {compareDateYmd && dayHoverInfo.diffCumKwh !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Cum Δ by {dayHoverInfo.timeLabel}</span>
                  <span
                    className={`font-bold ${
                      dayHoverInfo.diffCumKwh >= 0 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {dayHoverInfo.diffCumKwh >= 0 ? '+' : ''}
                    {dayHoverInfo.diffCumKwh.toFixed(2)} kWh
                    {dayHoverInfo.diffCumPct !== null
                      ? ` (${dayHoverInfo.diffCumPct >= 0 ? '+' : ''}${dayHoverInfo.diffCumPct}%)`
                      : ''}
                  </span>
                </div>
              )}
              {!compareDateYmd && dayHoverInfo.instantCapturePct !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Capture vs Physics</span>
                  <span
                    className={`font-bold ${
                      dayHoverInfo.instantCapturePct >= 95 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {dayHoverInfo.instantCapturePct}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if ((timescale === 'week' || timescale === 'month') && activeHoveredBarYmd) {
    const bIdx = bulletBars.findIndex((b) => b.ymd === activeHoveredBarYmd);
    if (bIdx < 0) return null;
    const b = bulletBars[bIdx];
    const slotW = plotW / Math.max(1, bulletBars.length);
    const cx = plotLeft + (bIdx + 0.5) * slotW;

    return (
      <div
        className="pointer-events-none absolute top-2 z-30 w-60 rounded-2xl bg-slate-900/95 text-white border border-slate-700/80 shadow-xl px-3.5 py-2.5 text-[11px] backdrop-blur-md"
        style={{
          left:
            cx > svgW * 0.56
              ? `${Math.max(8, cx - 252)}px`
              : `${Math.min(svgW - 248, cx + 14)}px`,
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
          <span className="font-bold text-white">
            {formatWeekdayShort(b.ymd)} · {formatIndianDate(b.ymd, 'medium')}
          </span>
        </div>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-emerald-300">Cloud Logged</span>
            <span className="font-bold">{b.realKwh.toFixed(2)} kWh</span>
          </div>
          {(b.bufferKwh ?? 0) > 0.05 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-amber-300">Outage Buffer</span>
                <span className="font-semibold">+{b.bufferKwh!.toFixed(2)} kWh</span>
              </div>
              <div className="flex items-center justify-between pt-0.5 border-t border-white/10">
                <span className="text-white font-semibold">Total Output</span>
                <span className="font-bold text-amber-200">{(b.realKwh + b.bufferKwh!).toFixed(2)} kWh</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sky-300">Physics Model</span>
            <span className="font-semibold">
              ~{b.modelKwh.toFixed(1)} kWh{' '}
              {b.capturePct !== null ? `(${b.capturePct}%)` : ''}
            </span>
          </div>
          {b.idealClearSkyKwh > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Clear-Sky Ceiling</span>
              <span>{b.idealClearSkyKwh.toFixed(1)} kWh</span>
            </div>
          )}
          {timescale === 'week' && showPriorWeekOverlay && typeof b.prevPeriodKwh === 'number' && (
            <div className="flex items-center justify-between">
              <span className="text-indigo-300">Prior 7d Same Slot</span>
              <span>{b.prevPeriodKwh.toFixed(1)} kWh</span>
            </div>
          )}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
            <span className="text-slate-300">{b.dipReasonLabel}</span>
            {!b.isFuture && <span className="text-sky-300 font-semibold">Click → 5-Min</span>}
          </div>
        </div>
      </div>
    );
  }

  if (timescale === 'year' && hoveredYearIdx !== null && yearMonths[hoveredYearIdx]) {
    const m = yearMonths[hoveredYearIdx];
    const slotW = plotW / 12;
    const cx = plotLeft + (hoveredYearIdx + 0.5) * slotW;
    return (
      <div
        className="pointer-events-none absolute top-2 z-30 w-56 rounded-2xl bg-slate-900/95 text-white border border-slate-700/80 shadow-xl px-3.5 py-2.5 text-[11px] backdrop-blur-md"
        style={{
          left:
            cx > svgW * 0.56
              ? `${Math.max(8, cx - 236)}px`
              : `${Math.min(svgW - 232, cx + 14)}px`,
        }}
      >
        <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
          {m.label}
        </div>
        {m.isPreCommissioning ? (
          <div className="text-slate-300 text-[10.5px]">
            Pre-Installation (Plant commissioned later)
          </div>
        ) : m.isFutureMonth ? (
          <div className="text-slate-300 text-[10.5px]">Upcoming calendar month</div>
        ) : (
          <div className="space-y-1 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-emerald-300">Verified Output</span>
              <span className="font-bold">{m.realKwh.toFixed(1)} kWh</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Est. Value</span>
              <span>₹{m.savingsInr.toLocaleString('en-IN')}</span>
            </div>
            {m.activeDays > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active Days</span>
                <span>
                  {m.activeDays}d {m.dailyAvgKwh ? `(${m.dailyAvgKwh.toFixed(1)}/d)` : ''}
                </span>
              </div>
            )}
            <div className="pt-1 border-t border-white/10 text-[10px] text-sky-300 font-semibold">
              Click month → Daily breakdown
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
