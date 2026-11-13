import type { RawSeries } from '../types/telemetry.ts';
import type { DailySolarPhysicsModel } from '../types/physics.ts';
import type { IntradayPoint, ParsedDayTelemetry, XAxisClockTick } from '../types/gap.ts';
import { formatDurationHm, formatMinutes12hUpper } from '../physics/astronomy.ts';

export type { IntradayPoint, ParsedDayTelemetry, XAxisClockTick };

/**
 * Splits raw 5-minute inverter telemetry into contiguous online segments (>16 min gap
 * starts a new segment instead of drawing a misleading bridge line across Wi-Fi outages).
 */
export function parseRawTelemetry(
  rawSeries: RawSeries[],
  sunriseMin: number,
  sunsetMin: number
): ParsedDayTelemetry {
  const genSeries =
    rawSeries.find((s) => s.variable === 'generationPower' && s.data?.length > 0) ||
    rawSeries.find((s) => s.variable === 'pvPower' && s.data?.length > 0);

  if (!genSeries || !Array.isArray(genSeries.data) || genSeries.data.length === 0) {
    return {
      segments: [],
      gaps: [],
      allPoints: [],
      peakKw: 0,
      peakMinutes: 0,
      onlineIntegratedKwh: 0,
      hasData: false,
      firstPointMin: null,
      lastPointMin: null,
      firstActiveMin: null,
      lastActiveMin: null,
      presentZeroMinutes: 0,
      presentZeroWindows: [],
    };
  }

  const rawParsed = genSeries.data
    .map((pt) => {
      const m = String(pt.time || '').match(/(\d{2}):(\d{2}):(\d{2})/);
      if (!m) return null;
      const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / 60;
      const kw = Math.max(0, Number(pt.value) || 0);
      return { minutes: mins, kw };
    })
    .filter(
      (x): x is { minutes: number; kw: number } =>
        x !== null && x.minutes >= sunriseMin - 15 && x.minutes <= sunsetMin + 15
    )
    .sort((a, b) => a.minutes - b.minutes);

  if (rawParsed.length === 0) {
    return {
      segments: [],
      gaps: [],
      allPoints: [],
      peakKw: 0,
      peakMinutes: 0,
      onlineIntegratedKwh: 0,
      hasData: false,
      firstPointMin: null,
      lastPointMin: null,
      firstActiveMin: null,
      lastActiveMin: null,
      presentZeroMinutes: 0,
      presentZeroWindows: [],
    };
  }

  const segments: IntradayPoint[][] = [];
  const gaps: Array<{ startMin: number; endMin: number; durationMin: number; durationText: string }> = [];
  const allPoints: IntradayPoint[] = [];
  const presentZeroWindows: Array<{ startMin: number; endMin: number; durationMin: number }> = [];
  let presentZeroMinutes = 0;

  let cumKwh = 0;
  let peakKw = rawParsed[0].kw;
  let peakMinutes = rawParsed[0].minutes;
  let firstActiveMin: number | null = rawParsed[0].kw > 0.025 ? rawParsed[0].minutes : null;
  let lastActiveMin: number | null = rawParsed[0].kw > 0.025 ? rawParsed[0].minutes : null;

  let currentSeg: IntradayPoint[] = [{ minutes: rawParsed[0].minutes, kw: rawParsed[0].kw, cumKwh: 0 }];
  allPoints.push(currentSeg[0]);

  for (let i = 1; i < rawParsed.length; i++) {
    const prev = rawParsed[i - 1];
    const curr = rawParsed[i];
    const dtMin = curr.minutes - prev.minutes;

    if (curr.kw > peakKw) {
      peakKw = curr.kw;
      peakMinutes = curr.minutes;
    }
    if (curr.kw > 0.025) {
      if (firstActiveMin === null) firstActiveMin = curr.minutes;
      lastActiveMin = curr.minutes;
    }

    if (dtMin > 16) {
      segments.push(currentSeg);
      const durationMin = Math.round(dtMin);
      gaps.push({
        startMin: prev.minutes,
        endMin: curr.minutes,
        durationMin,
        durationText: formatDurationHm(durationMin),
      });
      const pt: IntradayPoint = { minutes: curr.minutes, kw: curr.kw, cumKwh: +cumKwh.toFixed(2) };
      currentSeg = [pt];
      allPoints.push(pt);
    } else {
      cumKwh += ((prev.kw + curr.kw) / 2) * (dtMin / 60);
      if (prev.kw <= 0.025 && curr.kw <= 0.025 && prev.minutes >= sunriseMin + 15 && curr.minutes <= sunsetMin - 15) {
        presentZeroMinutes += dtMin;
        const lastZeroWin = presentZeroWindows[presentZeroWindows.length - 1];
        if (lastZeroWin && prev.minutes - lastZeroWin.endMin <= 6) {
          lastZeroWin.endMin = curr.minutes;
          lastZeroWin.durationMin = Math.round(lastZeroWin.endMin - lastZeroWin.startMin);
        } else {
          presentZeroWindows.push({ startMin: prev.minutes, endMin: curr.minutes, durationMin: Math.round(dtMin) });
        }
      }
      const pt: IntradayPoint = { minutes: curr.minutes, kw: curr.kw, cumKwh: +cumKwh.toFixed(2) };
      currentSeg.push(pt);
      allPoints.push(pt);
    }
  }
  segments.push(currentSeg);

  return {
    segments,
    gaps,
    allPoints,
    peakKw: +peakKw.toFixed(2),
    peakMinutes,
    onlineIntegratedKwh: +cumKwh.toFixed(2),
    hasData: true,
    firstPointMin: rawParsed[0].minutes,
    lastPointMin: rawParsed[rawParsed.length - 1].minutes,
    firstActiveMin,
    lastActiveMin,
    presentZeroMinutes: Math.round(presentZeroMinutes),
    presentZeroWindows,
  };
}

