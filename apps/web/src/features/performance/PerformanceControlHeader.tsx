import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  GitCompareArrows,
  Printer,
  Table as TableIcon,
  X,
} from 'lucide-react';
import {
  formatIndianDate,
  formatIndianMonthYear,
  shiftYm,
  shiftYmdDays,
  type DayComparisonCalendarDay,
  type TimescaleMode,
} from '@solar-track/core';
import { SolarDateCalendarPopover } from '../overview/SolarDateCalendarPopover';

interface PerformanceControlHeaderProps {
  timescale: TimescaleMode;
  onChangeTimescale: (mode: TimescaleMode) => void;
  selectedDate: string;
  onChangeDate: (ymd: string) => void;
  compareDateYmd: string | null;
  onChangeCompareDateYmd: (ymd: string | null) => void;
  yesterdayYmd: string;
  bestDayYmd: string | null;
  lastSyncedYmd: string | null;
  selectedWeekEndYmd: string;
  onChangeWeekEndYmd: (ymd: string) => void;
  selectedMonth: string;
  onChangeMonth: (ym: string) => void;
  selectedYear: number;
  onChangeYear: (year: number) => void;
  viewMode: 'chart' | 'table';
  onChangeViewMode: (mode: 'chart' | 'table') => void;
  commissioningYmd: string;
  todayYmd: string;
  monthAvailabilityByYm: Record<string, DayComparisonCalendarDay[]>;
  onRequestMonthAvailability: (ym: string) => void;
  onDownloadCSV: () => void;
  onOpenPrintAudit: () => void;
  isCombined?: boolean;
}

const MODE_OPTIONS: Array<{ key: TimescaleMode; shortLabel: string; subLabel: string }> = [
  { key: 'day', shortLabel: 'Day', subLabel: '5-Min Curve' },
  { key: 'week', shortLabel: 'Week', subLabel: '7-Day Overview' },
  { key: 'month', shortLabel: 'Month', subLabel: 'Daily Breakdown' },
  { key: 'year', shortLabel: 'Year', subLabel: '12-Month Progress' },
];

