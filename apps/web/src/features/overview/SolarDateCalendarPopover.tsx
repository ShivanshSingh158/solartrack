import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, CloudRain, CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
import {
  buildMondayFirstMonthGrid,
  formatIndianDate,
  formatIndianMonthYear,
  shiftYm,
  type DayComparisonCalendarDay,
} from '@solar-track/core';

export interface SolarDateCalendarPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYmd: string;
  todayYmd: string;
  minDateYmd: string;
  maxDateYmd: string;
  lastSyncedYmd?: string | null;
  monthAvailabilityMap: Record<string, DayComparisonCalendarDay[]>;
  onRequestMonthAvailability: (ym: string) => void;
  onSelectDate: (ymd: string) => void;
}

const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SolarDateCalendarPopover: React.FC<SolarDateCalendarPopoverProps> = ({
  isOpen,
  onClose,
  selectedYmd,
  todayYmd,
  minDateYmd,
  maxDateYmd,
  lastSyncedYmd = null,
  monthAvailabilityMap,
  onRequestMonthAvailability,
  onSelectDate,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const defaultYm = (selectedYmd || todayYmd).slice(0, 7);
  const openAnchor = `${isOpen ? '1' : '0'}:${defaultYm}:${selectedYmd}`;
  const [manualView, setManualView] = useState<{ anchor: string; ym: string } | null>(null);
  const viewYm = manualView && manualView.anchor === openAnchor ? manualView.ym : defaultYm;
  const setViewYm = (nextYm: string) => setManualView({ anchor: openAnchor, ym: nextYm });

  useEffect(() => {
    if (isOpen && !monthAvailabilityMap[viewYm]) {
      onRequestMonthAvailability(viewYm);
    }
  }, [isOpen, viewYm, monthAvailabilityMap, onRequestMonthAvailability]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-calendar-trigger="true"]')) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [isOpen, onClose]);

  const minYm = minDateYmd.slice(0, 7);
  const maxYm = maxDateYmd.slice(0, 7);
  const canPrevMonth = viewYm > minYm;
  const canNextMonth = viewYm < maxYm;

  const gridCells = useMemo(() => buildMondayFirstMonthGrid(viewYm), [viewYm]);

  const dayYieldLookup = useMemo(() => {
    const map = new Map<string, number>();
    const currentList = monthAvailabilityMap[viewYm] || [];
    for (const item of currentList) {
      map.set(item.ymd, item.kwh);
    }
    return map;
  }, [monthAvailabilityMap, viewYm]);

  // Compute real Peak Day and Dip Day across loaded months strictly before Today
  const { peakHighlight, dipHighlight } = useMemo(() => {
    const syncedAll: DayComparisonCalendarDay[] = [];
    for (const days of Object.values(monthAvailabilityMap)) {
      for (const d of days) {
        if (d.ymd >= minDateYmd && d.ymd < todayYmd && d.kwh > 0.05) {
          syncedAll.push(d);
        }
      }
    }
    if (syncedAll.length === 0) {
      return { peakHighlight: null, dipHighlight: null };
    }
    let peak = syncedAll[0];
    let dip = syncedAll[0];
    for (const item of syncedAll) {
      if (item.kwh > peak.kwh) peak = item;
      if (item.kwh < dip.kwh) dip = item;
    }
    return {
      peakHighlight: peak,
      dipHighlight: dip.ymd !== peak.ymd ? dip : null,
    };
  }, [monthAvailabilityMap, minDateYmd, todayYmd]);

  if (!isOpen) return null;

  const handleStepMonth = (delta: number) => {
    const nextYm = shiftYm(viewYm, delta);
    if (nextYm < minYm || nextYm > maxYm) return;
    setViewYm(nextYm);
    if (!monthAvailabilityMap[nextYm]) {
      onRequestMonthAvailability(nextYm);
    }
  };

  const handlePickDate = (ymd: string) => {
    if (ymd < minDateYmd || ymd > maxDateYmd) return;
    onSelectDate(ymd);
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Select solar comparison date"
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] sm:w-[344px] rounded-2xl bg-white/98 backdrop-blur-xl border border-slate-200/90 shadow-2xl shadow-slate-900/12 p-3.5 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Top Month Navigation */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <button
          type="button"
          onClick={() => handleStepMonth(-1)}
          disabled={!canPrevMonth}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>{formatIndianMonthYear(viewYm)}</span>
        </div>

        <button
          type="button"
          onClick={() => handleStepMonth(1)}
          disabled={!canNextMonth}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Indian Weekday Header (Mon..Sun) */}
      <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
        {WEEKDAYS_MON_FIRST.map((wd) => (
          <span key={wd} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {wd}
          </span>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-1">
        {gridCells.map((cell) => {
          const inBounds = cell.ymd >= minDateYmd && cell.ymd <= maxDateYmd;
          const isSelected = cell.ymd === selectedYmd;
          const isTodayCell = cell.ymd === todayYmd;
          const isCommissioning = cell.ymd === minDateYmd;
          const kwhVal = dayYieldLookup.get(cell.ymd);
          const isSynced = typeof kwhVal === 'number' && kwhVal > 0.05;
          const isPendingPast = inBounds && !isTodayCell && cell.inMonth && !isSynced && !isCommissioning;

          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={!inBounds || !cell.inMonth}
              onClick={() => handlePickDate(cell.ymd)}
              title={
                !cell.inMonth
                  ? undefined
                  : !inBounds
                  ? `Outside plant logs (${formatIndianDate(minDateYmd)} – ${formatIndianDate(maxDateYmd)})`
                  : isSynced
                  ? `${formatIndianDate(cell.ymd)} · ${kwhVal!.toFixed(1)} kWh Cloud Confirmed`
                  : isCommissioning
                  ? `${formatIndianDate(cell.ymd)} · Plant Commissioning Day`
                  : isTodayCell
                  ? `${formatIndianDate(cell.ymd)} · Today`
                  : `${formatIndianDate(cell.ymd)} · Wi-Fi Offline All Day (Unlogged in Cloud)`
              }
              className={`relative flex flex-col items-center justify-center rounded-xl py-1 min-h-[36px] transition-all text-center ${
                !cell.inMonth
                  ? 'opacity-0 pointer-events-none'
                  : !inBounds
                  ? 'text-slate-300 cursor-not-allowed'
                  : isSelected
                  ? 'bg-slate-900 text-white shadow-sm cursor-pointer'
                  : isTodayCell
                  ? 'bg-amber-50/90 text-amber-950 ring-1 ring-amber-300 hover:bg-amber-100/80 cursor-pointer'
                  : isSynced
                  ? 'bg-emerald-50/55 text-slate-800 hover:bg-emerald-100/70 cursor-pointer'
                  : 'bg-slate-50/70 text-slate-600 hover:bg-slate-100 cursor-pointer'
              }`}
            >
              <span className="text-[12px] font-bold leading-none tabular-nums">{cell.day}</span>
              <span
                className={`mt-1 text-[9px] font-semibold leading-none tabular-nums ${
                  isSelected
                    ? isSynced
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                    : isSynced
                    ? 'text-emerald-700'
                    : isTodayCell
                    ? 'text-amber-700'
                    : isCommissioning
                    ? 'text-slate-400'
                    : isPendingPast
                    ? 'text-amber-600'
                    : 'text-transparent'
                }`}
              >
                {isSynced
                  ? kwhVal!.toFixed(1)
                  : isTodayCell
                  ? 'Today'
                  : isCommissioning
                  ? 'Start'
                  : isPendingPast
                  ? 'Off'
                  : '.'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Apple-Grade Structured Calendar Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100/90 space-y-2.5">
        {/* Quick Jump Buttons: Balanced & Unified */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handlePickDate(todayYmd)}
            className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 border ${
              selectedYmd === todayYmd
                ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100/90 border-slate-200/70 text-slate-700'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
            <span>Today ({formatIndianDate(todayYmd, 'short')})</span>
          </button>

          {lastSyncedYmd && lastSyncedYmd !== todayYmd ? (
            <button
              type="button"
              onClick={() => handlePickDate(lastSyncedYmd)}
              className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 border ${
                selectedYmd === lastSyncedYmd
                  ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50/60 hover:bg-emerald-100/80 border-emerald-200/70 text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 opacity-80" />
              <span>Last Sync ({formatIndianDate(lastSyncedYmd, 'short')})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handlePickDate(shiftYm(todayYmd, 0))}
              disabled
              className="w-full py-1.5 px-3 rounded-xl text-[11px] font-medium border border-slate-100 bg-slate-50/40 text-slate-400 flex items-center justify-center"
            >
              <span>Current Range</span>
            </button>
          )}
        </div>

        {/* Quiet Milestone Metrics (Peak & Dip) */}
        {(peakHighlight || dipHighlight) && (
          <div className="grid grid-cols-2 gap-2 pt-0.5 text-[10.5px]">
            {peakHighlight && (
              <button
                type="button"
                onClick={() => handlePickDate(peakHighlight.ymd)}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                  selectedYmd === peakHighlight.ymd
                    ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold'
                    : 'bg-slate-50/50 hover:bg-slate-100/80 border-slate-200/60 text-slate-600 font-medium'
                }`}
              >
                <span className="flex items-center gap-1 text-sky-700">
                  <Sparkles className="w-3 h-3 text-sky-600" />
                  <span>Peak</span>
                </span>
                <span className="tabular-nums font-bold text-slate-800">
                  {peakHighlight.kwh.toFixed(1)} kWh
                </span>
              </button>
            )}

            {dipHighlight && (
              <button
                type="button"
                onClick={() => handlePickDate(dipHighlight.ymd)}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                  selectedYmd === dipHighlight.ymd
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                    : 'bg-slate-50/50 hover:bg-slate-100/80 border-slate-200/60 text-slate-600 font-medium'
                }`}
              >
                <span className="flex items-center gap-1 text-amber-700">
                  <CloudRain className="w-3 h-3 text-amber-600" />
                  <span>Lowest</span>
                </span>
                <span className="tabular-nums font-bold text-slate-800">
                  {dipHighlight.kwh.toFixed(1)} kWh
                </span>
              </button>
            )}
          </div>
        )}

        {/* Minimal Bottom Legend */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1">
          <span>
            {formatIndianDate(minDateYmd, 'short')} – {formatIndianDate(maxDateYmd, 'short')}
          </span>
          <span className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Synced
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              Pending
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
