import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DayComparisonCalendarDay,
  DayComparisonResponse,
  IstClockParts,
  TimescaleMode,
} from '@solar-track/core';
import {
  fetchDayComparisonCalendarMonth,
  fetchPastDayComparison,
} from '../../shared/api/dayComparisonFetcher';

interface UsePerformanceComparisonCacheParams {
  stationId: string;
  isCombined: boolean;
  timescale: TimescaleMode;
  selectedDate: string;
  compareDateYmd: string | null;
  todayYmd: string;
  istClock: IstClockParts;
  currentMonthDaysData: Array<{ day: number; yield: number }>;
  prevMonthDaysData: Array<{ index: number; value: number }>;
}

/**
 * Caches historical `/api/day-comparison` curves and calendar availability per month.
 */
export function usePerformanceComparisonCache({
  stationId,
  isCombined,
  timescale,
  selectedDate,
  compareDateYmd,
  todayYmd,
  istClock,
  currentMonthDaysData,
  prevMonthDaysData,
}: UsePerformanceComparisonCacheParams) {
  const [dayComparisonByYmd, setDayComparisonByYmd] = useState<Record<string, DayComparisonResponse>>({});
  const [attemptedComparisonYmd, setAttemptedComparisonYmd] = useState<Record<string, boolean>>({});
  const [fetchedMonthAvailability, setFetchedMonthAvailability] = useState<
    Record<string, DayComparisonCalendarDay[]>
  >({});

  const monthAvailabilityByYm = useMemo<Record<string, DayComparisonCalendarDay[]>>(() => {
    const merged: Record<string, DayComparisonCalendarDay[]> = { ...fetchedMonthAvailability };
    if (prevMonthDaysData.length > 0) {
      const prevMonthDate = new Date(Date.UTC(istClock.year, istClock.month - 2, 1));
      const prevYm = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
      merged[prevYm] = prevMonthDaysData.map((d) => ({
        ymd: `${prevYm}-${String(d.index).padStart(2, '0')}`,
        day: d.index,
        kwh: Number(d.value) || 0,
      }));
    }
    if (currentMonthDaysData.length > 0) {
      merged[istClock.ym] = currentMonthDaysData.map((d) => ({
        ymd: `${istClock.ym}-${String(d.day).padStart(2, '0')}`,
        day: d.day,
        kwh: d.yield,
      }));
    }
    return merged;
  }, [fetchedMonthAvailability, prevMonthDaysData, currentMonthDaysData, istClock.year, istClock.month, istClock.ym]);

  const requestMonthAvailability = useCallback(
    (ym: string) => {
      if (isCombined || monthAvailabilityByYm[ym]) return;
      fetchDayComparisonCalendarMonth(stationId, selectedDate, ym).then((cal) => {
        if (cal) {
          setFetchedMonthAvailability((prev) => ({ ...prev, [cal.ym]: cal.days }));
        }
      });
    },
    [isCombined, stationId, selectedDate, monthAvailabilityByYm],
  );

  useEffect(() => {
    if (isCombined || timescale !== 'day') return;

    const targets: string[] = [];
    if (selectedDate !== todayYmd && !dayComparisonByYmd[selectedDate] && !attemptedComparisonYmd[selectedDate]) {
      targets.push(selectedDate);
    }
    if (
      compareDateYmd &&
      compareDateYmd !== todayYmd &&
      !dayComparisonByYmd[compareDateYmd] &&
      !attemptedComparisonYmd[compareDateYmd]
    ) {
      targets.push(compareDateYmd);
    }
    if (targets.length === 0) return;

    let cancelled = false;
    Promise.all(
      targets.map((ymd) => fetchPastDayComparison(stationId, ymd, false).then((res) => ({ ymd, res }))),
    ).then((results) => {
      if (cancelled) return;
      setAttemptedComparisonYmd((prev) => {
        const next = { ...prev };
        for (const t of targets) next[t] = true;
        return next;
      });
      setDayComparisonByYmd((prev) => {
        const next = { ...prev };
        for (const { ymd, res } of results) {
          if (res && res.errno === 0) next[ymd] = res;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isCombined, timescale, selectedDate, compareDateYmd, todayYmd, stationId, dayComparisonByYmd, attemptedComparisonYmd]);

  const isFetchingComparison =
    !isCombined &&
    timescale === 'day' &&
    ((selectedDate !== todayYmd && !dayComparisonByYmd[selectedDate] && !attemptedComparisonYmd[selectedDate]) ||
      Boolean(
        compareDateYmd &&
          compareDateYmd !== todayYmd &&
          !dayComparisonByYmd[compareDateYmd] &&
          !attemptedComparisonYmd[compareDateYmd],
      ));

  return {
    dayComparisonByYmd,
    monthAvailabilityByYm,
    requestMonthAvailability,
    isFetchingComparison,
  };
}
