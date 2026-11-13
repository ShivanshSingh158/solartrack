import {
  formatMinutes12hUpper,
  lookupBridgedGapAtMinute,
  lookupRealTelemetryAtMinute,
  pointsToClampedSpline,
  type DailySolarPhysicsModel,
  type GapCurvePocket,
  type LiveNowcastResult,
  type ParsedDayTelemetry,
  type ReconstructedGapCurveResult,
} from '@solar-track/core';

export interface CalcCurveGeometry {
  calcLinePath: string;
  calcAreaPath: string;
  calcElapsedLinePath: string;
  calcRemainingLinePath: string;
  purePhysicsRemainingPath: string;
}

export interface RealSegmentPath {
  linePath: string;
  areaPath: string;
  startX: number;
  endX: number;
  lastX: number;
  lastY: number;
}

export interface BridgedSegmentPath {
  startMin: number;
  endMin: number;
  recoveredKwh: number;
  isMorningPreConnect: boolean;
  kind: Exclude<GapCurvePocket, 'GRID_OFF_ZERO'>;
  linePath: string;
  areaPath: string;
}

export interface ChartHoverDetails {
  minutes: number;
  timeText: string;
  x: number;
  calc: ReturnType<DailySolarPhysicsModel['lookupAtMinute']>;
  yCalc: number;
  real: { kw: number; cumKwh: number } | null;
  yReal: number | null;
  bridged: ReturnType<typeof lookupBridgedGapAtMinute>;
  yBridged: number | null;
  capturePct: number | null;
  deltaKw: number | null;
}

export function buildCalcCurveGeometry(params: {
  physicsModel: DailySolarPhysicsModel;
  timeToX: (min: number) => number;
  kwToY: (kw: number) => number;
  topY: number;
  baselineY: number;
  isDaytimeToday: boolean;
  isScrubbing: boolean;
  todayNowcast: LiveNowcastResult | null;
  activeNowMinutes: number;
  nowCalcKw: number;
}): CalcCurveGeometry {
  const {
    physicsModel,
    timeToX,
    kwToY,
    topY,
    baselineY,
    isDaytimeToday,
    isScrubbing,
    todayNowcast,
    activeNowMinutes,
    nowCalcKw,
  } = params;

  const coords = physicsModel.points.map((pt) => ({
    minutes: pt.minutes,
    x: timeToX(pt.minutes),
    y: kwToY(pt.kw),
  }));
  const fullLine = pointsToClampedSpline(coords, topY, baselineY);
  const fullArea =
    coords.length > 0
      ? `${fullLine} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY} L ${coords[0].x.toFixed(1)} ${baselineY} Z`
      : '';

  if (!isDaytimeToday) {
    return {
      calcLinePath: fullLine,
      calcAreaPath: fullArea,
      calcElapsedLinePath: fullLine,
      calcRemainingLinePath: '',
      purePhysicsRemainingPath: '',
    };
  }

  const useLiveNowcastTail = isDaytimeToday && !isScrubbing && Boolean(todayNowcast?.active);
  const nowCoord = { x: timeToX(activeNowMinutes), y: kwToY(nowCalcKw) };
  const elapsedPts = [...coords.filter((c) => c.minutes < activeNowMinutes), nowCoord];
  const baseRemainingPts = [nowCoord, ...coords.filter((c) => c.minutes > activeNowMinutes)];
  const remainingPts = useLiveNowcastTail
    ? todayNowcast!.buildBlendedRemainingPoints(activeNowMinutes).map((pt) => ({
        x: timeToX(pt.minutes),
        y: kwToY(pt.kw),
      }))
    : baseRemainingPts;

  return {
    calcLinePath: fullLine,
    calcAreaPath: fullArea,
    calcElapsedLinePath: pointsToClampedSpline(elapsedPts, topY, baselineY),
    calcRemainingLinePath: pointsToClampedSpline(remainingPts, topY, baselineY),
    purePhysicsRemainingPath: useLiveNowcastTail
      ? pointsToClampedSpline(baseRemainingPts, topY, baselineY)
      : '',
  };
}

