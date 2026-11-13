import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TelemetryTable } from '../../shared/ui/TelemetryTable';
import { buildDayHoverInfo, buildDayStageGeometry } from './performanceStageGeometry';
import { PerformanceDayStageSvg } from './PerformanceDayStageSvg';
import { PerformanceBulletBarsSvg } from './PerformanceBulletBarsSvg';
import { PerformanceYearBarsSvg } from './PerformanceYearBarsSvg';
import { PerformanceStageTooltips } from './PerformanceStageTooltips';
import {
  PerformanceStageLayerToggles,
  PerformanceStageLegend,
} from './PerformanceStageLegend';
import type {
  PerformanceBulletBarItem,
  PerformanceChartStageProps,
  PerformanceYearMonthItem,
  StagePlotLayout,
} from './performanceStageTypes';

export type { PerformanceBulletBarItem, PerformanceYearMonthItem };

/**
 * Interactive Performance Chart & Log Table Stage spanning Day, Week, Month, and Year timescales.
 */
export const PerformanceChartStage: React.FC<PerformanceChartStageProps> = ({
  timescale,
  periodKey,
  viewMode,
  isLoading,
  isCombined,
  capacityKwp,
  chartTitle,
  chartSubtitle,
  showModelOverlay,
  onToggleModelOverlay,
  showPvDcOverlay,
  onTogglePvDcOverlay,
  showPriorWeekOverlay,
  onTogglePriorWeekOverlay,
  showClearSkyTicks,
  onToggleClearSkyTicks,
  showCaptureLineOverlay,
  onToggleCaptureLineOverlay,
  selectedDate,
  todayYmd,
  nowMinutesIst,
  physicsModel,
  primaryParsed,
  primaryGapCurve,
  pvDcParsed,
  compareDateYmd,
  compareParsed,
  dayRadiationMjM2,
  hasLiveBeacon,
  bulletBars,
  monthAvgKwh,
  hoveredBarYmd,
  onHoverBarYmd,
  onSelectDay,
  yearMonths,
  onSelectMonth,
  tableRows,
}) => {
  const uid = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgW, setSvgW] = useState<number>(920);
  const fullAnimKey = `${timescale}:${periodKey}`;
  const animGeneration = fullAnimKey.replace(/[^a-zA-Z0-9_-]/g, '_');

  const [hoverState, setHoverState] = useState<{
    key: string;
    min: number | null;
    yearIdx: number | null;
    monthYmd: string | null;
  }>({ key: fullAnimKey, min: null, yearIdx: null, monthYmd: null });

  const hoverMin = hoverState.key === fullAnimKey ? hoverState.min : null;
  const hoveredYearIdx = hoverState.key === fullAnimKey ? hoverState.yearIdx : null;
  const hoveredMonthBarYmd = hoverState.key === fullAnimKey ? hoverState.monthYmd : null;
  const setHoverMin = (min: number | null) =>
    setHoverState({ key: fullAnimKey, min, yearIdx: null, monthYmd: null });
  const setHoveredYearIdx = (yearIdx: number | null) =>
    setHoverState({ key: fullAnimKey, min: null, yearIdx, monthYmd: null });
  const setHoveredMonthBarYmd = (monthYmd: string | null) =>
    setHoverState({ key: fullAnimKey, min: null, yearIdx: null, monthYmd });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.max(300, Math.round(el.getBoundingClientRect().width));
      setSvgW(next);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [viewMode]);

  const layout = useMemo<StagePlotLayout>(() => {
    const isCompact = svgW < 560;
    const svgH = timescale === 'week' ? (isCompact ? 235 : 265) : isCompact ? 260 : 300;
    const plotLeft = isCompact ? 40 : 50;
    const plotRight = svgW - (isCompact ? 16 : timescale === 'month' && showCaptureLineOverlay ? 38 : 20);
    const plotW = Math.max(120, plotRight - plotLeft);
    const topY = 20;
    const baselineY = svgH - 30;
    const plotH = Math.max(80, baselineY - topY);
    return { svgW, svgH, isCompact, plotLeft, plotRight, plotW, topY, baselineY, plotH };
  }, [svgW, timescale, showCaptureLineOverlay]);

  const dayGeometry = useMemo(
    () =>
      buildDayStageGeometry({
        layout,
        capacityKwp,
        physicsModel,
        primaryParsed,
        primaryGapCurve,
        showPvDcOverlay,
        pvDcParsed,
        compareDateYmd,
        compareParsed,
      }),
    [
      layout,
      capacityKwp,
      physicsModel,
      primaryParsed,
      primaryGapCurve,
      showPvDcOverlay,
      pvDcParsed,
      compareDateYmd,
      compareParsed,
    ],
  );

  const dayHoverInfo = useMemo(() => {
    if (timescale !== 'day' || hoverMin === null) return null;
    return buildDayHoverInfo({
      hoverMin,
      geometry: dayGeometry,
      physicsModel,
      primaryParsed,
      primaryGapCurve,
      compareDateYmd,
      compareParsed,
      showPvDcOverlay,
      pvDcParsed,
    });
  }, [
    timescale,
    hoverMin,
    dayGeometry,
    physicsModel,
    primaryParsed,
    primaryGapCurve,
    compareDateYmd,
    compareParsed,
    showPvDcOverlay,
    pvDcParsed,
  ]);

  const activeHoveredBarYmd = timescale === 'week' ? hoveredBarYmd : hoveredMonthBarYmd;

  const yMaxKwh = useMemo(() => {
    let mx = 0;
    for (const b of bulletBars) {
      const reconciled = b.realKwh + Math.max(0, b.bufferKwh || 0);
      mx = Math.max(
        mx,
        reconciled,
        b.modelKwh,
        b.todayTargetTotalKwh || 0,
        showClearSkyTicks ? b.idealClearSkyKwh : 0,
        b.prevPeriodKwh || 0,
      );
    }
    if (monthAvgKwh) mx = Math.max(mx, monthAvgKwh);
    const rawMax = Math.max(mx * 1.14, 12);
    return Math.ceil(rawMax / 2) * 2;
  }, [bulletBars, showClearSkyTicks, monthAvgKwh]);

  const kwhTicks = useMemo(
    () => [0, +(yMaxKwh * 0.25).toFixed(1), +(yMaxKwh * 0.5).toFixed(1), +(yMaxKwh * 0.75).toFixed(1), yMaxKwh],
    [yMaxKwh],
  );

  const yMaxYearKwh = useMemo(() => {
    const mx = yearMonths.reduce((acc, m) => Math.max(acc, m.realKwh), 0);
    const base = Math.max(mx * 1.15, 100);
    const step = base > 400 ? 100 : base > 150 ? 50 : 25;
    return Math.ceil(base / step) * step;
  }, [yearMonths]);

  const yearTicks = useMemo(
    () => [0, Math.round(yMaxYearKwh * 0.25), Math.round(yMaxYearKwh * 0.5), Math.round(yMaxYearKwh * 0.75), yMaxYearKwh],
    [yMaxYearKwh],
  );

  const handleDayPointerMove = (clientX: number) => {
    const svgEl = svgRef.current;
    if (!svgEl || timescale !== 'day') return;
    const rect = svgEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / Math.max(1, rect.width)) * layout.svgW;
    const clampedX = Math.max(layout.plotLeft, Math.min(layout.plotRight, relX));
    const frac = (clampedX - layout.plotLeft) / layout.plotW;
    setHoverMin(Math.round(dayGeometry.dayStartMin + frac * dayGeometry.daySpanMin));
  };

  const showNowRule =
    timescale === 'day' &&
    selectedDate === todayYmd &&
    nowMinutesIst >= dayGeometry.dayStartMin &&
    nowMinutesIst <= dayGeometry.dayEndMin;
  const nowX = dayGeometry.timeToX(nowMinutesIst);

  return (
    <div className="px-4 sm:px-6 pt-4 pb-5">
      <style>{`
        @keyframes perfClipReveal {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes perfBarRise {
          from { transform: scaleY(0); opacity: 0.35; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold text-slate-900 truncate">{chartTitle}</h2>
          <p className="text-[11px] font-medium text-slate-500 truncate">{chartSubtitle}</p>
        </div>
        <PerformanceStageLayerToggles
          timescale={timescale}
          viewMode={viewMode}
          isCombined={isCombined}
          showModelOverlay={showModelOverlay}
          onToggleModelOverlay={onToggleModelOverlay}
          showPvDcOverlay={showPvDcOverlay}
          onTogglePvDcOverlay={onTogglePvDcOverlay}
          showPriorWeekOverlay={showPriorWeekOverlay}
          onTogglePriorWeekOverlay={onTogglePriorWeekOverlay}
          showClearSkyTicks={showClearSkyTicks}
          onToggleClearSkyTicks={onToggleClearSkyTicks}
          showCaptureLineOverlay={showCaptureLineOverlay}
          onToggleCaptureLineOverlay={onToggleCaptureLineOverlay}
        />
      </div>

      {viewMode === 'table' ? (
        <TelemetryTable
          rows={tableRows}
          timescale={timescale}
          onSelectDate={onSelectDay}
          onSelectMonth={onSelectMonth}
        />
      ) : (
        <div ref={containerRef} className="relative w-full select-none">
          {isLoading && (
            <div className="absolute right-2 top-1 z-20 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-[10.5px] font-semibold text-slate-500 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              Syncing telemetry...
            </div>
          )}

          <svg
            ref={svgRef}
            data-perf-stage-svg="true"
            width={layout.svgW}
            height={layout.svgH}
            viewBox={`0 0 ${layout.svgW} ${layout.svgH}`}
            className="block w-full overflow-visible touch-pan-y"
            onMouseMove={(e) => {
              if (timescale === 'day') handleDayPointerMove(e.clientX);
            }}
            onPointerMove={(e) => {
              if (timescale === 'day') handleDayPointerMove(e.clientX);
            }}
            onTouchMove={(e) => {
              if (timescale === 'day' && e.touches[0]) {
                handleDayPointerMove(e.touches[0].clientX);
              }
            }}
            onMouseLeave={() => {
              setHoverMin(null);
              if (timescale === 'week') onHoverBarYmd(null);
              if (timescale === 'month') setHoveredMonthBarYmd(null);
              if (timescale === 'year') setHoveredYearIdx(null);
            }}
          >
            <defs>
              <linearGradient id={`perfEmArea-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id={`perfSkyArea-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284C7" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
              </linearGradient>
              <pattern
                id={`dcAcGapHatch-${uid}`}
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill="#F59E0B" fillOpacity="0.18" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#D97706" strokeWidth="1.5" strokeOpacity="0.55" />
              </pattern>
              <pattern
                id={`pendingTargetHatch-${uid}`}
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill="#0EA5E9" fillOpacity="0.12" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#0284C7" strokeWidth="1.5" strokeOpacity="0.35" />
              </pattern>
              <pattern
                id={`gapOutageHatch-${uid}`}
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill="#E2E8F0" fillOpacity="0.55" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#94A3B8" strokeWidth="1.2" strokeOpacity="0.55" />
              </pattern>
              <pattern
                id={`bridgedGapHatch-${uid}`}
                width="7"
                height="7"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="7" height="7" fill="#FEF3C7" fillOpacity="0.35" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#F59E0B" strokeWidth="1.2" strokeOpacity="0.45" />
              </pattern>
              <clipPath id={`perfDayClip-${uid}-${animGeneration}`}>
                <rect
                  x={layout.plotLeft - 2}
                  y={0}
                  width={layout.plotW + 8}
                  height={layout.svgH}
                  style={{
                    transformOrigin: `${layout.plotLeft}px 0px`,
                    animation: 'perfClipReveal 750ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  }}
                />
              </clipPath>
            </defs>

            {timescale === 'day' && (
              <PerformanceDayStageSvg
                uid={uid}
                animGeneration={animGeneration}
                layout={layout}
                geometry={dayGeometry}
                primaryParsed={primaryParsed}
                primaryGapCurve={primaryGapCurve}
                showModelOverlay={showModelOverlay}
                showNowRule={showNowRule}
                nowX={nowX}
                hasLiveBeacon={hasLiveBeacon}
                dayHoverInfo={dayHoverInfo}
              />
            )}

            {(timescale === 'week' || timescale === 'month') && (
              <PerformanceBulletBarsSvg
                uid={uid}
                animGeneration={animGeneration}
                timescale={timescale}
                layout={layout}
                bulletBars={bulletBars}
                yMaxKwh={yMaxKwh}
                kwhTicks={kwhTicks}
                monthAvgKwh={monthAvgKwh}
                showClearSkyTicks={showClearSkyTicks}
                showPriorWeekOverlay={showPriorWeekOverlay}
                showCaptureLineOverlay={showCaptureLineOverlay}
                activeHoveredBarYmd={activeHoveredBarYmd}
                onHoverBarYmd={(ymd) => {
                  if (timescale === 'week') onHoverBarYmd(ymd);
                  else setHoveredMonthBarYmd(ymd);
                }}
                onSelectDay={onSelectDay}
              />
            )}

            {timescale === 'year' && (
              <PerformanceYearBarsSvg
                animGeneration={animGeneration}
                layout={layout}
                yearMonths={yearMonths}
                yMaxYearKwh={yMaxYearKwh}
                yearTicks={yearTicks}
                hoveredYearIdx={hoveredYearIdx}
                onHoverYearIdx={setHoveredYearIdx}
                onSelectMonth={onSelectMonth}
              />
            )}
          </svg>

          <PerformanceStageTooltips
            timescale={timescale}
            layout={layout}
            selectedDate={selectedDate}
            compareDateYmd={compareDateYmd}
            showModelOverlay={showModelOverlay}
            showPriorWeekOverlay={showPriorWeekOverlay}
            dayHoverInfo={dayHoverInfo}
            bulletBars={bulletBars}
            activeHoveredBarYmd={activeHoveredBarYmd}
            yearMonths={yearMonths}
            hoveredYearIdx={hoveredYearIdx}
          />

          <PerformanceStageLegend
            timescale={timescale}
            isCombined={isCombined}
            showModelOverlay={showModelOverlay}
            showPvDcOverlay={showPvDcOverlay}
            compareDateYmd={compareDateYmd}
            primaryGapCurve={primaryGapCurve}
            dayRadiationMjM2={dayRadiationMjM2}
            physicsModel={physicsModel}
          />
        </div>
      )}
    </div>
  );
};
