import type { DayComparisonCalendarDay, DayComparisonResponse } from '@solar-track/core';
import { ApiService } from './solarApi';

export async function fetchDayComparisonCalendarMonth(
  stationId: string,
  referenceYmd: string,
  ym: string
): Promise<{ ym: string; days: DayComparisonCalendarDay[] } | null> {
  if (!stationId || !ym) return null;
  try {
    const res = await ApiService.getDayComparison(stationId, referenceYmd, {
      calendarMonth: ym,
      calendarOnly: true,
    });
    if (res?.errno === 0 && res.calendar?.ym) {
      return { ym: res.calendar.ym, days: res.calendar.days || [] };
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch calendar month availability:', err);
    return null;
  }
}

export async function fetchPastDayComparison(
  stationId: string,
  ymd: string,
  forceRefresh: boolean
): Promise<DayComparisonResponse | null> {
  if (!stationId || !ymd) return null;
  try {
    const res = await ApiService.getDayComparison(
      stationId,
      ymd,
      forceRefresh ? { force: true } : undefined
    );
    return res?.errno === 0 ? res : null;
  } catch {
    return null;
  }
}