export function buildRealSegmentPaths(params: {
  parsedReal: ParsedDayTelemetry;
  timeToX: (min: number) => number;
  kwToY: (kw: number) => number;
  topY: number;
  baselineY: number;
  isTodaySelected: boolean;
  isTodayConfirmed: boolean;
  displayLiveKw: number;
  isDaytimeToday: boolean;
  activeNowMinutes: number;
}): { realSegmentPaths: RealSegmentPath[]; singleDotPoints: Array<{ x: number; y: number }> } {
  const {
    parsedReal,
    timeToX,
    kwToY,
    topY,
    baselineY,
    isTodaySelected,
    isTodayConfirmed,
    displayLiveKw,
    isDaytimeToday,
    activeNowMinutes,
  } = params;

  const segPaths: RealSegmentPath[] = [];
  const singles: Array<{ x: number; y: number }> = [];

  for (const seg of parsedReal.segments) {
    if (seg.length === 1) {
      singles.push({ x: timeToX(seg[0].minutes), y: kwToY(seg[0].kw) });
      continue;
    }
    const coords = seg.map((pt) => ({ x: timeToX(pt.minutes), y: kwToY(pt.kw) }));
    const linePath = pointsToClampedSpline(coords, topY, baselineY);
    const firstX = coords[0].x;
    const last = coords[coords.length - 1];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${baselineY} L ${firstX.toFixed(1)} ${baselineY} Z`;
    segPaths.push({
      linePath,
      areaPath,
      startX: firstX,
      endX: last.x,
      lastX: last.x,
      lastY: last.y,
    });
  }

  if (
    isTodaySelected &&
    isTodayConfirmed &&
    displayLiveKw > 0.02 &&
    segPaths.length === 0 &&
    singles.length === 0 &&
    isDaytimeToday
  ) {
    singles.push({ x: timeToX(activeNowMinutes), y: kwToY(displayLiveKw) });
  }

  return { realSegmentPaths: segPaths, singleDotPoints: singles };
}

export function buildBridgedSegmentPaths(params: {
  gapRecovery: ReconstructedGapCurveResult;
  timeToX: (min: number) => number;
  kwToY: (kw: number) => number;
  topY: number;
  baselineY: number;
}): BridgedSegmentPath[] {
  const { gapRecovery, timeToX, kwToY, topY, baselineY } = params;
  if (!gapRecovery.hasBridgedGaps) return [];

  return gapRecovery.bridgedSegments
    .map((seg) => {
      if (seg.points.length < 2 || seg.kind === 'GRID_OFF_ZERO') return null;
      const coords = seg.points.map((p) => ({
        x: +timeToX(p.minutes).toFixed(1),
        y: +kwToY(p.kw).toFixed(1),
      }));
      const linePath = pointsToClampedSpline(coords, topY, baselineY, 0.24);
      const areaPath = linePath
        ? `${linePath} L ${coords[coords.length - 1].x},${baselineY} L ${coords[0].x},${baselineY} Z`
        : '';
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
    .filter((x): x is BridgedSegmentPath => x !== null && Boolean(x.linePath));
}

export function buildHoverInspectionDetails(params: {
  hoverMin: number | null;
  physicsModel: DailySolarPhysicsModel;
  parsedReal: ParsedDayTelemetry;
  gapRecovery: ReconstructedGapCurveResult;
  isTodaySelected: boolean;
  isTodayConfirmed: boolean;
  displayLiveKw: number;
  activeNowMinutes: number;
  isDaytimeToday: boolean;
  isScrubbing: boolean;
  todayNowcast: LiveNowcastResult | null;
  acCapKw: number;
  todayYield: number;
  timeToX: (min: number) => number;
  kwToY: (kw: number) => number;
}): ChartHoverDetails | null {
  const {
    hoverMin,
    physicsModel,
    parsedReal,
    gapRecovery,
    isTodaySelected,
    isTodayConfirmed,
    displayLiveKw,
    activeNowMinutes,
    isDaytimeToday,
    isScrubbing,
    todayNowcast,
    acCapKw,
    todayYield,
    timeToX,
    kwToY,
  } = params;

  if (hoverMin === null) return null;
  const m = Math.max(physicsModel.sunriseMin, Math.min(physicsModel.sunsetMin, hoverMin));
  const baseCalc = physicsModel.lookupAtMinute(m);
  const applyTailNowcast =
    isDaytimeToday && !isScrubbing && m > activeNowMinutes && Boolean(todayNowcast?.active);
  const calc = applyTailNowcast
    ? {
        ...baseCalc,
        kw: +Math.min(acCapKw, Math.max(0, baseCalc.kw * todayNowcast!.evaluateFactorAtMinute(m))).toFixed(2),
      }
    : baseCalc;

  const real = lookupRealTelemetryAtMinute(parsedReal, m);
  const livePointOverride =
    real === null &&
    isTodaySelected &&
    isTodayConfirmed &&
    displayLiveKw > 0.02 &&
    Math.abs(m - activeNowMinutes) <= 10
      ? { kw: displayLiveKw, cumKwh: todayYield }
      : null;
  const effectiveReal = real || livePointOverride;
  const bridged = effectiveReal === null ? lookupBridgedGapAtMinute(gapRecovery, m) : null;

  const x = timeToX(m);
  const yCalc = kwToY(calc.kw);
  const yReal = effectiveReal ? kwToY(effectiveReal.kw) : null;
  const yBridged = bridged ? kwToY(bridged.kw) : null;
  const capturePct =
    effectiveReal && calc.kw > 0.05 ? Math.round((effectiveReal.kw / calc.kw) * 100) : null;
  const deltaKw = effectiveReal ? +(effectiveReal.kw - calc.kw).toFixed(2) : null;

  return {
    minutes: m,
    timeText: formatMinutes12hUpper(m),
    x,
    calc,
    yCalc,
    real: effectiveReal,
    yReal,
    bridged,
    yBridged,
    capturePct,
    deltaKw,
  };
}