/**
 * Integrates calculated Physics Engine energy strictly over intervals when the Waaree
 * inverter was actively online, giving an apples-to-apples efficiency match even with outages.
 */
export function computeOnlineWindowOverlapMatch(
  parsed: ParsedDayTelemetry,
  physicsModel: Pick<DailySolarPhysicsModel, 'lookupAtMinute'>
): {
  onlineRealKwh: number;
  onlineEngineKwh: number;
  overlapMatchPct: number | null;
  hasOutageGap: boolean;
  totalGapMinutes: number;
} {
  if (!parsed.hasData || parsed.segments.length === 0) {
    return {
      onlineRealKwh: 0,
      onlineEngineKwh: 0,
      overlapMatchPct: null,
      hasOutageGap: false,
      totalGapMinutes: 0,
    };
  }

  let onlineEngineKwh = 0;
  for (const seg of parsed.segments) {
    if (seg.length < 2) continue;
    const startCum = physicsModel.lookupAtMinute(seg[0].minutes).cumKwh;
    const endCum = physicsModel.lookupAtMinute(seg[seg.length - 1].minutes).cumKwh;
    onlineEngineKwh += Math.max(0, endCum - startCum);
  }

  const totalGapMinutes = parsed.gaps.reduce((sum, g) => sum + g.durationMin, 0);
  const overlapMatchPct =
    onlineEngineKwh > 0.25 ? Math.round((parsed.onlineIntegratedKwh / onlineEngineKwh) * 100) : null;

  return {
    onlineRealKwh: parsed.onlineIntegratedKwh,
    onlineEngineKwh: +onlineEngineKwh.toFixed(2),
    overlapMatchPct,
    hasOutageGap: parsed.gaps.length > 0 || totalGapMinutes > 25,
    totalGapMinutes,
  };
}

/**
 * Smooth Catmull-Rom to Cubic Bezier SVG spline clamped within [topY, baselineY].
 */
export function pointsToClampedSpline(
  points: Array<{ x: number; y: number }>,
  topY: number,
  baselineY: number,
  tension = 0.24
): string {
  if (points.length === 0) return '';
  const clampY = (y: number) => Math.max(topY, Math.min(baselineY, y));
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${clampY(points[0].y).toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${clampY(points[0].y).toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = Math.max(p1.x, Math.min(p2.x, p1.x + (p2.x - p0.x) * tension));
    const cp1y = clampY(p1.y + (p2.y - p0.y) * tension);
    const cp2x = Math.max(p1.x, Math.min(p2.x, p2.x - (p3.x - p1.x) * tension));
    const cp2y = clampY(p2.y - (p3.y - p1.y) * tension);

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${clampY(p2.y).toFixed(1)}`;
  }
  return d;
}

/**
 * Finds interpolated real kW + cumulative kWh at a given minute strictly within active segments.
 */
export function lookupRealTelemetryAtMinute(
  parsed: ParsedDayTelemetry,
  targetMin: number
): { kw: number; cumKwh: number } | null {
  if (!parsed.hasData) return null;
  for (const seg of parsed.segments) {
    if (seg.length === 0) continue;
    if (targetMin >= seg[0].minutes - 3 && targetMin <= seg[seg.length - 1].minutes + 3) {
      if (targetMin <= seg[0].minutes) return { kw: seg[0].kw, cumKwh: seg[0].cumKwh };
      if (targetMin >= seg[seg.length - 1].minutes) {
        const last = seg[seg.length - 1];
        return { kw: last.kw, cumKwh: last.cumKwh };
      }
      for (let i = 1; i < seg.length; i++) {
        if (targetMin <= seg[i].minutes) {
          const a = seg[i - 1];
          const b = seg[i];
          const f = (targetMin - a.minutes) / Math.max(0.01, b.minutes - a.minutes);
          return {
            kw: +(a.kw + f * (b.kw - a.kw)).toFixed(2),
            cumKwh: +(a.cumKwh + f * (b.cumKwh - a.cumKwh)).toFixed(2),
          };
        }
      }
    }
  }
  return null;
}

/**
 * Computes evenly spaced interior X-axis clock ticks between sunrise & sunset.
 */
export function buildSolarXAxisTicks(
  sunriseMin: number,
  sunsetMin: number,
  isCompact: boolean
): {
  edgeStart: XAxisClockTick;
  edgeEnd: XAxisClockTick;
  interior: XAxisClockTick[];
} {
  const edgeStart: XAxisClockTick = {
    minutes: sunriseMin,
    label: formatMinutes12hUpper(sunriseMin),
    compactLabel: formatMinutes12hUpper(sunriseMin),
    isEdge: 'sunrise',
  };
  const edgeEnd: XAxisClockTick = {
    minutes: sunsetMin,
    label: formatMinutes12hUpper(sunsetMin),
    compactLabel: formatMinutes12hUpper(sunsetMin),
    isEdge: 'sunset',
  };

  const candidates = isCompact ? [8 * 60, 12 * 60, 16 * 60] : [8 * 60, 10 * 60, 12 * 60, 14 * 60, 16 * 60];
  const minMarginFromEdge = isCompact ? 62 : 52;

  const interior = candidates
    .filter((m) => m - sunriseMin >= minMarginFromEdge && sunsetMin - m >= minMarginFromEdge)
    .map((m) => {
      const h24 = Math.floor(m / 60);
      const ampm = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 || 12;
      return {
        minutes: m,
        label: formatMinutes12hUpper(m),
        compactLabel: `${h12} ${ampm}`,
      };
    });

  return { edgeStart, edgeEnd, interior };
}
