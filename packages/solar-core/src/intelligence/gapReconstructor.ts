import type {
  BridgedGapPoint,
  BridgedGapSegment,
  GapCurvePocket,
  IntervalGapState,
  ParsedDayTelemetry,
  ReconstructedGapCurveResult,
} from '../types/gap.ts';
import type { DailySolarPhysicsModel } from '../types/physics.ts';
import { classifyDayGapArchitecture } from './gapClassifier.ts';

export type { BridgedGapPoint, BridgedGapSegment, GapCurvePocket, ReconstructedGapCurveResult };

/**
 * Two-Pass Smooth Endpoint-Blended & Area-Preserving Gap Curve Builder.
 * Renders both teal `EEPROM_CONFIRMED` segments and amber `BUFFER_ESTIMATED` segments
 * while touching real endpoints smoothly.
 */
export function reconstructConfirmedGapCurve(params: {
  parsed: ParsedDayTelemetry;
  physicsModel: Pick<DailySolarPhysicsModel, 'sunriseMin' | 'sunsetMin' | 'points' | 'lookupAtMinute'> | null;
  eepromKwh: number;
  acCapacityKw?: number;
  surfaceLossPct?: number;
  ymd?: string;
  todayYmd?: string;
  commissioningYmd?: string;
  nowMinutesIst?: number;
  isManualGridOff?: boolean;
  isWifiOfflineFullDay?: boolean;
  targetBufferOverrideKwh?: number | null;
  gapMode?: 'auto' | 'eeprom_only' | 'include_buffer';
}): ReconstructedGapCurveResult {
  const {
    parsed,
    physicsModel,
    eepromKwh,
    acCapacityKw = 3.0,
    surfaceLossPct = 0,
    ymd = '2026-11-11',
    todayYmd = '2026-11-11',
    commissioningYmd = '2026-10-28',
    nowMinutesIst = 1440,
    isManualGridOff = false,
    isWifiOfflineFullDay = false,
    targetBufferOverrideKwh = null,
    gapMode = 'include_buffer',
  } = params;

  const empty: ReconstructedGapCurveResult = {
    hasBridgedGaps: false,
    recoveredKwh: 0,
    eepromRecoveredKwh: 0,
    bufferedKwh: 0,
    deficitKwh: 0,
    suspectedGridCut: false,
    bridgedSegments: [],
  };
  if (!physicsModel || physicsModel.points.length < 2) {
    return empty;
  }

  const classification = classifyDayGapArchitecture({
    parsed,
    physicsModel,
    eepromKwh,
    surfaceLossPct,
    ymd,
    todayYmd,
    commissioningYmd,
    nowMinutesIst,
    isManualGridOff,
    isWifiOfflineFullDay,
  });

  const activeHoles = classification.holes.filter((h) => {
    if (h.kind === 'GRID_OFF_ZERO' || h.allocatedKwh < 0.15) return false;
    if (gapMode === 'eeprom_only' && h.kind !== 'EEPROM_CONFIRMED') return false;
    return true;
  });

  if (activeHoles.length === 0) {
    return { ...empty, suspectedGridCut: classification.suspectedGridCut };
  }

  const bufferHoles = activeHoles.filter((h) => h.kind === 'BUFFER_ESTIMATED');
  const rawBufSum = bufferHoles.reduce((s, h) => s + h.allocatedKwh, 0);
  const bufScale =
    targetBufferOverrideKwh !== null &&
    Number.isFinite(targetBufferOverrideKwh) &&
    targetBufferOverrideKwh > 0 &&
    rawBufSum > 0.15
      ? Math.max(0.6, Math.min(1.4, targetBufferOverrideKwh / rawBufSum))
      : 1.0;

  const safeAcCap = Math.max(0.5, acCapacityKw);
  const TAU_EDGE_MIN = 20;

  const integrate = (vals: Array<{ minutes: number; kw: number }>) => {
    let kwh = 0;
    for (let i = 1; i < vals.length; i++) {
      kwh += ((vals[i - 1].kw + vals[i].kw) / 2) * ((vals[i].minutes - vals[i - 1].minutes) / 60);
    }
    return kwh;
  };

  const bridgedSegments: BridgedGapSegment[] = [];
  let eepromRecoveredKwh = 0;
  let bufferedKwh = 0;

  for (const hole of activeHoles) {
    const targetSegKwh = +(hole.kind === 'BUFFER_ESTIMATED' ? hole.allocatedKwh * bufScale : hole.allocatedKwh).toFixed(2);
    if (targetSegKwh < 0.15 || hole.endMin <= hole.startMin + 5) continue;

    const span = hole.endMin - hole.startMin;
    const steps = Math.max(3, Math.round(span / 5));
    const samples: Array<{ minutes: number; baseKw: number; wEdge: number; kw: number; isEndpoint: boolean }> = [];

    const modStart = Math.max(0, physicsModel.lookupAtMinute(hole.startMin).kw) * hole.kGapApplied;
    const modEnd = Math.max(0, physicsModel.lookupAtMinute(hole.endMin).kw) * hole.kGapApplied;
    const dStart = hole.hasLeftEdge ? hole.startKw - modStart : 0;
    const dEnd = hole.hasRightEdge ? hole.endKw - modEnd : 0;

    for (let s = 0; s <= steps; s++) {
      const m = hole.startMin + (s / steps) * span;
      const gKw = Math.max(0, physicsModel.lookupAtMinute(m).kw) * hole.kGapApplied;
      const wLeft = hole.hasLeftEdge ? Math.max(0, 1 - (m - hole.startMin) / TAU_EDGE_MIN) : 0;
      const wRight = hole.hasRightEdge ? Math.max(0, 1 - (hole.endMin - m) / TAU_EDGE_MIN) : 0;
      const isEndpoint = s === 0 || s === steps;
      const pInit = isEndpoint
        ? s === 0
          ? hole.hasLeftEdge
            ? hole.startKw
            : gKw
          : hole.hasRightEdge
            ? hole.endKw
            : gKw
        : gKw + wLeft * dStart + wRight * dEnd;
      samples.push({
        minutes: m,
        baseKw: Math.max(0.01, gKw),
        wEdge: Math.max(wLeft, wRight),
        kw: Math.min(safeAcCap, Math.max(0, pInit)),
        isEndpoint,
      });
    }

    for (let iter = 0; iter < 4; iter++) {
      const areaNow = integrate(samples);
      const err = targetSegKwh - areaNow;
      if (Math.abs(err) <= 0.015) break;

      let lockedArea = 0;
      let adjustableMass = 0;
      for (let i = 1; i < samples.length; i++) {
        const dtH = (samples[i].minutes - samples[i - 1].minutes) / 60;
        const a = samples[i - 1];
        const b = samples[i];
        const aLock = a.isEndpoint || a.kw >= safeAcCap * 0.995;
        const bLock = b.isEndpoint || b.kw >= safeAcCap * 0.995;
        lockedArea += (aLock ? a.kw : 0) * 0.5 * dtH + (bLock ? b.kw : 0) * 0.5 * dtH;
        adjustableMass += (!aLock ? a.kw : 0) * 0.5 * dtH + (!bLock ? b.kw : 0) * 0.5 * dtH;
      }

      if (adjustableMass <= 0.02) break;
      const desiredAdjArea = Math.max(0.01, targetSegKwh - lockedArea);
      const mult = Math.max(0.25, Math.min(2.4, desiredAdjArea / adjustableMass));
      for (const p of samples) {
        if (!p.isEndpoint && p.kw < safeAcCap * 0.995) {
          const interiorWeight = 1 - 0.65 * p.wEdge;
          const effMult = 1 + (mult - 1) * interiorWeight;
          p.kw = Math.min(safeAcCap, Math.max(0, p.kw * effMult));
        }
      }
    }

    let segCum = 0;
    const outPts: BridgedGapPoint[] = samples.map((p, idx) => {
      if (idx > 0) {
        segCum += ((samples[idx - 1].kw + p.kw) / 2) * ((p.minutes - samples[idx - 1].minutes) / 60);
      }
      return {
        minutes: +p.minutes.toFixed(1),
        kw: +p.kw.toFixed(2),
        cumGapKwh: +segCum.toFixed(2),
      };
    });

    const segKwh = +segCum.toFixed(2);
    if (segKwh >= 0.1) {
      if (hole.kind === 'EEPROM_CONFIRMED') eepromRecoveredKwh += segKwh;
      else bufferedKwh += segKwh;
      bridgedSegments.push({
        startMin: hole.startMin,
        endMin: hole.endMin,
        durationMin: hole.durationMin,
        isMorningPreConnect: hole.isMorningPreConnect,
        state: hole.state,
        kind: hole.kind,
        recoveredKwh: segKwh,
        suspectedGridCut: hole.suspectedGridCut,
        kGapApplied: hole.kGapApplied,
        points: outPts,
      });
    }
  }

  const totalRec = +(eepromRecoveredKwh + bufferedKwh).toFixed(2);
  if (bridgedSegments.length === 0 || totalRec < 0.15) {
    return { ...empty, suspectedGridCut: classification.suspectedGridCut };
  }

  return {
    hasBridgedGaps: true,
    recoveredKwh: totalRec,
    eepromRecoveredKwh: +eepromRecoveredKwh.toFixed(2),
    bufferedKwh: +bufferedKwh.toFixed(2),
    deficitKwh: classification.deltaEepromKwh,
    suspectedGridCut: classification.suspectedGridCut,
    bridgedSegments,
  };
}

