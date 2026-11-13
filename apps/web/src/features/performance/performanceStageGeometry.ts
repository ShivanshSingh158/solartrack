import {
  buildSolarXAxisTicks,
  computeCompareDeltaAtMinute,
  formatMinutes12hUpper,
  lookupBridgedGapAtMinute,
  lookupRealTelemetryAtMinute,
  pointsToClampedSpline,
  type DailySolarPhysicsModel,
  type ParsedDayTelemetry,
  type ReconstructedGapCurveResult,
} from '@solar-track/core';
import type {
  BridgedGapSplineSegment,
  DayHoverInfo,
  DayStageGeometryResult,
  RealSplineSegment,
  StagePlotLayout,
} from './performanceStageTypes';

interface BuildDayGeometryParams {
  layout: StagePlotLayout;
  capacityKwp: number;
  physicsModel: DailySolarPhysicsModel;
  primaryParsed: ParsedDayTelemetry;
  primaryGapCurve?: ReconstructedGapCurveResult | null;
  showPvDcOverlay: boolean;
  pvDcParsed: ParsedDayTelemetry | null;
  compareDateYmd: string | null;
  compareParsed: ParsedDayTelemetry | null;
}

/**
 * Pure SVG coordinate, spline, bridged-gap, DC-AC band, and compare-day geometry builder for Day mode.
 */
