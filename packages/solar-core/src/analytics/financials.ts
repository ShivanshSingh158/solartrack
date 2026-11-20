import { formatINR } from '../formatters/solarFormatter.ts';
import { daysInIstMonth, shiftYm } from '../time/istDate.ts';
import type { DailyPerformanceLedgerEntry, SolarIntelligenceReport } from '../types/intelligence.ts';
import type { CanonicalSolarSnapshot } from '../types/snapshot.ts';
import type { AnnualSolarBaseline, SolarWeatherResponse } from '../types/weather.ts';

const IST_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatYmdToStandard(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = IST_MONTH_SHORT[monthIdx] ?? parts[1];
  return `${day} ${monthName} ${year}`;
}
const PANEL_ANNUAL_DEGRADATION = 0.0055; // 0.55%/yr PERC linear degradation warranty standard

export interface SeasonalMonthBaseline {
  month: number;
  shortMonth: string;
  avgDailyKwh: number;
  avgDailyGtiKwhM2: number;
  avgDailyRadMj: number;
  rTilt: number;
  avgTempMaxC: number | null;
}

export interface MonthlyPaybackPoint {
  monthIndex: number;
  ym: string;
  label: string;
  monthYieldKwh: number;
  grossSavingsInr: number;
  washCostInr: number;
  netSavingsInr: number;
  cumulativeNetInr: number;
}

export interface AnnualPaybackPoint {
  yearOffset: number;
  yearLabel: string;
  annualYieldKwh: number;
  annualNetSavingsInr: number;
  cumulativeNetInr: number;
  capexTargetInr: number;
  remainingPrincipalInr: number;
  paidOffPct: number;
}

export interface PaybackMilestoneItem {
  pctTarget: number;
  targetInr: number;
  achieved: boolean;
  projectedLabel: string;
  monthsFromNow: number;
}

export interface PaybackHorizonAnalysis {
  baselineSource: 'open_meteo_365d_archive' | 'live_weather_fallback';
  archiveWindowLabel: string | null;
  seasonalProfile: SeasonalMonthBaseline[];
  year1SeasonalKwh: number;
  year1ProjectedInr: number;
  empiricalFactor: number;
  netCapexInr: number;
  confirmedSavedInr: number;
  unloggedSavedInr: number;
  physicalSavedInr: number;
  paidOffPct: number;
  physicalPaidOffPct: number;
  remainingInr: number;
  breakevenMonthIndex: number | null;
  breakevenLabel: string;
  breakevenYears: number | null;
  lcoeAllInInrPerKwh: number;
  lcoeSavingsSpreadInr: number;
  washesPerYear: number;
  annualWashExpenseInr: number;
  netProfit10YrInr: number;
  netProfit25YrInr: number;
  annualizedCashYieldPct: number;
  monthlySeries: MonthlyPaybackPoint[];
  annualSeries: AnnualPaybackPoint[];
  milestones: PaybackMilestoneItem[];
}

export interface ReconciledCashPnlDay {
  ymd: string;
  shortLabel: string;
  isConfirmed: boolean;
  idealPotentialInr: number;
  earnedInr: number;
  weatherDipInr: number;
  soilLossInr: number;
  pendingOutageInr: number;
  realKwh: number | null;
  idealKwh: number;
  dipReasonLabel: string;
}

export interface ReconciledCashPnlSummary {
  daysCount: number;
  confirmedDaysCount: number;
  idealPotentialInr: number;
  earnedInr: number;
  weatherDipInr: number;
  soilLossInr: number;
  pendingOutageInr: number;
  earnedPct: number;
  weatherDipPct: number;
  soilLossPct: number;
  pendingOutagePct: number;
  dailyRows: ReconciledCashPnlDay[];
}

export interface DiscomCycleBreakdown {
  billingCycleDay: number;
  cyclePeriodText: string;
  cycleStartYmd: string;
  cycleEndYmd: string;
  cycleTotalDays: number;
  daysElapsedInCycle: number;
  daysRemainingInCycle: number;
  confirmedUnitsKwh: number;
  confirmedInr: number;
  confirmedFormatted: string;
  pendingSyncDaysCount: number;
  pendingUnitsKwh: number;
  pendingInr: number;
  pendingLabels: string[];
  accruedPlusPendingKwh: number;
  accruedPlusPendingInr: number;
  projectedCycleUnitsKwh: number;
  projectedCycleInr: number;
}