/**
 * Interpolates any bridged or buffered segment at minute-of-day for crosshair inspection.
 */
export function lookupBridgedGapAtMinute(
  reconstructed: ReconstructedGapCurveResult | null | undefined,
  targetMin: number
): {
  kw: number;
  segmentRecoveredKwh: number;
  isMorningPreConnect: boolean;
  kind: GapCurvePocket;
  state: IntervalGapState;
  suspectedGridCut: boolean;
} | null {
  if (!reconstructed?.hasBridgedGaps) return null;
  for (const seg of reconstructed.bridgedSegments) {
    if (targetMin < seg.startMin - 2 || targetMin > seg.endMin + 2 || seg.points.length === 0) continue;
    const pts = seg.points;
    if (targetMin <= pts[0].minutes) {
      return {
        kw: pts[0].kw,
        segmentRecoveredKwh: seg.recoveredKwh,
        isMorningPreConnect: seg.isMorningPreConnect,
        kind: seg.kind,
        state: seg.state,
        suspectedGridCut: seg.suspectedGridCut,
      };
    }
    if (targetMin >= pts[pts.length - 1].minutes) {
      return {
        kw: pts[pts.length - 1].kw,
        segmentRecoveredKwh: seg.recoveredKwh,
        isMorningPreConnect: seg.isMorningPreConnect,
        kind: seg.kind,
        state: seg.state,
        suspectedGridCut: seg.suspectedGridCut,
      };
    }
    for (let i = 1; i < pts.length; i++) {
      if (targetMin <= pts[i].minutes) {
        const a = pts[i - 1];
        const b = pts[i];
        const f = (targetMin - a.minutes) / Math.max(0.01, b.minutes - a.minutes);
        return {
          kw: +(a.kw + f * (b.kw - a.kw)).toFixed(2),
          segmentRecoveredKwh: seg.recoveredKwh,
          isMorningPreConnect: seg.isMorningPreConnect,
          kind: seg.kind,
          state: seg.state,
          suspectedGridCut: seg.suspectedGridCut,
        };
      }
    }
  }
  return null;
}