export function buildDayStageGeometry({
  layout,
  capacityKwp,
  physicsModel,
  primaryParsed,
  primaryGapCurve,
  showPvDcOverlay,
  pvDcParsed,
  compareDateYmd,
  compareParsed,
}: BuildDayGeometryParams): DayStageGeometryResult {
  const { plotLeft, plotW, topY, baselineY, plotH, isCompact } = layout;
  const dayStartMin = physicsModel.sunriseMin;
  const dayEndMin = Math.max(dayStartMin + 60, physicsModel.sunsetMin);
  const daySpanMin = dayEndMin - dayStartMin;

  const timeToX = (m: number) =>
    plotLeft + ((Math.max(dayStartMin, Math.min(dayEndMin, m)) - dayStartMin) / daySpanMin) * plotW;

  const peakModel = physicsModel.peakKw || 0;
  const peakReal = primaryParsed.peakKw || 0;
  const peakPv = pvDcParsed?.peakKw || 0;
  const peakCmp = compareParsed?.peakKw || 0;
  const rawMax = Math.max(capacityKwp * 0.9, peakModel, peakReal, peakPv, peakCmp, 1.5);
  const step = rawMax > 4 ? 1 : 0.5;
  const yMaxKw = Math.ceil((rawMax * 1.12) / step) * step;

  const kwToY = (kw: number) => baselineY - (Math.max(0, Math.min(yMaxKw, kw)) / yMaxKw) * plotH;

  const yTicksKw: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicksKw.push(+(yMaxKw * (i / 4)).toFixed(2));
  }

  const xTicksDay = buildSolarXAxisTicks(dayStartMin, dayEndMin, isCompact);

  const calcPts = physicsModel.points.map((p) => ({
    x: +timeToX(p.minutes).toFixed(1),
    y: +kwToY(p.kw).toFixed(1),
  }));
  const calcLinePath = pointsToClampedSpline(calcPts, topY, baselineY, 0.22);
  const calcAreaPath =
    calcPts.length > 0 && calcLinePath
      ? `${calcLinePath} L ${calcPts[calcPts.length - 1].x},${baselineY} L ${calcPts[0].x},${baselineY} Z`
      : '';

  const realSegments: RealSplineSegment[] = primaryParsed.segments.map((seg) => {
    const coords = seg.map((p) => ({
      x: +timeToX(p.minutes).toFixed(1),
      y: +kwToY(p.kw).toFixed(1),
    }));
    const linePath = pointsToClampedSpline(coords, topY, baselineY, 0.24);
    const areaPath =
      coords.length >= 2 && linePath
        ? `${linePath} L ${coords[coords.length - 1].x},${baselineY} L ${coords[0].x},${baselineY} Z`
        : '';
    return {
      coords,
      linePath,
      areaPath,
      lastX: coords[coords.length - 1]?.x ?? plotLeft,
      lastY: coords[coords.length - 1]?.y ?? baselineY,
    };
  });

  const bridgedGapSegments: BridgedGapSplineSegment[] = primaryGapCurve?.hasBridgedGaps
    ? primaryGapCurve.bridgedSegments
        .map((seg) => {
          if (seg.points.length < 2 || seg.kind === 'GRID_OFF_ZERO') return null;
          const coords = seg.points.map((p) => ({
            x: +timeToX(p.minutes).toFixed(1),
            y: +kwToY(p.kw).toFixed(1),
          }));
          const linePath = pointsToClampedSpline(coords, topY, baselineY, 0.24);
          if (!linePath) return null;
          const areaPath = `${linePath} L ${coords[coords.length - 1].x},${baselineY} L ${coords[0].x},${baselineY} Z`;
          return {
            startMin: seg.startMin,
            endMin: seg.endMin,
            recoveredKwh: seg.recoveredKwh,
            isMorningPreConnect: seg.isMorningPreConnect,
            kind: seg.kind,
            linePath,
            areaPath,
          };
        })
        .filter((x): x is BridgedGapSplineSegment => x !== null)
    : [];

  const pvDcPaths: string[] = [];
  const dcAcGapBandPaths: string[] = [];
  if (showPvDcOverlay && pvDcParsed && pvDcParsed.hasData) {
    for (const seg of pvDcParsed.segments) {
      if (seg.length < 2) continue;
      const dcCoords = seg.map((p) => ({
        x: +timeToX(p.minutes).toFixed(1),
        y: +kwToY(p.kw).toFixed(1),
      }));
      const line = pointsToClampedSpline(dcCoords, topY, baselineY, 0.24);
      if (line) pvDcPaths.push(line);

      const upperPts: Array<{ x: number; y: number }> = [];
      const lowerPts: Array<{ x: number; y: number }> = [];
      for (const p of seg) {
        const acHit = lookupRealTelemetryAtMinute(primaryParsed, p.minutes);
        if (!acHit) continue;
        const x = +timeToX(p.minutes).toFixed(1);
        const dcVal = Math.max(p.kw, acHit.kw);
        const acVal = Math.min(acHit.kw, p.kw);
        upperPts.push({ x, y: +kwToY(dcVal).toFixed(1) });
        lowerPts.push({ x, y: +kwToY(acVal).toFixed(1) });
      }
      if (upperPts.length >= 2) {
        const fwd = upperPts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`).join(' ');
        const rev = [...lowerPts]
          .reverse()
          .map((pt) => `L ${pt.x},${pt.y}`)
          .join(' ');
        dcAcGapBandPaths.push(`${fwd} ${rev} Z`);
      }
    }
  }

  const comparePaths =
    compareDateYmd && compareParsed && compareParsed.hasData
      ? compareParsed.segments
          .map((seg) => {
            const coords = seg.map((p) => ({
              x: +timeToX(p.minutes).toFixed(1),
              y: +kwToY(p.kw).toFixed(1),
            }));
            return pointsToClampedSpline(coords, topY, baselineY, 0.24);
          })
          .filter(Boolean)
      : [];

  return {
    dayStartMin,
    dayEndMin,
    daySpanMin,
    timeToX,
    kwToY,
    yTicksKw,
    xTicksDay,
    calcLinePath,
    calcAreaPath,
    realSegments,
    bridgedGapSegments,
    pvDcPaths,
    dcAcGapBandPaths,
    comparePaths,
  };
}

/**
 * Resolves crosshair hover readout metrics at a given IST minute on the Day chart.
 */
export function buildDayHoverInfo(params: {
  hoverMin: number | null;
  geometry: DayStageGeometryResult;
  physicsModel: DailySolarPhysicsModel;
  primaryParsed: ParsedDayTelemetry;
  primaryGapCurve?: ReconstructedGapCurveResult | null;
  compareDateYmd: string | null;
  compareParsed: ParsedDayTelemetry | null;
  showPvDcOverlay: boolean;
  pvDcParsed: ParsedDayTelemetry | null;
}): DayHoverInfo | null {
  const {
    hoverMin,
    geometry,
    physicsModel,
    primaryParsed,
    primaryGapCurve,
    compareDateYmd,
    compareParsed,
    showPvDcOverlay,
    pvDcParsed,
  } = params;
  if (hoverMin === null) return null;

  const { timeToX, kwToY } = geometry;
  const x = timeToX(hoverMin);
  const modelAtMin = physicsModel.lookupAtMinute(hoverMin);
  const delta = computeCompareDeltaAtMinute(
    primaryParsed.hasData ? primaryParsed : null,
    compareDateYmd && compareParsed?.hasData ? compareParsed : null,
    hoverMin,
  );
  const dcAtMin =
    showPvDcOverlay && pvDcParsed?.hasData ? lookupRealTelemetryAtMinute(pvDcParsed, hoverMin) : null;
  const instantCapturePct =
    delta.realKw !== null && modelAtMin.kw > 0.08
      ? Math.round((delta.realKw / modelAtMin.kw) * 100)
      : null;
  const instantEtaPct =
    delta.realKw !== null && dcAtMin && dcAtMin.kw >= 0.08 && delta.realKw > 0.01
      ? +Math.min(98.5, Math.max(45.0, (delta.realKw / dcAtMin.kw) * 100)).toFixed(1)
      : null;
  const bridgedAtMin =
    delta.realKw === null ? lookupBridgedGapAtMinute(primaryGapCurve, hoverMin) : null;

  return {
    minuteOfDay: hoverMin,
    timeLabel: formatMinutes12hUpper(hoverMin),
    x,
    modelKw: modelAtMin.kw,
    modelCumKwh: modelAtMin.cumKwh,
    modelY: kwToY(modelAtMin.kw),
    realKw: delta.realKw,
    realCumKwh: delta.realCumKwh,
    realY: delta.realKw !== null ? kwToY(delta.realKw) : null,
    bridgedKw: bridgedAtMin ? bridgedAtMin.kw : null,
    bridgedY: bridgedAtMin ? kwToY(bridgedAtMin.kw) : null,
    bridgedSegmentKwh: bridgedAtMin ? bridgedAtMin.segmentRecoveredKwh : null,
    compareKw: delta.compareKw,
    compareCumKwh: delta.compareCumKwh,
    compareY: delta.compareKw !== null ? kwToY(delta.compareKw) : null,
    diffKw: delta.diffKw,
    diffKwPct: delta.diffKwPct,
    diffCumKwh: delta.diffCumKwh,
    diffCumPct: delta.diffCumPct,
    dcKw: dcAtMin ? dcAtMin.kw : null,
    dcY: dcAtMin ? kwToY(dcAtMin.kw) : null,
    instantCapturePct,
    instantEtaPct,
  };
}