export function buildSeasonalProfileFromArchive(
  annualBaseline: AnnualSolarBaseline | null | undefined,
  weatherData: SolarWeatherResponse | null | undefined,
  capacityKwp: number,
  sunScorePct: number | null
): {
  source: 'open_meteo_365d_archive' | 'live_weather_fallback';
  archiveWindowLabel: string | null;
  empiricalFactor: number;
  months: SeasonalMonthBaseline[];
  year1Kwh: number;
} {
  const safeCap = capacityKwp > 0 ? capacityKwp : 3.0;
  const empiricalFactor =
    sunScorePct !== null && Number.isFinite(sunScorePct)
      ? +Math.min(1.08, Math.max(0.82, sunScorePct / 100)).toFixed(3)
      : 1.0;

  const stdDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (annualBaseline && Array.isArray(annualBaseline.months) && annualBaseline.months.length === 12) {
    let yrSum = 0;
    const months: SeasonalMonthBaseline[] = annualBaseline.months.map((m, idx) => {
      const avgDailyKwh = +(Math.max(0.5, m.avgDailyKwhPerKwp * safeCap * empiricalFactor)).toFixed(2);
      yrSum += avgDailyKwh * stdDays[idx];
      return {
        month: m.month,
        shortMonth: m.shortMonth || IST_MONTH_SHORT[idx],
        avgDailyKwh,
        avgDailyGtiKwhM2: m.avgDailyGtiKwhM2,
        avgDailyRadMj: m.avgDailyRadMj,
        rTilt: m.rTilt,
        avgTempMaxC: m.avgTempMaxC,
      };
    });

    return {
      source: 'open_meteo_365d_archive',
      archiveWindowLabel: `${formatYmdToStandard(annualBaseline.startYmd)} – ${formatYmdToStandard(annualBaseline.endYmd)}`,
      empiricalFactor,
      months,
      year1Kwh: Math.round(yrSum),
    };
  }

  const todayBaseKwh = Math.max(4, weatherData?.todayForecast?.expectedYieldKwh || safeCap * 3.5);
  const todayRad = weatherData?.todayForecast?.radiationMjM2 || 15.0;
  const fallbackMonths: SeasonalMonthBaseline[] = IST_MONTH_SHORT.map((shortMonth, idx) => ({
    month: idx + 1,
    shortMonth,
    avgDailyKwh: +todayBaseKwh.toFixed(2),
    avgDailyGtiKwhM2: +(todayRad / 3.6).toFixed(2),
    avgDailyRadMj: +todayRad.toFixed(2),
    rTilt: 1.0,
    avgTempMaxC: weatherData?.todayForecast?.maxTemp ?? null,
  }));

  return {
    source: 'live_weather_fallback',
    archiveWindowLabel: null,
    empiricalFactor,
    months: fallbackMonths,
    year1Kwh: Math.round(todayBaseKwh * 365),
  };
}