export const PerformanceControlHeader: React.FC<PerformanceControlHeaderProps> = ({
  timescale,
  onChangeTimescale,
  selectedDate,
  onChangeDate,
  compareDateYmd,
  onChangeCompareDateYmd,
  yesterdayYmd,
  bestDayYmd,
  lastSyncedYmd,
  selectedWeekEndYmd,
  onChangeWeekEndYmd,
  selectedMonth,
  onChangeMonth,
  selectedYear,
  onChangeYear,
  viewMode,
  onChangeViewMode,
  commissioningYmd,
  todayYmd,
  monthAvailabilityByYm,
  onRequestMonthAvailability,
  onDownloadCSV,
  onOpenPrintAudit,
  isCombined = false,
}) => {
  // Sliding segmented track state (matching TopHeader spring transition)
  const trackRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [sliderStyle, setSliderStyle] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  // Popover state
  const [isDateCalendarOpen, setIsDateCalendarOpen] = useState(false);
  const [isCompareMenuOpen, setIsCompareMenuOpen] = useState(false);
  const [isCompareCalendarOpen, setIsCompareCalendarOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const datePopoverRef = useRef<HTMLDivElement | null>(null);
  const compareRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const updateSlider = () => {
      const container = trackRef.current;
      const btn = tabRefs.current[timescale];
      if (!container || !btn) return;
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setSliderStyle({
        left: bRect.left - cRect.left,
        width: bRect.width,
        ready: true,
      });
    };

    updateSlider();
    window.addEventListener('resize', updateSlider);
    const observer =
      typeof ResizeObserver !== 'undefined' && trackRef.current
        ? new ResizeObserver(updateSlider)
        : null;
    if (observer && trackRef.current) observer.observe(trackRef.current);
    return () => {
      window.removeEventListener('resize', updateSlider);
      observer?.disconnect();
    };
  }, [timescale]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (datePopoverRef.current && !datePopoverRef.current.contains(target)) {
        setIsDateCalendarOpen(false);
      }
      if (compareRef.current && !compareRef.current.contains(target)) {
        setIsCompareMenuOpen(false);
        setIsCompareCalendarOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(target)) {
        setIsExportOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDateCalendarOpen(false);
        setIsCompareMenuOpen(false);
        setIsCompareCalendarOpen(false);
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const minYm = commissioningYmd.slice(0, 7);
  const maxYm = todayYmd.slice(0, 7);
  const minYear = parseInt(commissioningYmd.slice(0, 4), 10) || 2026;
  const maxYear = parseInt(todayYmd.slice(0, 4), 10) || 2026;

  // Week clamping helpers
  const minWeekEnd = shiftYmdDays(commissioningYmd, 6);
  const effectiveMinWeekEnd = minWeekEnd <= todayYmd ? minWeekEnd : todayYmd;
  const clampedWeekEnd =
    selectedWeekEndYmd > todayYmd
      ? todayYmd
      : selectedWeekEndYmd < effectiveMinWeekEnd
        ? effectiveMinWeekEnd
        : selectedWeekEndYmd;
  const weekStartYmd = shiftYmdDays(clampedWeekEnd, -6) < commissioningYmd ? commissioningYmd : shiftYmdDays(clampedWeekEnd, -6);

  const canGoPrevDay = selectedDate > commissioningYmd;
  const canGoNextDay = selectedDate < todayYmd;
  const canGoPrevWeek = clampedWeekEnd > effectiveMinWeekEnd;
  const canGoNextWeek = clampedWeekEnd < todayYmd;
  const canGoPrevMonth = selectedMonth > minYm;
  const canGoNextMonth = selectedMonth < maxYm;
  const canGoPrevYear = selectedYear > minYear;
  const canGoNextYear = selectedYear < maxYear;

  const isTodaySelected = selectedDate === todayYmd;

  return (
    <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/75 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white rounded-t-3xl">
      {/* LEFT: Sliding 4-Mode Segmented Track */}
      <div className="flex items-center justify-between gap-3">
        <div
          ref={trackRef}
          className="relative inline-flex items-center p-1 rounded-2xl apple-glass-pill select-none shadow-2xs"
          role="tablist"
          aria-label="Performance Timescale"
        >
          {sliderStyle.ready && (
            <div
              aria-hidden="true"
              className="absolute top-1 bottom-1 rounded-xl bg-white shadow-xs border border-white/90 pointer-events-none"
              style={{
                width: `${sliderStyle.width}px`,
                transform: `translateX(${sliderStyle.left - 4}px)`,
                transition:
                  'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          )}

          {MODE_OPTIONS.map((opt) => {
            const active = timescale === opt.key;
            return (
              <button
                key={opt.key}
                ref={(el) => {
                  tabRefs.current[opt.key] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeTimescale(opt.key)}
                className={`relative z-10 px-2.5 sm:px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{opt.shortLabel}</span>
                <span
                  className={`hidden sm:inline text-[10.5px] font-medium ${
                    active ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  · {opt.subLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile quick View-Swap icon group */}
        <div className="inline-flex sm:hidden items-center p-0.5 rounded-lg bg-slate-100/80 border border-slate-200/70">
          <button
            type="button"
            onClick={() => onChangeViewMode('chart')}
            aria-label="Chart View"
            className={`p-1.5 rounded-md cursor-pointer transition ${
              viewMode === 'chart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('table')}
            aria-label="Log Table View"
            className={`p-1.5 rounded-md cursor-pointer transition ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* RIGHT: Contextual Indian Navigator + Compare + View Swap + Export */}
      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
        {/* Contextual Date / Week / Month / Year Stepper */}
        {timescale === 'day' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div ref={datePopoverRef} className="relative inline-flex items-center rounded-2xl apple-glass-pill p-0.5 shadow-2xs">
              <button
                type="button"
                disabled={!canGoPrevDay}
                onClick={() => onChangeDate(shiftYmdDays(selectedDate, -1))}
                aria-label="Previous day"
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsDateCalendarOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-bold text-slate-800 hover:text-slate-950 cursor-pointer tabular-nums whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatIndianDate(selectedDate, 'medium')}</span>
                {isTodaySelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Today (IST)" />
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              <button
                type="button"
                disabled={!canGoNextDay}
                onClick={() => onChangeDate(shiftYmdDays(selectedDate, 1))}
                aria-label="Next day"
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {isDateCalendarOpen && (
                <div className="absolute left-0 top-full mt-2 z-50">
                  <SolarDateCalendarPopover
                    isOpen={isDateCalendarOpen}
                    selectedYmd={selectedDate}
                    minDateYmd={commissioningYmd}
                    maxDateYmd={todayYmd}
                    todayYmd={todayYmd}
                    lastSyncedYmd={lastSyncedYmd}
                    monthAvailabilityMap={monthAvailabilityByYm}
                    onRequestMonthAvailability={onRequestMonthAvailability}
                    onSelectDate={(ymd) => {
                      onChangeDate(ymd);
                      setIsDateCalendarOpen(false);
                    }}
                    onClose={() => setIsDateCalendarOpen(false)}
                  />
                </div>
              )}
            </div>

            {/* Compare Day Picker (Day mode, Single Plant) */}
            {!isCombined && (
              <div ref={compareRef} className="relative">
                {compareDateYmd ? (
                  <div className="inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50/75 text-indigo-800 text-[11.5px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareCalendarOpen(false);
                        setIsCompareMenuOpen((o) => !o);
                      }}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 cursor-pointer hover:text-indigo-950 whitespace-nowrap"
                    >
                      <GitCompareArrows className="w-3.5 h-3.5 text-indigo-600" />
                      <span>vs {formatIndianDate(compareDateYmd, 'short')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeCompareDateYmd(null);
                        setIsCompareMenuOpen(false);
                        setIsCompareCalendarOpen(false);
                      }}
                      aria-label="Clear comparison day"
                      className="pr-2 pl-1 py-1.5 text-indigo-500 hover:text-indigo-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompareCalendarOpen(false);
                      setIsCompareMenuOpen((o) => !o);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/85 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer transition whitespace-nowrap"
                  >
                    <GitCompareArrows className="w-3.5 h-3.5 text-indigo-500" />
                    <span>+ Compare Another Day</span>
                  </button>
                )}

                {isCompareMenuOpen && !isCompareCalendarOpen && (
                  <div className="absolute right-0 sm:left-0 top-full mt-2 w-60 rounded-2xl bg-white border border-slate-200/90 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Overlay Historical Day
                    </div>
                    {yesterdayYmd >= commissioningYmd && yesterdayYmd !== selectedDate && (
                      <button
                        type="button"
                        onClick={() => {
                          onChangeCompareDateYmd(yesterdayYmd);
                          setIsCompareMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-50 text-[12px] font-semibold text-slate-700 flex items-center justify-between cursor-pointer"
                      >
                        <span>Yesterday</span>
                        <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                          {formatIndianDate(yesterdayYmd, 'short')}
                        </span>
                      </button>
                    )}
                    {bestDayYmd && bestDayYmd !== selectedDate && (
                      <button
                        type="button"
                        onClick={() => {
                          onChangeCompareDateYmd(bestDayYmd);
                          setIsCompareMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-50 text-[12px] font-semibold text-slate-700 flex items-center justify-between cursor-pointer"
                      >
                        <span>Best Day in Month</span>
                        <span className="text-[11px] font-medium text-emerald-600 tabular-nums">
                          {formatIndianDate(bestDayYmd, 'short')}
                        </span>
                      </button>
                    )}
                    {lastSyncedYmd && lastSyncedYmd !== selectedDate && lastSyncedYmd !== yesterdayYmd && (
                      <button
                        type="button"
                        onClick={() => {
                          onChangeCompareDateYmd(lastSyncedYmd);
                          setIsCompareMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-50 text-[12px] font-semibold text-slate-700 flex items-center justify-between cursor-pointer"
                      >
                        <span>Last Verified Day</span>
                        <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                          {formatIndianDate(lastSyncedYmd, 'short')}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareCalendarOpen(true);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-indigo-50/70 text-[12px] font-semibold text-indigo-700 flex items-center justify-between cursor-pointer border-t border-slate-100 mt-1 pt-2"
                    >
                      <span>Pick any date from calendar...</span>
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {isCompareCalendarOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50">
                    <SolarDateCalendarPopover
                      isOpen={isCompareCalendarOpen}
                      selectedYmd={compareDateYmd || yesterdayYmd}
                      minDateYmd={commissioningYmd}
                      maxDateYmd={todayYmd}
                      todayYmd={todayYmd}
                      lastSyncedYmd={lastSyncedYmd}
                      monthAvailabilityMap={monthAvailabilityByYm}
                      onRequestMonthAvailability={onRequestMonthAvailability}
                      onSelectDate={(ymd) => {
                        onChangeCompareDateYmd(ymd === selectedDate ? null : ymd);
                        setIsCompareCalendarOpen(false);
                        setIsCompareMenuOpen(false);
                      }}
                      onClose={() => {
                        setIsCompareCalendarOpen(false);
                        setIsCompareMenuOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {timescale === 'week' && (
          <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-50/70 p-0.5">
            <button
              type="button"
              disabled={!canGoPrevWeek}
              onClick={() => {
                const prev = shiftYmdDays(clampedWeekEnd, -7);
                onChangeWeekEndYmd(prev < effectiveMinWeekEnd ? effectiveMinWeekEnd : prev);
              }}
              aria-label="Previous 7 days"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 py-1 text-[12px] font-bold text-slate-800 tabular-nums whitespace-nowrap">
              {formatIndianDate(weekStartYmd, 'short')} – {formatIndianDate(clampedWeekEnd, 'short')}
            </span>
            <button
              type="button"
              disabled={!canGoNextWeek}
              onClick={() => {
                const next = shiftYmdDays(clampedWeekEnd, 7);
                onChangeWeekEndYmd(next > todayYmd ? todayYmd : next);
              }}
              aria-label="Next 7 days"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {timescale === 'month' && (
          <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-50/70 p-0.5">
            <button
              type="button"
              disabled={!canGoPrevMonth}
              onClick={() => {
                const prev = shiftYm(selectedMonth, -1);
                onChangeMonth(prev < minYm ? minYm : prev);
              }}
              aria-label="Previous month"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 text-[12px] font-bold text-slate-800 tabular-nums whitespace-nowrap">
              {formatIndianMonthYear(selectedMonth)}
            </span>
            <button
              type="button"
              disabled={!canGoNextMonth}
              onClick={() => {
                const next = shiftYm(selectedMonth, 1);
                onChangeMonth(next > maxYm ? maxYm : next);
              }}
              aria-label="Next month"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {timescale === 'year' && (
          <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-50/70 p-0.5">
            <button
              type="button"
              disabled={!canGoPrevYear}
              onClick={() => onChangeYear(Math.max(minYear, selectedYear - 1))}
              aria-label="Previous year"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3.5 py-1 text-[12px] font-bold text-slate-800 tabular-nums whitespace-nowrap">
              {selectedYear}
            </span>
            <button
              type="button"
              disabled={!canGoNextYear}
              onClick={() => onChangeYear(Math.min(maxYear, selectedYear + 1))}
              aria-label="Next year"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Desktop Chart <-> Log View Switch */}
        <div className="hidden sm:inline-flex items-center p-0.5 rounded-xl bg-slate-100/80 border border-slate-200/70">
          <button
            type="button"
            onClick={() => onChangeViewMode('chart')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold cursor-pointer transition ${
              viewMode === 'chart'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('table')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold cursor-pointer transition ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>

        {/* Single Quiet Export Popover */}
        <div ref={exportRef} className="relative">
          <button
            type="button"
            onClick={() => setIsExportOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/85 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 hover:text-slate-950 cursor-pointer transition whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isExportOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-slate-200/90 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  setIsExportOpen(false);
                  onDownloadCSV();
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2.5 text-[12px] font-semibold text-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <div>
                  <div>Download CSV (.csv)</div>
                  <div className="text-[10px] font-medium text-slate-400">
                    Structured {timescale} data rows
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExportOpen(false);
                  onOpenPrintAudit();
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2.5 text-[12px] font-semibold text-slate-700 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-sky-600" />
                <div>
                  <div>Print Period Audit</div>
                  <div className="text-[10px] font-medium text-slate-400">
                    Clean verified report sheet
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
