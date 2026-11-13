import { cleanDayCurveGaps, type Plant, type TimescaleMode } from '@solar-track/core';
import { ApiService } from './solarApi';
import {
  buildCombinedDayHistoryView,
  buildMonthHistoryView,
  buildYearHistoryView,
  type HistoryViewPayload,
} from '../utils/historyViewBuilders';

const DEFAULT_STATION_ID = '';

export interface HistoryFetchArgs {
  key: string;
  effectiveContext: string;
  isCombined: boolean;
  timescale: TimescaleMode;
  selectedDate: string;
  selectedMonth: string;
  selectedYear: number;
  allPlantsList: Plant[];
  currentYm: string;
  currentDay: number;
  currentYear: number;
  todayEstKwh?: number;
}

export interface HistoryFetchResult {
  key: string;
  view?: HistoryViewPayload;
  combinedDayRaw?: Array<{ time: string; value: number; isInterpolated?: boolean }>;
  monthDaysState?: { ym: string; days: Array<{ day: number; yield: number }> };
  syncCurrentMonthDays?: Array<{ day: number; yield: number }>;
  yearMonthsState?: {
    year: number;
    months: Array<{ month: number; ym: string; label: string; realKwh: number }>;
  };
}

/** Fetches historical telemetry from backend APIs and formats pure view payloads. */
export async function fetchHistoryViewBundle(args: HistoryFetchArgs): Promise<HistoryFetchResult> {
  const {
    key,
    effectiveContext,
    isCombined,
    timescale,
    selectedDate,
    selectedMonth,
    selectedYear,
    allPlantsList,
    currentYm,
    currentDay,
    currentYear,
    todayEstKwh,
  } = args;

  if (timescale === 'week') {
    return { key };
  }

  if (timescale === 'day') {
    if (!isCombined) return { key };
    const [y, m, d] = selectedDate.split('-').map(Number);
    const merged = await ApiService.getCombinedRaw({ year: y, month: m, day: d });
    const cleanedMerged = cleanDayCurveGaps(merged.map((pt) => ({ time: pt.time, value: pt.combined })));
    return {
      key,
      combinedDayRaw: cleanedMerged,
      view: buildCombinedDayHistoryView(cleanedMerged, selectedDate),
    };
  }

  const plantsToQuery = isCombined
    ? allPlantsList.length > 0
      ? allPlantsList
      : [{ stationID: DEFAULT_STATION_ID }]
    : [{ stationID: effectiveContext }];

  if (timescale === 'month') {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dayTotals = new Map<number, number>();
    await Promise.all(
      plantsToQuery.map(async (p) => {
        try {
          const reports = await ApiService.getPlantHistory(p.stationID, 'month', { year: y, month: m });
          const genObj = reports.find((r) => r.variable === 'generation');
          genObj?.data?.forEach((d) => {
            const prev = dayTotals.get(d.index) || 0;
            dayTotals.set(d.index, parseFloat((prev + (d.value || 0)).toFixed(2)));
          });
        } catch (err) {
          console.error('Error fetching plant history:', err);
        }
      }),
    );

    const sortedDays = Array.from(dayTotals.keys()).sort((a, b) => a - b);
    const dayPairs = sortedDays.map((d) => ({ day: d, yield: dayTotals.get(d) || 0 }));
    const monthView = buildMonthHistoryView(
      dayPairs,
      selectedMonth,
      isCombined,
      currentYm,
      currentDay,
      todayEstKwh,
    );
    return {
      key,
      monthDaysState: { ym: selectedMonth, days: dayPairs },
      syncCurrentMonthDays: selectedMonth === currentYm ? dayPairs : undefined,
      view: { ...monthView, peakTimeText: '(Solar Noon Est.)' },
    };
  }

  const monthTotals = new Map<number, number>();
  const activeYear = selectedYear || currentYear;
  await Promise.all(
    plantsToQuery.map(async (p) => {
      try {
        const reports = await ApiService.getPlantHistory(p.stationID, 'year', { year: activeYear });
        const genObj = reports.find((r) => r.variable === 'generation');
        genObj?.data?.forEach((d) => {
          const prev = monthTotals.get(d.index) || 0;
          monthTotals.set(d.index, parseFloat((prev + (d.value || 0)).toFixed(2)));
        });
      } catch (err) {
        console.error('Error fetching plant yearly history:', err);
      }
    }),
  );

  const yearView = buildYearHistoryView(monthTotals, activeYear, isCombined);
  return {
    key,
    yearMonthsState: { year: activeYear, months: yearView.months },
    view: {
      chartData: yearView.chartData,
      tableRows: yearView.tableRows,
      peakTimeText: '(Solar Noon Est.)',
    },
  };
}