export function simulateMonthlyPaybackHorizon(input: {
  canonicalSnapshot: CanonicalSolarSnapshot;
  intelligenceReport?: SolarIntelligenceReport | null;
  annualBaseline?: AnnualSolarBaseline | null;
  weatherData?: SolarWeatherResponse | null;
  tariffOverride?: number;
  systemCostOverride?: number;
  subsidyInr?: number;
  washCostInr?: number;
  tariffEscalationPct?: number;
  degradationOverridePct?: number;
}): PaybackHorizonAnalysis {
  const {
    canonicalSnapshot: snap,
    intelligenceReport: rep,
    annualBaseline,
    weatherData,
    tariffOverride,
    systemCostOverride,
    subsidyInr = 0,
    washCostInr = 0,
    tariffEscalationPct = 0,
    degradationOverridePct,
  } = input;

  const tariff =
    typeof tariffOverride === 'number' && tariffOverride > 0
      ? tariffOverride
      : snap.config.tariffPerKwh;
  const safeCap = snap.config.capacityKwp;
  const baseCapex =
    typeof systemCostOverride === 'number' && systemCostOverride > 0
      ? systemCostOverride
      : snap.config.systemCost > 0
        ? snap.config.systemCost
        : 180000;
  const netCapexInr = Math.max(1000, baseCapex - Math.max(0, subsidyInr));
  const escFrac = Math.max(0, Math.min(0.15, tariffEscalationPct / 100));
  const annualDegFrac = Math.max(
    0.001,
    Math.min(
      0.03,
      ((typeof degradationOverridePct === 'number' && degradationOverridePct > 0
        ? degradationOverridePct
        : snap.config.panelDegradationPctYr ?? PANEL_ANNUAL_DEGRADATION * 100) as number) / 100
    )
  );
  const safeWashFee = Math.max(0, washCostInr);

  const confirmedSavedInr = Math.round(snap.lifetime.confirmedKwh * tariff);
  const physicalSavedInr = Math.round(snap.lifetime.physicalTotalKwh * tariff);
  const unloggedSavedInr = Math.max(0, physicalSavedInr - confirmedSavedInr);
  const paidOffPct = +Math.min(100, (confirmedSavedInr / netCapexInr) * 100).toFixed(1);
  const physicalPaidOffPct = +Math.min(100, (physicalSavedInr / netCapexInr) * 100).toFixed(1);
  const remainingInr = Math.max(0, netCapexInr - confirmedSavedInr);

  const profile = buildSeasonalProfileFromArchive(
    annualBaseline ?? weatherData?.annualBaseline,
    weatherData,
    safeCap,
    snap.sunEfficiencyScore.scorePct
  );

  const washThresholdPct = Math.max(3, snap.config.washRecommendPct ?? 7.0);
  const dailyAccum = rep?.soiling?.statsSinceWash?.dailyAccumRatePct ?? 0.25;
  const washCycleDays = Math.min(60, Math.max(14, Math.round(washThresholdPct / Math.max(0.12, dailyAccum))));
  const washesPerYear = safeWashFee > 0 ? Math.max(4, Math.min(24, Math.round(365 / washCycleDays))) : 0;
  const annualWashExpenseInr = Math.round(washesPerYear * safeWashFee);

  const curYear = snap.clock.year;
  const curMonth = snap.clock.month;
  const curYm = snap.clock.ym;
  const curMonthProfile = profile.months[curMonth - 1];

  const todayRemainingKwh = snap.today.isConfirmed
    ? Math.max(0, snap.today.fullDayTargetKwh - snap.today.rawConfirmedKwh)
    : Math.max(0, snap.today.fullDayTargetKwh);

  const anchorYmd = snap.lifetime.eTotalSetAtYmd;
  const pendingEarlierThisMonthKwh = (rep?.dailyLedger || [])
    .filter((d) => {
      if (!d.ymd.startsWith(curYm) || d.ymd >= snap.clock.ymd) return false;
      if (snap.lifetime.isEtotalAnchored && anchorYmd && d.ymd <= anchorYmd) return false;
      return !d.isConfirmed || (d.unloggedEstimatedKwh ?? 0) >= 0.25;
    })
    .reduce((acc, d) => {
      if (!d.isConfirmed) return acc + Math.max(0, d.unloggedEstimatedKwh ?? d.modeledAfterSoilingKwh);
      return acc + Math.max(0, d.unloggedEstimatedKwh ?? 0);
    }, 0);

  const remainingDaysAfterToday = Math.max(0, snap.clock.daysInMonth - snap.clock.day);
  const restOfCurrentMonthKwh =
    todayRemainingKwh +
    pendingEarlierThisMonthKwh +
    remainingDaysAfterToday * curMonthProfile.avgDailyKwh;
  const restOfCurrentMonthGrossInr = restOfCurrentMonthKwh * tariff;
  const month0WashCost = (washesPerYear / 12) * safeWashFee * (Math.max(1, remainingDaysAfterToday) / snap.clock.daysInMonth);
  const restOfCurrentMonthNetInr = restOfCurrentMonthGrossInr - month0WashCost;

  const startSavedBasisInr = snap.lifetime.isEtotalAnchored ? physicalSavedInr : confirmedSavedInr;
  const startYieldBasisKwh = snap.lifetime.isEtotalAnchored ? snap.lifetime.physicalTotalKwh : snap.lifetime.confirmedKwh;

  const monthlySeries: MonthlyPaybackPoint[] = [];
  let runningNetInr = startSavedBasisInr + restOfCurrentMonthNetInr;
  let total25YrYieldKwh = startYieldBasisKwh + restOfCurrentMonthKwh;
  let total25YrWashInr = month0WashCost;

  monthlySeries.push({
    monthIndex: 0,
    ym: curYm,
    label: `${IST_MONTH_SHORT[curMonth - 1]} ${curYear} (Rem)`,
    monthYieldKwh: +restOfCurrentMonthKwh.toFixed(1),
    grossSavingsInr: Math.round(restOfCurrentMonthGrossInr),
    washCostInr: Math.round(month0WashCost),
    netSavingsInr: Math.round(restOfCurrentMonthNetInr),
    cumulativeNetInr: Math.round(runningNetInr),
  });

  let simYm = curYm;
  for (let m = 1; m <= 300; m++) {
    simYm = shiftYm(simYm, 1);
    const y = parseInt(simYm.slice(0, 4), 10);
    const mo = parseInt(simYm.slice(5, 7), 10);
    const dInMo = daysInIstMonth(y, mo);
    const baseDaily = profile.months[mo - 1]?.avgDailyKwh ?? 10;
    const degFactor = Math.pow(1 - annualDegFrac / 12, m);
    const tariffFactor = Math.pow(1 + escFrac, m / 12);

    const monthYieldKwh = baseDaily * dInMo * degFactor;
    const grossInr = monthYieldKwh * tariff * tariffFactor;
    const mWashCost = (washesPerYear / 12) * safeWashFee;
    const netInr = grossInr - mWashCost;

    runningNetInr += netInr;
    total25YrYieldKwh += monthYieldKwh;
    total25YrWashInr += mWashCost;

    monthlySeries.push({
      monthIndex: m,
      ym: simYm,
      label: `${IST_MONTH_SHORT[mo - 1]} ${y}`,
      monthYieldKwh: +monthYieldKwh.toFixed(1),
      grossSavingsInr: Math.round(grossInr),
      washCostInr: Math.round(mWashCost),
      netSavingsInr: Math.round(netInr),
      cumulativeNetInr: Math.round(runningNetInr),
    });
  }

  let breakevenMonthIndex: number | null = null;
  let breakevenLabel = 'Paid Off';
  let breakevenYears: number | null = 0;

  if (startSavedBasisInr >= netCapexInr) {
    breakevenMonthIndex = 0;
    breakevenLabel = 'Completed';
    breakevenYears = 0;
  } else {
    const hit = monthlySeries.find((pt) => pt.cumulativeNetInr >= netCapexInr);
    if (hit) {
      breakevenMonthIndex = hit.monthIndex;
      const mo = parseInt(hit.ym.slice(5, 7), 10);
      const y = parseInt(hit.ym.slice(0, 4), 10);
      breakevenLabel = `${IST_MONTH_SHORT[mo - 1]} ${y}`;
      breakevenYears = +(Math.max(0.1, (hit.monthIndex + 0.5) / 12)).toFixed(1);
    } else {
      breakevenLabel = '> 25 yrs';
      breakevenYears = null;
    }
  }

  const startPaidOffPct = snap.lifetime.isEtotalAnchored ? physicalPaidOffPct : paidOffPct;
  const annualSeries: AnnualPaybackPoint[] = [
    {
      yearOffset: 0,
      yearLabel: 'Now',
      annualYieldKwh: startYieldBasisKwh,
      annualNetSavingsInr: startSavedBasisInr,
      cumulativeNetInr: startSavedBasisInr,
      capexTargetInr: netCapexInr,
      remainingPrincipalInr: snap.lifetime.isEtotalAnchored
        ? Math.max(0, netCapexInr - startSavedBasisInr)
        : remainingInr,
      paidOffPct: startPaidOffPct,
    },
  ];

  for (let yr = 1; yr <= 25; yr++) {
    const startIdx = yr === 1 ? 0 : (yr - 1) * 12 + 1;
    const endIdx = Math.min(monthlySeries.length - 1, yr * 12);
    const slice = monthlySeries.slice(startIdx, endIdx + 1);
    if (slice.length === 0) break;
    const yrYield = slice.reduce((a, b) => a + b.monthYieldKwh, 0);
    const yrNet = slice.reduce((a, b) => a + b.netSavingsInr, 0);
    const endCum = slice[slice.length - 1].cumulativeNetInr;
    annualSeries.push({
      yearOffset: yr,
      yearLabel: `Yr ${yr}`,
      annualYieldKwh: Math.round(yrYield),
      annualNetSavingsInr: Math.round(yrNet),
      cumulativeNetInr: endCum,
      capexTargetInr: netCapexInr,
      remainingPrincipalInr: Math.max(0, netCapexInr - endCum),
      paidOffPct: +Math.min(100, (endCum / netCapexInr) * 100).toFixed(1),
    });
  }

  const milestones: PaybackMilestoneItem[] = [25, 50, 75, 100].map((pct) => {
    const targetInr = Math.round(netCapexInr * (pct / 100));
    if (startSavedBasisInr >= targetInr) {
      return {
        pctTarget: pct,
        targetInr,
        achieved: true,
        projectedLabel: 'Achieved',
        monthsFromNow: 0,
      };
    }
    const hit = monthlySeries.find((pt) => pt.cumulativeNetInr >= targetInr);
    if (!hit) {
      return {
        pctTarget: pct,
        targetInr,
        achieved: false,
        projectedLabel: '>25 yrs',
        monthsFromNow: 300,
      };
    }
    const mo = parseInt(hit.ym.slice(5, 7), 10);
    const y = parseInt(hit.ym.slice(0, 4), 10);
    return {
      pctTarget: pct,
      targetInr,
      achieved: false,
      projectedLabel: `${IST_MONTH_SHORT[mo - 1]} ${y}`,
      monthsFromNow: hit.monthIndex,
    };
  });

  const yr10Cum = annualSeries[10]?.cumulativeNetInr ?? runningNetInr;
  const yr25Cum = annualSeries[annualSeries.length - 1]?.cumulativeNetInr ?? runningNetInr;
  const year1Net = Math.max(0, Math.round(profile.year1Kwh * tariff - annualWashExpenseInr));
  const lcoeAllInInrPerKwh =
    total25YrYieldKwh > 10
      ? +((netCapexInr + total25YrWashInr) / total25YrYieldKwh).toFixed(2)
      : 0;

  return {
    baselineSource: profile.source,
    archiveWindowLabel: profile.archiveWindowLabel,
    seasonalProfile: profile.months,
    year1SeasonalKwh: profile.year1Kwh,
    year1ProjectedInr: year1Net,
    empiricalFactor: profile.empiricalFactor,
    netCapexInr,
    confirmedSavedInr,
    unloggedSavedInr,
    physicalSavedInr,
    paidOffPct,
    physicalPaidOffPct,
    remainingInr,
    breakevenMonthIndex,
    breakevenLabel,
    breakevenYears,
    lcoeAllInInrPerKwh,
    lcoeSavingsSpreadInr: +Math.max(0, tariff - lcoeAllInInrPerKwh).toFixed(2),
    washesPerYear,
    annualWashExpenseInr,
    netProfit10YrInr: Math.round(yr10Cum - netCapexInr),
    netProfit25YrInr: Math.round(yr25Cum - netCapexInr),
    annualizedCashYieldPct: netCapexInr > 0 ? +((year1Net / netCapexInr) * 100).toFixed(1) : 0,
    monthlySeries,
    annualSeries,
    milestones,
  };
}

