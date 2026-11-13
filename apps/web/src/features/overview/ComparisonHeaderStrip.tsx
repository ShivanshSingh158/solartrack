import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  WifiOff,
} from 'lucide-react';
import {
  computeOnlineWindowOverlapMatch,
  formatDurationHm,
  formatIndianDate,
  formatMinutes12hUpper,
  shiftYmdDays,
  type DailySolarPhysicsModel,
  type DayComparisonCalendarDay,
  type LiveNowcastResult,
  type ParsedDayTelemetry,
  type ReconstructedGapCurveResult,
} from '@solar-track/core';
import { SolarDateCalendarPopover } from './SolarDateCalendarPopover';

export interface ComparisonHeaderStripProps {
  selectedYmd: string;
  todayYmd: string;
  yesterdayYmd: string;
  minDateYmd: string;
  maxDateYmd: string;
  loadingYmd: string | null;
  cityName: string;
  capSummaryLabel: string;
  dayCondition: string;
  radiationMjM2: number | null;
  physicsModel: DailySolarPhysicsModel;
  isTodaySelected: boolean;
  canStepPrev: boolean;
  canStepNext: boolean;
  onStepDate: (delta: number) => void;
  isCalendarOpen: boolean;
  onToggleCalendar: () => void;
  onCloseCalendar: () => void;
  inspectableLastSyncedYmd: string | null;
  monthAvailabilityMap: Record<string, DayComparisonCalendarDay[]>;
  onRequestMonthAvailability: (ym: string) => void;
  onSelectDate: (ymd: string) => void;
  onNavigateToPerformance: (ymd: string) => void;
  onOpenDailyReport?: (ymd: string) => void;
  hasConfirmedDayReal: boolean;
  isBeforeSunrise: boolean;
  isAfterSunset: boolean;
  isDaytimeToday: boolean;
  displayLiveKw: number;
  parsedReal: ParsedDayTelemetry;
  isTodayConfirmed: boolean;
  todayYield: number;
  todayBufferKwh: number;
  todayCurveSummary?: {
    realYieldFromCurveKwh: number;
    curveStartLabel: string | null;
    curveEndLabel: string | null;
    isPartialCurve: boolean;
  } | null;
  syncMeta?: {
    syncedAtIstLabel: string;
    trigger: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  } | null;
  resolvedTodayCloudKwh: number;
  gapRecovery: ReconstructedGapCurveResult;
  selectedDayEepromKwh: number;
  selectedReconciledTotalKwh: number;
  selectedBufferKwh: number;
  overlapStats: ReturnType<typeof computeOnlineWindowOverlapMatch>;
  selectedManualGridOff: boolean;
  activeNowMinutes: number;
  nowCalcAtPoint: { kw: number; cumKwh: number };
  isScrubbing: boolean;
  todayNowcast: LiveNowcastResult | null;
  minsUntilSunriseText: string;
  liveCapturePct: number | null;
  daylightElapsedPct: number;
  dailyMatchPct: number | null;
  remainingSunText: string;
}

