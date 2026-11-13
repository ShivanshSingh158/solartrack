import { SOLAR_CONSTANTS, computeInverterAcOutputKw } from '../physics/index.ts';
import type { DailyGenerationRecord } from '../types/intelligence.ts';
import type { InverterLossCoeffs } from '../types/settings.ts';

/**
 * Solves a 3x3 linear system A * x = b via Gaussian elimination with partial pivoting.
 */
export function solve3x3Linear(A: number[][], b: number[]): number[] | null {
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(m[pivotRow][col]) < 1e-9) return null;
    if (pivotRow !== col) {
      const tmp = m[col];
      m[col] = m[pivotRow];
      m[pivotRow] = tmp;
    }
    const div = m[col][col];
    for (let r = col + 1; r < 3; r++) {
      const factor = m[r][col] / div;
      for (let c = col; c < 4; c++) {
        m[r][c] -= factor * m[col][c];
      }
    }
  }
  const x = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let sum = m[r][3];
    for (let c = r + 1; c < 3; c++) sum -= m[r][c] * x[c];
    x[r] = sum / m[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Fits empirical 3-term quadratic inverter loss curve P_loss = c0 + c1 * P_dc + c2 * P_dc^2
 * from paired 5-min (pvPower, generationPower) points, with RS485 clock skew filtering.
 */
export function fitEmpiricalInverterCurve(
  generationByYmd: Record<string, DailyGenerationRecord>,
  dcCap: number,
  acCap: number
): {
  coeffs: InverterLossCoeffs;
  source: 'empirical_fitted' | 'waaree_baseline';
  samplesCount: number;
  rmseWatts: number | null;
} {
  const scale = acCap / SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const baseline: InverterLossCoeffs = {
    tareKw: +(SOLAR_CONSTANTS.DEFAULT_INV_TARE_KW * scale).toFixed(4),
    linearLoss: SOLAR_CONSTANTS.DEFAULT_INV_LINEAR_LOSS,
    quadLoss: +(SOLAR_CONSTANTS.DEFAULT_INV_QUAD_LOSS / Math.max(0.25, scale)).toFixed(4),
    cutoffKw: +(SOLAR_CONSTANTS.DEFAULT_INV_CUTOFF_KW * scale).toFixed(4),
    referenceAcKw: acCap,
  };

  const pairs: Array<{ dc: number; ac: number; loss: number }> = [];
  for (const rec of Object.values(generationByYmd || {})) {
    const raw = rec?.rawSeries;
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const genEntry = raw.find((s) => /generationPower/i.test(String(s?.variable || '')));
    const pvEntry = raw.find((s) => /pvPower/i.test(String(s?.variable || '')));
    if (!genEntry?.data?.length || !pvEntry?.data?.length) continue;

    const extractClock = (rawTime: string) => {
      const m = String(rawTime || '').match(/(\d{2}:\d{2})/);
      return m ? m[1] : String(rawTime || '');
    };
    const acMap = new Map<string, number>();
    for (const pt of genEntry.data) {
      const k = extractClock(pt.time);
      const v = Number(pt.value);
      if (Number.isFinite(v)) acMap.set(k, v);
    }

    let prevDc: number | null = null;
    let prevRatio: number | null = null;
    for (const pt of pvEntry.data) {
      const k = extractClock(pt.time);
      const dc = Number(pt.value);
      const ac = acMap.get(k);
      if (ac === undefined || !Number.isFinite(dc) || !Number.isFinite(ac)) continue;
      if (dc < 0.08 * scale || dc > dcCap * 1.15 || ac < 0.01 || ac >= dc) continue;
      const ratio = ac / dc;
      if (ratio < 0.42 || ratio > 0.992) continue;

      if (prevDc !== null && prevRatio !== null && Math.abs(dc - prevDc) > 0.35 && Math.abs(ratio - prevRatio) > 0.04) {
        prevDc = dc;
        prevRatio = ratio;
        continue;
      }
      prevDc = dc;
      prevRatio = ratio;
      pairs.push({ dc, ac, loss: dc - ac });
    }
  }

  if (pairs.length < 30) {
    return { coeffs: baseline, source: 'waaree_baseline', samplesCount: pairs.length, rmseWatts: null };
  }
  const minDc = Math.min(...pairs.map((p) => p.dc));
  const maxDc = Math.max(...pairs.map((p) => p.dc));
  if (maxDc - minDc < 0.6) {
    return { coeffs: baseline, source: 'waaree_baseline', samplesCount: pairs.length, rmseWatts: null };
  }

  const ATA = [
    [1e-4, 0, 0],
    [0, 1e-4, 0],
    [0, 0, 1e-4],
  ];
  const ATy = [0, 0, 0];
  for (const p of pairs) {
    const phi = [1, p.dc, p.dc * p.dc];
    for (let r = 0; r < 3; r++) {
      ATy[r] += phi[r] * p.loss;
      for (let c = 0; c < 3; c++) {
        ATA[r][c] += phi[r] * phi[c];
      }
    }
  }

  const solved = solve3x3Linear(ATA, ATy);
  if (!solved) {
    return { coeffs: baseline, source: 'waaree_baseline', samplesCount: pairs.length, rmseWatts: null };
  }

  const clampedCoeffs: InverterLossCoeffs = {
    tareKw: +Math.min(0.14 * scale, Math.max(0.025 * scale, solved[0])).toFixed(4),
    linearLoss: +Math.min(0.06, Math.max(0.002, solved[1])).toFixed(4),
    quadLoss: +Math.min(0.035 / Math.max(0.25, scale), Math.max(0, solved[2])).toFixed(4),
    cutoffKw: baseline.cutoffKw,
    referenceAcKw: acCap,
  };

  let sseKw = 0;
  for (const p of pairs) {
    const predAc = computeInverterAcOutputKw(p.dc, acCap, clampedCoeffs).acKw;
    const err = predAc - p.ac;
    sseKw += err * err;
  }
  const rmseWatts = Math.round(Math.sqrt(sseKw / pairs.length) * 1000);

  return {
    coeffs: clampedCoeffs,
    source: 'empirical_fitted',
    samplesCount: pairs.length,
    rmseWatts,
  };
}
