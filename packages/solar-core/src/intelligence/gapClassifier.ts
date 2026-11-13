import type {
  ClassifiedGapHole,
  DayGapClassificationResult,
  IntervalGapState,
  ParsedDayTelemetry,
} from '../types/gap.ts';
import type { DailySolarPhysicsModel } from '../types/physics.ts';
import { computeOnlineWindowOverlapMatch } from '../analytics/telemetryParser.ts';

export type { ClassifiedGapHole, DayGapClassificationResult, IntervalGapState };

function modelIntervalKwh(
  physicsModel: Pick<DailySolarPhysicsModel, 'lookupAtMinute'>,
  startMin: number,
  endMin: number
): number {
  if (endMin <= startMin + 1) return 0;
  const aCum = physicsModel.lookupAtMinute(startMin).cumKwh;
  const bCum = physicsModel.lookupAtMinute(endMin).cumKwh;
  return Math.max(0, bCum - aCum);
}

/**
 * Single Source of Truth: Two-Pocket Interval & Yield Reconciliation (EDay vs Curve + Buffer).
 * Separates EEPROM-confirmed pre-last-packet holes (no extra yield added) from genuinely
 * unlogged outage holes (morning pre-connect, midday un-synced, evening tail, or full-day blackouts).
 */
export function classifyDayGapArchitecture(params: {
  parsed: ParsedDayTelemetry;
  physicsModel: Pick<DailySolarPhysicsModel, 'sunriseMin' | 'sunsetMin' | 'points' | 'lookupAtMinute'>;
  eepromKwh: number;
  surfaceLossPct?: number;
  ymd: string;
  todayYmd: string;
  commissioningYmd?: string;
  nowMinutesIst?: number;
  isManualGridOff?: boolean;
  isWifiOfflineFullDay?: boolean;
}): DayGapClassificationResult {
  const {
    parsed,
    physicsModel,
    eepromKwh,
    surfaceLossPct = 0,
    ymd,
    todayYmd,
    commissioningYmd = '2026-10-28',
    nowMinutesIst = 1440,
    isManualGridOff = false,
    isWifiOfflineFullDay = false,
  } = params;

  const isToday = ymd === todayYmd;
  const isCommissioning = ymd === commissioningYmd;
  const onlineKwh = parsed.hasData ? +parsed.onlineIntegratedKwh.toFixed(2) : 0;
  const cleanEeprom = Math.max(0, Number(eepromKwh) || 0);
  const deltaEepromKwh = +Math.max(0, cleanEeprom - onlineKwh).toFixed(2);
  const soilMult = Math.max(0.5, 1 - Math.max(0, Math.min(40, surfaceLossPct)) / 100);

  const empty: DayGapClassificationResult = {
    onlineKwh,
    eepromKwh: +cleanEeprom.toFixed(2),
    deltaEepromKwh,
    eepromConfirmedPreKwh: 0,
    bufferKwh: 0,
    kGapApplied: 1,
    suspectedGridCut: false,
    isManualGridOff,
    hasAnyHole: false,
    holes: [],
  };

  if (physicsModel.points.length < 2) {
    return empty;
  }

  const sunriseMin = physicsModel.sunriseMin;
  const sunsetMin = physicsModel.sunsetMin;

  const onlineOverlap = parsed.hasData ? computeOnlineWindowOverlapMatch(parsed, physicsModel) : null;
  const rDayRaw =
    onlineOverlap && onlineOverlap.onlineEngineKwh > 0.25
      ? onlineOverlap.onlineRealKwh / onlineOverlap.onlineEngineKwh
      : 1.0;
  const rDay = Math.min(1.18, Math.max(0.35, rDayRaw));

  const computeEdgeRatio = (ptMin: number, ptKw: number): number | null => {
    const modKw = Math.max(0, physicsModel.lookupAtMinute(ptMin).kw);
    if (modKw < 0.25 || ptKw <= 0.025) return null;
    return Math.min(1.18, Math.max(0.35, ptKw / modKw));
  };

  // Case 1: Full Day with zero curve points
  if (!parsed.hasData || parsed.allPoints.length === 0) {
    if (isCommissioning && cleanEeprom <= 0.05) {
      return empty;
    }
    const endWindow = isToday ? Math.min(sunsetMin, Math.max(sunriseMin, nowMinutesIst - 10)) : sunsetMin;
    if ((ymd < todayYmd || isWifiOfflineFullDay) && endWindow > sunriseMin + 30 && cleanEeprom <= 0.05) {
      const fullEst = +(modelIntervalKwh(physicsModel, sunriseMin, endWindow) * soilMult).toFixed(2);
      const gridBlocked = isManualGridOff;
      const alloc = gridBlocked ? 0 : fullEst;
      if (fullEst >= 0.2) {
        return {
          ...empty,
          bufferKwh: alloc,
          suspectedGridCut: gridBlocked,
          hasAnyHole: true,
          holes: [
            {
              startMin: sunriseMin,
              endMin: endWindow,
              durationMin: Math.round(endWindow - sunriseMin),
              state: 'GAP_FULL_DAY',
              kind: gridBlocked ? 'GRID_OFF_ZERO' : 'BUFFER_ESTIMATED',
              startKw: 0,
              endKw: 0,
              hasLeftEdge: false,
              hasRightEdge: false,
              rawEstimatedKwh: fullEst,
              allocatedKwh: alloc,
              kGapApplied: +soilMult.toFixed(3),
              suspectedGridCut: gridBlocked,
              isMorningPreConnect: false,
            },
          ],
        };
      }
    }
    return empty;
  }

  // Case 2: Partial Curve
  const rawWindows: Array<{
    startMin: number;
    endMin: number;
    state: IntervalGapState;
    startKw: number;
    endKw: number;
    hasLeftEdge: boolean;
    hasRightEdge: boolean;
    isPreLast: boolean;
    suspectedGridCut: boolean;
    kGapLocal: number;
    rawEstimatedKwh: number;
  }> = [];

  const firstPt = parsed.allPoints[0];
  const secondPt = parsed.allPoints[1] ?? null;
  const lastPt = parsed.allPoints[parsed.allPoints.length - 1];
  const tLast = lastPt.minutes;

  // 2A. Morning Pre-Connect Gap
  if (firstPt.minutes > sunriseMin + 22) {
    const modFirst = Math.max(0, physicsModel.lookupAtMinute(firstPt.minutes).kw);
    const modMass = modelIntervalKwh(physicsModel, sunriseMin, firstPt.minutes);
    if (modMass >= 0.15) {
      const rEdge = computeEdgeRatio(firstPt.minutes, firstPt.kw);
      const kGapLocal = +(rEdge !== null ? 0.55 * rEdge + 0.45 * rDay : rDay).toFixed(3);
      const secondKw = secondPt ? secondPt.kw : firstPt.kw;
      const morningGridCut =
        (modFirst >= 0.45 && firstPt.kw <= 0.05) ||
        (modFirst >= 0.8 && firstPt.kw < Math.min(0.2, modFirst * 0.2) && secondKw < Math.min(0.35, modFirst * 0.3));
      const est = +(modMass * kGapLocal).toFixed(2);
      rawWindows.push({
        startMin: sunriseMin,
        endMin: firstPt.minutes,
        state: 'GAP_MORNING_PRECONNECT',
        startKw: 0,
        endKw: firstPt.kw,
        hasLeftEdge: false,
        hasRightEdge: true,
        isPreLast: true,
        suspectedGridCut: morningGridCut,
        kGapLocal,
        rawEstimatedKwh: est,
      });
    }
  }

  // 2B. Midday Dropouts
  for (let i = 0; i < parsed.gaps.length; i++) {
    const g = parsed.gaps[i];
    if (g.endMin <= sunriseMin + 10 || g.startMin >= sunsetMin - 10 || g.endMin <= g.startMin + 12) continue;
    const segBefore = parsed.segments[i];
    const segAfter = parsed.segments[i + 1];
    const startKw = segBefore && segBefore.length > 0 ? segBefore[segBefore.length - 1].kw : physicsModel.lookupAtMinute(g.startMin).kw;
    const endKw = segAfter && segAfter.length > 0 ? segAfter[0].kw : physicsModel.lookupAtMinute(g.endMin).kw;
    const rA = computeEdgeRatio(g.startMin, startKw);
    const rB = computeEdgeRatio(g.endMin, endKw);
    const edgeVals = [rA, rB].filter((v): v is number => v !== null);
    const rEdge = edgeVals.length > 0 ? edgeVals.reduce((s, v) => s + v, 0) / edgeVals.length : null;
    const kGapLocal = +(rEdge !== null ? 0.55 * rEdge + 0.45 * rDay : rDay).toFixed(3);
    const midMin = (g.startMin + g.endMin) / 2;
    const modMid = Math.max(0, physicsModel.lookupAtMinute(midMin).kw);
    const segAfterSecond = segAfter && segAfter.length > 1 ? segAfter[1].kw : endKw;
    const middayGridCut = modMid >= 0.45 && startKw <= 0.04 && endKw <= 0.08 && segAfterSecond < 0.25;
    const modMass = modelIntervalKwh(physicsModel, g.startMin, g.endMin);
    if (modMass >= 0.12) {
      rawWindows.push({
        startMin: g.startMin,
        endMin: g.endMin,
        state: 'GAP_MIDDAY_DROPOUT',
        startKw,
        endKw,
        hasLeftEdge: true,
        hasRightEdge: true,
        isPreLast: true,
        suspectedGridCut: middayGridCut,
        kGapLocal,
        rawEstimatedKwh: +(modMass * kGapLocal).toFixed(2),
      });
    }
  }

  // 2C. Evening Unlogged Tail
  const tailUpper = isToday ? Math.min(sunsetMin, nowMinutesIst - 10) : sunsetMin;
  const elapsedTailGapOk = !isToday || (nowMinutesIst - tLast >= 25 && tailUpper > tLast + 12);
  if (lastPt.minutes < sunsetMin - 22 && tailUpper > lastPt.minutes + 12 && elapsedTailGapOk) {
    const modLast = Math.max(0, physicsModel.lookupAtMinute(lastPt.minutes).kw);
    const modMass = modelIntervalKwh(physicsModel, lastPt.minutes, tailUpper);
    if (modMass >= 0.15) {
      const rEdge = computeEdgeRatio(lastPt.minutes, lastPt.kw);
      const kGapLocal = +(rEdge !== null ? 0.55 * rEdge + 0.45 * rDay : rDay).toFixed(3);
      const tailGridCut = modLast >= 0.35 && lastPt.kw <= 0.03;
      rawWindows.push({
        startMin: lastPt.minutes,
        endMin: tailUpper,
        state: 'GAP_EVENING_TAIL',
        startKw: lastPt.kw,
        endKw: 0,
        hasLeftEdge: true,
        hasRightEdge: false,
        isPreLast: false,
        suspectedGridCut: tailGridCut,
        kGapLocal,
        rawEstimatedKwh: +(modMass * kGapLocal).toFixed(2),
      });
    }
  }

  if (rawWindows.length === 0) {
    return {
      ...empty,
      kGapApplied: +rDay.toFixed(3),
    };
  }

  let remainingEeprom = deltaEepromKwh >= 0.25 ? deltaEepromKwh : 0;
  const eepromAlloc = new Array<number>(rawWindows.length).fill(0);
  const preIndices = rawWindows.map((w, i) => (w.isPreLast ? i : -1)).filter((i) => i >= 0);

  if (remainingEeprom > 0 && preIndices.length > 0) {
    if (preIndices.length === 1) {
      eepromAlloc[preIndices[0]] = +remainingEeprom.toFixed(2);
      remainingEeprom = 0;
    } else {
      const preEstSum = preIndices.reduce((s, idx) => s + rawWindows[idx].rawEstimatedKwh, 0);
      if (remainingEeprom >= preEstSum * 0.72 || preEstSum <= 0.1) {
        const denom = Math.max(0.05, preEstSum);
        for (const idx of preIndices) {
          eepromAlloc[idx] = +((remainingEeprom * rawWindows[idx].rawEstimatedKwh) / denom).toFixed(2);
        }
        remainingEeprom = 0;
      } else {
        for (let k = preIndices.length - 1; k >= 0 && remainingEeprom > 0.02; k--) {
          const idx = preIndices[k];
          const take = Math.min(rawWindows[idx].rawEstimatedKwh, remainingEeprom);
          eepromAlloc[idx] = +take.toFixed(2);
          remainingEeprom = +Math.max(0, remainingEeprom - take).toFixed(2);
        }
      }
    }
  }

  if (remainingEeprom > 0.2) {
    const postIndices = rawWindows.map((w, i) => (!w.isPreLast ? i : -1)).filter((i) => i >= 0);
    if (postIndices.length > 0) {
      const postEstSum = Math.max(0.05, postIndices.reduce((s, idx) => s + rawWindows[idx].rawEstimatedKwh, 0));
      for (const idx of postIndices) {
        eepromAlloc[idx] = +((remainingEeprom * rawWindows[idx].rawEstimatedKwh) / postEstSum).toFixed(2);
      }
      remainingEeprom = 0;
    }
  }

  const holes: ClassifiedGapHole[] = [];
  let eepromConfirmedPreKwh = 0;
  let bufferKwh = 0;
  let anySuspectedGridCut = false;

  for (let i = 0; i < rawWindows.length; i++) {
    const w = rawWindows[i];
    const confirmedTake = eepromAlloc[i];
    if (confirmedTake >= 0.2) {
      eepromConfirmedPreKwh += confirmedTake;
      holes.push({
        startMin: w.startMin,
        endMin: w.endMin,
        durationMin: Math.round(w.endMin - w.startMin),
        state: w.state,
        kind: 'EEPROM_CONFIRMED',
        startKw: w.startKw,
        endKw: w.endKw,
        hasLeftEdge: w.hasLeftEdge,
        hasRightEdge: w.hasRightEdge,
        rawEstimatedKwh: w.rawEstimatedKwh,
        allocatedKwh: +confirmedTake.toFixed(2),
        kGapApplied: w.kGapLocal,
        suspectedGridCut: false,
        isMorningPreConnect: w.state === 'GAP_MORNING_PRECONNECT',
      });
      continue;
    }

    const blockedByGridCut = isManualGridOff || w.suspectedGridCut;
    if (w.suspectedGridCut) anySuspectedGridCut = true;
    const unloggedRemainder = Math.max(0, w.rawEstimatedKwh - confirmedTake);
    const bufAlloc = blockedByGridCut || unloggedRemainder < 0.15 ? 0 : +unloggedRemainder.toFixed(2);
    bufferKwh += bufAlloc;
    holes.push({
      startMin: w.startMin,
      endMin: w.endMin,
      durationMin: Math.round(w.endMin - w.startMin),
      state: w.state,
      kind: blockedByGridCut ? 'GRID_OFF_ZERO' : 'BUFFER_ESTIMATED',
      startKw: w.startKw,
      endKw: w.endKw,
      hasLeftEdge: w.hasLeftEdge,
      hasRightEdge: w.hasRightEdge,
      rawEstimatedKwh: w.rawEstimatedKwh,
      allocatedKwh: bufAlloc,
      kGapApplied: w.kGapLocal,
      suspectedGridCut: w.suspectedGridCut,
      isMorningPreConnect: w.state === 'GAP_MORNING_PRECONNECT',
    });
  }

  const avgKgap =
    holes.length > 0 ? +(holes.reduce((s, h) => s + h.kGapApplied, 0) / holes.length).toFixed(3) : +rDay.toFixed(3);

  return {
    onlineKwh,
    eepromKwh: +cleanEeprom.toFixed(2),
    deltaEepromKwh,
    eepromConfirmedPreKwh: +eepromConfirmedPreKwh.toFixed(2),
    bufferKwh: +bufferKwh.toFixed(2),
    kGapApplied: avgKgap,
    suspectedGridCut: anySuspectedGridCut,
    isManualGridOff,
    hasAnyHole: holes.length > 0,
    holes,
  };
}