export const ComparisonHeaderStrip: React.FC<ComparisonHeaderStripProps> = ({
  selectedYmd,
  todayYmd,
  yesterdayYmd,
  minDateYmd,
  maxDateYmd,
  loadingYmd,
  cityName,
  capSummaryLabel: _capSummaryLabel,
  dayCondition,
  radiationMjM2,
  physicsModel,
  isTodaySelected,
  canStepPrev,
  canStepNext,
  onStepDate,
  isCalendarOpen,
  onToggleCalendar,
  onCloseCalendar,
  inspectableLastSyncedYmd,
  monthAvailabilityMap,
  onRequestMonthAvailability,
  onSelectDate,
  onNavigateToPerformance,
  onOpenDailyReport,
  hasConfirmedDayReal,
  isBeforeSunrise,
  isAfterSunset,
  isDaytimeToday,
  displayLiveKw,
  parsedReal,
  isTodayConfirmed,
  todayYield,
  todayBufferKwh: _todayBufferKwh,
  todayCurveSummary: _todayCurveSummary,
  syncMeta: _syncMeta,
  resolvedTodayCloudKwh: _resolvedTodayCloudKwh,
  gapRecovery,
  selectedDayEepromKwh,
  selectedReconciledTotalKwh,
  selectedBufferKwh,
  overlapStats,
  selectedManualGridOff,
  activeNowMinutes,
  nowCalcAtPoint,
  isScrubbing,
  todayNowcast,
  minsUntilSunriseText,
  liveCapturePct,
  daylightElapsedPct,
  dailyMatchPct,
  remainingSunText,
}) => (
  <>
    <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-[16px] font-bold tracking-tight text-slate-900">
            {isTodaySelected ? "Today's Solar Generation Curve" : 'Daily Solar Generation Curve'}
          </h3>
          {loadingYmd === selectedYmd && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-700">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              Loading {formatIndianDate(selectedYmd, 'short')}…
            </span>
          )}
        </div>
        <p className="text-[12px] text-slate-400 font-medium mt-0.5 truncate">
          {cityName ? `${cityName} Rooftop · ` : ''}{dayCondition} · {physicsModel.sunriseText} sunrise – {physicsModel.sunsetText} sunset
        </p>
      </div>

      <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0 flex-wrap">
        <div className="relative flex items-center rounded-2xl apple-glass-pill p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => onStepDate(-1)}
            disabled={!canStepPrev}
            className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            aria-label="Previous date"
            title={canStepPrev ? formatIndianDate(shiftYmdDays(selectedYmd, -1)) : 'Commissioning date reached'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-calendar-trigger="true"
            onClick={onToggleCalendar}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl hover:bg-white/90 text-[12px] font-bold text-slate-800 transition cursor-pointer tabular-nums"
            title="Open Indian calendar picker (28 Oct 2026 – Today)"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatIndianDate(selectedYmd)}</span>
            {isTodaySelected && (
              <span className="text-[10.5px] font-semibold text-amber-700">· Today</span>
            )}
            {!isTodaySelected && selectedYmd === yesterdayYmd && (
              <span className="text-[10.5px] font-semibold text-slate-500">· Yesterday</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onStepDate(1)}
            disabled={!canStepNext}
            className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            aria-label="Next date"
            title={canStepNext ? formatIndianDate(shiftYmdDays(selectedYmd, 1)) : 'Already at Today'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <SolarDateCalendarPopover
            isOpen={isCalendarOpen}
            onClose={onCloseCalendar}
            selectedYmd={selectedYmd}
            todayYmd={todayYmd}
            minDateYmd={minDateYmd}
            maxDateYmd={maxDateYmd}
            lastSyncedYmd={inspectableLastSyncedYmd}
            monthAvailabilityMap={monthAvailabilityMap}
            onRequestMonthAvailability={onRequestMonthAvailability}
            onSelectDate={onSelectDate}
          />
        </div>

        <button
          type="button"
          onClick={() => (onOpenDailyReport ? onOpenDailyReport(selectedYmd) : undefined)}
          className="text-[11.5px] font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl apple-glass-pill transition cursor-pointer whitespace-nowrap shadow-2xs hover:shadow-xs"
          title="Open complete daily performance audit & dip analysis report"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>Daily Report</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToPerformance(selectedYmd)}
          className="text-[11.5px] font-semibold text-sky-800 hover:text-sky-950 inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl apple-glass-pill transition cursor-pointer whitespace-nowrap shadow-2xs hover:shadow-xs"
        >
          <span>5-Min History</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-sky-600" />
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/75 border-y border-slate-200/75 bg-slate-50/40">
      <div className="px-4 py-2.5 flex flex-col justify-between gap-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasConfirmedDayReal
                  ? 'bg-emerald-500'
                  : isTodaySelected && isBeforeSunrise
                  ? 'bg-slate-400'
                  : 'bg-amber-500'
              }`}
            />
            Your Solar Power
          </span>
          {hasConfirmedDayReal ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 tabular-nums whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              {isTodaySelected
                ? `${displayLiveKw.toFixed(2)} kW live`
                : parsedReal.peakKw > 0
                ? `Peak ${parsedReal.peakKw.toFixed(2)} kW`
                : 'Cloud confirmed'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 whitespace-nowrap shrink-0">
              <WifiOff className="w-3 h-3 shrink-0" />
              {isTodaySelected && isBeforeSunrise ? 'Standby' : 'Offline'}
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 min-w-0">
          {isTodaySelected ? (
            isTodayConfirmed ? (
              <div className="w-full min-w-0">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="text-[17px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                    {todayYield.toFixed(1)} kWh{' '}
                    <span className="text-[11px] font-medium text-slate-400">
                      till now
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                    {displayLiveKw > 0 ? `${displayLiveKw.toFixed(2)} kW live` : `Peak ${parsedReal.peakKw.toFixed(2)} kW`}
                  </span>
                </div>
              </div>
            ) : isBeforeSunrise ? (
              <>
                <span className="text-[15.5px] font-bold text-slate-700 whitespace-nowrap">Night Standby</span>
                <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap">
                  0.00 kW · Pre-dawn
                </span>
              </>
            ) : isAfterSunset ? (
              <>
                <span className="text-[15.5px] font-bold text-amber-900 whitespace-nowrap">Awaiting Sync</span>
                <span className="text-[10.5px] font-medium text-slate-500 whitespace-nowrap">Post-sunset</span>
              </>
            ) : (
              <>
                <span className="text-[15.5px] font-bold text-amber-900 whitespace-nowrap">Wi-Fi Offline</span>
                {inspectableLastSyncedYmd ? (
                  <button
                    type="button"
                    onClick={() => onSelectDate(inspectableLastSyncedYmd)}
                    className="text-[10.5px] font-semibold text-sky-700 hover:text-sky-800 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Inspect {formatIndianDate(inspectableLastSyncedYmd, 'short')} →
                  </button>
                ) : (
                  <span className="text-[10.5px] font-medium text-slate-500 whitespace-nowrap">Awaiting sync</span>
                )}
              </>
            )
          ) : selectedDayEepromKwh > 0.05 ? (
            <>
              <span className="text-[16px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                {selectedReconciledTotalKwh.toFixed(selectedBufferKwh > 0.05 ? 2 : 1)} kWh{' '}
                <span className="text-[11px] font-medium text-slate-500">
                  {selectedBufferKwh > 0.05 ? 'Cloud + Buf' : 'EDay'}
                </span>
              </span>
              <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                {selectedBufferKwh > 0.05
                  ? `Cloud ${selectedDayEepromKwh.toFixed(1)} + ${selectedBufferKwh.toFixed(1)} Buf`
                  : parsedReal.hasData
                  ? gapRecovery.hasBridgedGaps
                    ? `Online ${parsedReal.onlineIntegratedKwh.toFixed(1)} + ${gapRecovery.recoveredKwh.toFixed(1)} kWh`
                    : overlapStats.hasOutageGap
                    ? `Online: ${parsedReal.onlineIntegratedKwh.toFixed(1)} kWh`
                    : `Peak @ ${formatMinutes12hUpper(parsedReal.peakMinutes)}`
                  : selectedYmd === minDateYmd
                  ? 'Commissioning day'
                  : 'Daily archived'}
              </span>
            </>
          ) : parsedReal.hasData ? (
            <>
              <span className="text-[16px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                {parsedReal.onlineIntegratedKwh.toFixed(1)} kWh{' '}
                <span className="text-[11px] font-medium text-slate-500">online</span>
              </span>
              <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap">
                {parsedReal.allPoints.length} pts logged
              </span>
            </>
          ) : selectedManualGridOff || gapRecovery.suspectedGridCut ? (
            <>
              <span className="text-[15.5px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                0.0 kWh <span className="text-[11px] font-medium text-slate-500">Grid Off</span>
              </span>
              <span className="text-[10.5px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                Confirmed zero output
              </span>
            </>
          ) : selectedBufferKwh > 0.05 ? (
            <>
              <span className="text-[15.5px] font-extrabold text-amber-800 whitespace-nowrap tabular-nums">
                ~{selectedBufferKwh.toFixed(2)} kWh{' '}
                <span className="text-[11px] font-medium text-amber-700">Buffered</span>
              </span>
              <span className="text-[10.5px] font-semibold text-amber-700 whitespace-nowrap shrink-0">
                Wi-Fi offline past 00:00
              </span>
            </>
          ) : (
            <>
              <span className="text-[15.5px] font-bold text-amber-900 whitespace-nowrap">
                {selectedYmd === minDateYmd
                  ? 'Commissioned'
                  : selectedYmd < todayYmd || isTodayConfirmed
                  ? 'Unlogged in Cloud'
                  : 'Awaiting Sync'}
              </span>
              <span className="text-[10.5px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                {selectedYmd === minDateYmd
                  ? 'Installed late PM'
                  : selectedYmd < todayYmd || isTodayConfirmed
                  ? 'Wi-Fi offline past 00:00'
                  : 'Offline all day'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 flex flex-col justify-between gap-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 whitespace-nowrap">
            <span className="w-3 border-t-2 border-dashed border-sky-600 inline-block shrink-0" />
            Expected Sun Target
          </span>
          <span className="text-[10.5px] font-semibold text-sky-700 tabular-nums whitespace-nowrap shrink-0">
            {isTodaySelected
              ? isDaytimeToday
                ? `~${nowCalcAtPoint.kw.toFixed(2)} kW now`
                : `Peak ~${physicsModel.peakKw.toFixed(2)} kW`
              : `Peak ~${physicsModel.peakKw.toFixed(2)} kW`}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2 min-w-0">
          {isTodaySelected ? (
            isDaytimeToday ? (
              <>
                <span className="text-[16px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  ~{nowCalcAtPoint.cumKwh.toFixed(1)} kWh{' '}
                  <span className="text-[11px] font-medium text-slate-500">
                    till {formatMinutes12hUpper(activeNowMinutes)}
                  </span>
                </span>
                <span className="text-[10.5px] font-medium text-sky-700 tabular-nums whitespace-nowrap shrink-0">
                  ~{(isDaytimeToday && !isScrubbing && todayNowcast?.active
                    ? todayNowcast.blendedFullDayTargetKwh
                    : physicsModel.targetDailyModelKwh
                  ).toFixed(1)}{' '}
                  kWh day{isDaytimeToday && !isScrubbing && todayNowcast?.active ? ` · ×${todayNowcast.ratio.toFixed(2)}` : ''}
                </span>
              </>
            ) : (
              <>
                <span className="text-[16px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  ~{physicsModel.targetDailyModelKwh.toFixed(1)} kWh{' '}
                  <span className="text-[11px] font-medium text-slate-500">
                    {isBeforeSunrise ? 'expected' : 'full day'}
                  </span>
                </span>
                <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                  Noon {physicsModel.solarNoonText}
                </span>
              </>
            )
          ) : (
            <>
              <span className="text-[16px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                ~{physicsModel.targetDailyModelKwh.toFixed(1)} kWh{' '}
                <span className="text-[11px] font-medium text-slate-500">full day</span>
              </span>
              <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                {Number(radiationMjM2 ?? 15.2).toFixed(2)} MJ/m²
              </span>
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 flex flex-col justify-between gap-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
            <Activity className="w-3 h-3 text-slate-400 shrink-0" />
            Comparison
          </span>
          <span className="text-[10.5px] font-medium text-slate-400 tabular-nums whitespace-nowrap shrink-0">
            {formatIndianDate(selectedYmd, 'numeric')}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2 min-w-0">
          {isTodaySelected ? (
            isBeforeSunrise ? (
              <>
                <span className="text-[15.5px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  Starts in {minsUntilSunriseText}
                </span>
                <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                  Sunrise {physicsModel.sunriseText}
                </span>
              </>
            ) : isTodayConfirmed && liveCapturePct !== null ? (
              <>
                <span className="text-[16px] font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
                  {liveCapturePct}% Live Capture
                </span>
                <span className="text-[10.5px] font-semibold text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                  {displayLiveKw >= nowCalcAtPoint.kw ? '+' : ''}
                  {(displayLiveKw - nowCalcAtPoint.kw).toFixed(2)} kW · {daylightElapsedPct}%
                </span>
              </>
            ) : isAfterSunset ? (
              <>
                <span className="text-[15.5px] font-extrabold text-slate-900 whitespace-nowrap">
                  {dailyMatchPct !== null ? `${dailyMatchPct}% Match` : 'Daylight Done'}
                </span>
                <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                  Sunset {physicsModel.sunsetText}
                </span>
              </>
            ) : (
              <>
                <span className="text-[16px] font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  {daylightElapsedPct}% Daylight
                </span>
                <span className="text-[10.5px] font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                  {remainingSunText} left
                </span>
              </>
            )
          ) : dailyMatchPct !== null ? (
            <>
              <span
                className={`text-[16px] font-extrabold tabular-nums whitespace-nowrap ${
                  dailyMatchPct >= 85
                    ? 'text-emerald-700'
                    : dailyMatchPct >= 50
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {dailyMatchPct}% Match
              </span>
              <span className="text-[10.5px] font-medium text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                {overlapStats.overlapMatchPct !== null
                  ? `${overlapStats.overlapMatchPct}% online${
                      overlapStats.hasOutageGap
                        ? ` · ${formatDurationHm(overlapStats.totalGapMinutes)} gap`
                        : ''
                    }`
                  : `${selectedDayEepromKwh >= physicsModel.targetDailyModelKwh ? '+' : ''}${(
                      selectedDayEepromKwh - physicsModel.targetDailyModelKwh
                    ).toFixed(1)} kWh`}
              </span>
            </>
          ) : (
            <>
              <span className="text-[15.5px] font-bold text-slate-600 whitespace-nowrap">
                {selectedYmd === minDateYmd ? 'Initial Day' : 'Offline Day'}
              </span>
              <span className="text-[10.5px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                {selectedYmd === minDateYmd ? 'Installed late PM' : 'Model benchmark'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  </>
);