export function reconcilePeriodCashPnl(
  entries: DailyPerformanceLedgerEntry[],
  tariffPerKwh: number,
  todayYmd: string
): ReconciledCashPnlSummary {
  let sumIdealKwh = 0;
  let sumEarnedKwh = 0;
  let sumWeatherKwh = 0;
  let sumSoilKwh = 0;
  let sumPendingOutageKwh = 0;
  let confirmedDaysCount = 0;

  const dailyRows: ReconciledCashPnlDay[] = entries.map((d) => {
    const bufVal = d.bufferKwh ?? d.unloggedEstimatedKwh ?? 0;
    const potential = Math.max(d.idealClearSkyKwh, (d.realKwh ?? 0) + bufVal, d.modeledAfterSoilingKwh, 0);
    let earned = 0;
    let weather = 0;
    let soil = 0;
    let pendingOutage = 0;

    if (d.isConfirmed && d.realKwh !== null) {
      confirmedDaysCount++;
      earned = d.realKwh;
      const shortfall = Math.max(0, potential - earned);
      if (shortfall > 0.001) {
        const wRaw = Math.max(0, d.idealClearSkyKwh - d.weatherCleanKwh);
        const sRaw = Math.max(0, d.weatherCleanKwh - d.modeledAfterSoilingKwh);
        const oRaw =
          bufVal >= 0.15
            ? bufVal
            : d.dipCategory === 'OUTAGE_GAP'
              ? Math.max(0, d.modeledAfterSoilingKwh - earned)
              : 0;
        const wSum = wRaw + sRaw + oRaw;
        if (wSum > 0.001) {
          weather = shortfall * (wRaw / wSum);
          soil = shortfall * (sRaw / wSum);
          pendingOutage = shortfall * (oRaw / wSum);
        } else {
          weather = shortfall;
        }
      }
    } else if (d.ymd <= todayYmd) {
      const wRaw = Math.max(0, d.idealClearSkyKwh - d.weatherCleanKwh);
      const sRaw = Math.max(0, d.weatherCleanKwh - d.modeledAfterSoilingKwh);
      weather = Math.min(potential, wRaw);
      soil = Math.min(Math.max(0, potential - weather), sRaw);
      pendingOutage = Math.max(0, potential - weather - soil);
    }

    sumIdealKwh += potential;
    sumEarnedKwh += earned;
    sumWeatherKwh += weather;
    sumSoilKwh += soil;
    sumPendingOutageKwh += pendingOutage;

    return {
      ymd: d.ymd,
      shortLabel: d.shortLabel,
      isConfirmed: d.isConfirmed,
      idealPotentialInr: Math.round(potential * tariffPerKwh),
      earnedInr: Math.round(earned * tariffPerKwh),
      weatherDipInr: Math.round(weather * tariffPerKwh),
      soilLossInr: Math.round(soil * tariffPerKwh),
      pendingOutageInr: Math.round(pendingOutage * tariffPerKwh),
      realKwh: d.realKwh,
      idealKwh: +potential.toFixed(1),
      dipReasonLabel: d.dipReasonLabel || d.eventLabel,
    };
  });

  const denom = Math.max(0.1, sumIdealKwh);
  const earnedPct = +((sumEarnedKwh / denom) * 100).toFixed(1);
  const weatherDipPct = +((sumWeatherKwh / denom) * 100).toFixed(1);
  const soilLossPct = +((sumSoilKwh / denom) * 100).toFixed(1);
  const pendingOutagePct = +Math.max(0, 100 - earnedPct - weatherDipPct - soilLossPct).toFixed(1);

  const idealPotentialInr = Math.round(sumIdealKwh * tariffPerKwh);
  const earnedInr = Math.round(sumEarnedKwh * tariffPerKwh);
  const weatherDipInr = Math.round(sumWeatherKwh * tariffPerKwh);
  const soilLossInr = Math.round(sumSoilKwh * tariffPerKwh);
  const pendingOutageInr = Math.max(0, idealPotentialInr - earnedInr - weatherDipInr - soilLossInr);

  return {
    daysCount: entries.length,
    confirmedDaysCount,
    idealPotentialInr,
    earnedInr,
    weatherDipInr,
    soilLossInr,
    pendingOutageInr,
    earnedPct,
    weatherDipPct,
    soilLossPct,
    pendingOutagePct,
    dailyRows,
  };
}

export function computeDiscomCycleBreakdown(
  canonicalSnapshot: CanonicalSolarSnapshot,
  intelligenceReport?: SolarIntelligenceReport | null,
  tariffOverride?: number
): DiscomCycleBreakdown {
  const dc = canonicalSnapshot.discomCycle;
  const tariff =
    typeof tariffOverride === 'number' && tariffOverride > 0
      ? tariffOverride
      : canonicalSnapshot.config.tariffPerKwh;
  const ledger = Array.isArray(intelligenceReport?.dailyLedger)
    ? intelligenceReport!.dailyLedger
    : [];

  const confirmedUnitsKwh = dc.cycleYieldKwh;
  const confirmedInr = Math.round(confirmedUnitsKwh * tariff);

  const bufMap = canonicalSnapshot.reconciledBufferByYmd || {};
  let pendingUnitsKwh = 0;
  let pendingSyncDaysCount = 0;
  const pendingLabels: string[] = [];
  const countedYmds = new Set<string>();

  for (const row of ledger) {
    if (row.ymd < dc.cycleStartYmd || row.ymd > canonicalSnapshot.clock.ymd) continue;
    countedYmds.add(row.ymd);
    const rowBuf =
      typeof bufMap[row.ymd] === 'number'
        ? bufMap[row.ymd]
        : row.ymd === canonicalSnapshot.clock.ymd
          ? canonicalSnapshot.today.bufferKwh
          : Math.max(0, row.bufferKwh ?? row.unloggedEstimatedKwh ?? (!row.isConfirmed ? row.modeledAfterSoilingKwh : 0));

    if (row.ymd < canonicalSnapshot.clock.ymd && !row.isConfirmed) {
      if (rowBuf > 0.05) pendingUnitsKwh += rowBuf;
      pendingSyncDaysCount++;
      pendingLabels.push(row.shortLabel);
    } else if (rowBuf >= 0.15) {
      pendingUnitsKwh += rowBuf;
      pendingLabels.push(
        row.ymd === canonicalSnapshot.clock.ymd
          ? `${row.shortLabel} (Outage Buffer)`
          : `${row.shortLabel} (Gap)`
      );
    }
  }

  if (!countedYmds.has(canonicalSnapshot.clock.ymd)) {
    const todayExtraBuf =
      typeof bufMap[canonicalSnapshot.clock.ymd] === 'number'
        ? bufMap[canonicalSnapshot.clock.ymd]
        : canonicalSnapshot.today.bufferKwh > 0.05
          ? canonicalSnapshot.today.bufferKwh
          : !canonicalSnapshot.today.isConfirmed && canonicalSnapshot.today.displayKwh > 0.05
            ? canonicalSnapshot.today.displayKwh
            : 0;
    if (todayExtraBuf > 0.05) {
      pendingUnitsKwh += todayExtraBuf;
      pendingLabels.push(`${canonicalSnapshot.clock.shortLabel} (Outage Buffer)`);
    }
  }

  pendingUnitsKwh = +pendingUnitsKwh.toFixed(1);
  const pendingInr = Math.round(pendingUnitsKwh * tariff);
  const accruedPlusPendingKwh = +(confirmedUnitsKwh + pendingUnitsKwh).toFixed(1);
  const accruedPlusPendingInr = confirmedInr + pendingInr;

  const avgCyclePace =
    dc.daysElapsedInCycle > 0
      ? accruedPlusPendingKwh / dc.daysElapsedInCycle
      : dc.dailyCycleAvgKwh;
  const projectedCycleUnitsKwh = +(
    accruedPlusPendingKwh +
    avgCyclePace * dc.daysRemainingInCycle
  ).toFixed(1);

  return {
    billingCycleDay: dc.billingCycleDay,
    cyclePeriodText: dc.cyclePeriodText,
    cycleStartYmd: dc.cycleStartYmd,
    cycleEndYmd: dc.cycleEndYmd,
    cycleTotalDays: dc.cycleTotalDays,
    daysElapsedInCycle: dc.daysElapsedInCycle,
    daysRemainingInCycle: dc.daysRemainingInCycle,
    confirmedUnitsKwh,
    confirmedInr,
    confirmedFormatted: formatINR(confirmedInr),
    pendingSyncDaysCount,
    pendingUnitsKwh,
    pendingInr,
    pendingLabels,
    accruedPlusPendingKwh,
    accruedPlusPendingInr,
    projectedCycleUnitsKwh,
    projectedCycleInr: Math.round(projectedCycleUnitsKwh * tariff),
  };
}
