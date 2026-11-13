import type { ChartData } from 'chart.js';
import { cleanDayCurveGaps, type RawSeries, type TableRowData, type TimescaleMode } from '@solar-track/core';

export interface HistoryViewPayload {
  chartData: ChartData<'line' | 'bar'>;
  tableRows: TableRowData[];
  peakTimeText: string;
}

export interface TelemetryCsvExportPayload {
  filename?: string;
  headers: string[];
  rows: string[][];
}

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Scans a cleaned power curve array and formats the peak solar timestamp in 12h clock. */
export function extractPeakTimeText(points: Array<{ time?: string; value?: number }>): string {
  if (!Array.isArray(points) || points.length === 0) return '(Solar Noon Est.)';
  let maxPt = points[0];
  for (const pt of points) {
    if ((Number(pt?.value) || 0) > (Number(maxPt?.value) || 0)) maxPt = pt;
  }
  if (!maxPt || (Number(maxPt.value) || 0) <= 0.05) return '(Solar Noon Est.)';

  const timeStr = String(maxPt.time || '');
  const timePart = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr, 10);
  if (!Number.isFinite(h)) return '(Solar Noon Est.)';
  const min = (mStr || '00').slice(0, 2);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `at ${String(h12).padStart(2, '0')}:${min} ${ampm}`;
}

/** Builds chart, table, and peak metadata from a single plant's 5-minute raw curve. */
export function buildDayHistoryView(
  rawSeries: RawSeries[],
  selectedDateYmd: string,
  proMode: boolean,
): HistoryViewPayload {
  const genS = rawSeries.find((s) => s.variable === 'generationPower') || { data: [] };
  const pvS = rawSeries.find((s) => s.variable === 'pvPower') || { data: [] };
  const feedS = rawSeries.find((s) => s.variable === 'feedinPower') || { data: [] };

  const cleanedGen = cleanDayCurveGaps(Array.isArray(genS.data) ? genS.data : []);
  const cleanedPv = cleanDayCurveGaps(Array.isArray(pvS.data) ? pvS.data : []);
  const feedData = Array.isArray(feedS.data) ? feedS.data : [];

  const labels = cleanedGen.map((pt) => {
    const t = String(pt?.time || '');
    return (t.split(' ')[1] || t).slice(0, 5);
  });
  const genVals = cleanedGen.map((pt) => Number(pt?.value) || 0);
  const pvVals = cleanedPv.map((pt) => Number(pt?.value) || 0);
  const feedVals = feedData.map((pt) => Number(pt?.value) || 0);

  const datasets: ChartData<'line' | 'bar'>['datasets'] = [
    {
      type: 'line',
      label: 'Inverter AC Output (kW)',
      data: genVals,
      borderColor: '#107C41',
      backgroundColor: 'rgba(16, 124, 65, 0.08)',
      fill: true,
      borderWidth: 2.5,
      tension: 0.35,
      pointRadius: genVals.length > 50 ? 1 : 2,
    },
  ];

  if (proMode) {
    datasets.push({
      type: 'line',
      label: 'Solar PV DC Power (kW)',
      data: pvVals,
      borderColor: '#D97706',
      borderWidth: 1.5,
      borderDash: [4, 4],
      tension: 0.35,
      pointRadius: 0,
    });
  }

  const tableRows: TableRowData[] = cleanedGen.map((item, i) => ({
    time: String(item.time || selectedDateYmd),
    output: `${(Number(item.value) || 0).toFixed(3)} kW`,
    pv: `${(pvVals[i] || 0).toFixed(3)} kW`,
    feedin: `${(feedVals[i] || 0).toFixed(3)} kW`,
    status: item.value > 0 ? (item.isInterpolated ? 'Interpolated (Wi-Fi Gap)' : 'Generating') : 'Standby',
  }));

  return {
    chartData: { labels, datasets },
    tableRows,
    peakTimeText: extractPeakTimeText(cleanedGen),
  };
}

/** Builds chart, table, and peak metadata from a combined multi-plant curve. */
export function buildCombinedDayHistoryView(
  cleanedMerged: Array<{ time: string; value: number; isInterpolated?: boolean }>,
  selectedDateYmd: string,
): HistoryViewPayload {
  const labels = cleanedMerged.map((pt) => pt.time);
  const values = cleanedMerged.map((pt) => pt.value);

  return {
    chartData: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Combined Solar Output (kW)',
          data: values,
          borderColor: '#107C41',
          backgroundColor: 'rgba(16, 124, 65, 0.08)',
          fill: true,
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: values.length > 50 ? 1 : 2,
        },
      ],
    },
    tableRows: cleanedMerged.map((m) => ({
      time: `${selectedDateYmd} ${m.time}`,
      output: `${m.value.toFixed(3)} kW`,
      pv: '---',
      feedin: '---',
      status: m.value > 0 ? (m.isInterpolated ? 'Interpolated (Wi-Fi Gap)' : 'Generating') : 'Standby',
    })),
    peakTimeText: extractPeakTimeText(cleanedMerged),
  };
}

/** Builds monthly bar chart and ledger rows from day-level totals. */
export function buildMonthHistoryView(
  dayPairs: Array<{ day: number; yield: number }>,
  selectedMonthYm: string,
  shouldUseCombined: boolean,
  currentYm: string,
  currentDay: number,
  todayEstKwh?: number,
): {
  chartData: ChartData<'line' | 'bar'>;
  tableRows: TableRowData[];
} {
  const dayTotals = new Map<number, number>();
  for (const pair of dayPairs) {
    dayTotals.set(pair.day, Number(pair.yield) || 0);
  }
  const sortedDays = Array.from(dayTotals.keys()).sort((a, b) => a - b);
  let labels = sortedDays.map((d) => `Day ${d}`);
  let values = sortedDays.map((d) => dayTotals.get(d) || 0);
  let backgroundColors: string[] = values.map((v) =>
    v < 8.0 && v > 0 ? '#F59E0B' : v > 0 ? '#107C41' : '#E5E7EB',
  );

  if (
    selectedMonthYm === currentYm &&
    !sortedDays.includes(currentDay) &&
    typeof todayEstKwh === 'number'
  ) {
    labels = [...labels, `Day ${currentDay} (Est.)`];
    values = [...values, parseFloat(todayEstKwh.toFixed(1))];
    backgroundColors = [...backgroundColors, 'rgba(245, 158, 11, 0.45)'];
  }

  return {
    chartData: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: shouldUseCombined
            ? 'Combined Fleet Daily Yield (kWh)'
            : 'Daily Solar Generation (kWh)',
          data: values,
          backgroundColor: backgroundColors,
          borderRadius: 6,
        },
      ],
    },
    tableRows: sortedDays.map((d) => ({
      time: `${selectedMonthYm}-${String(d).padStart(2, '0')}`,
      output: `${(dayTotals.get(d) || 0).toFixed(2)} kWh`,
      pv: '---',
      feedin: '---',
      status: (dayTotals.get(d) || 0) > 0 ? 'Production OK' : 'No Yield',
    })),
  };
}

/** Builds annual 12-month bar chart, normalized month items, and table rows. */
export function buildYearHistoryView(
  monthTotals: Map<number, number>,
  activeYear: number,
  shouldUseCombined: boolean,
): {
  months: Array<{ month: number; ym: string; label: string; realKwh: number }>;
  chartData: ChartData<'line' | 'bar'>;
  tableRows: TableRowData[];
} {
  const sortedMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const labels = sortedMonths.map((m) => MONTH_SHORT_NAMES[m - 1]);
  const values = sortedMonths.map((m) => monthTotals.get(m) || 0);

  return {
    months: sortedMonths.map((m) => ({
      month: m,
      ym: `${activeYear}-${String(m).padStart(2, '0')}`,
      label: `${MONTH_SHORT_NAMES[m - 1]} ${activeYear}`,
      realKwh: parseFloat((monthTotals.get(m) || 0).toFixed(2)),
    })),
    chartData: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: shouldUseCombined
            ? `Combined Fleet ${activeYear} Monthly Yield (kWh)`
            : `${activeYear} Monthly Solar Yield (kWh)`,
          data: values,
          backgroundColor: values.map((v) => (v > 0 ? '#107C41' : '#E5E7EB')),
          borderRadius: 6,
        },
      ],
    },
    tableRows: sortedMonths.map((m) => ({
      time: `${MONTH_SHORT_NAMES[m - 1]} ${activeYear}`,
      output: `${(monthTotals.get(m) || 0).toFixed(2)} kWh`,
      pv: '---',
      feedin: '---',
      status: (monthTotals.get(m) || 0) > 0 ? 'Active Production' : 'Pre-Commissioning',
    })),
  };
}

/** Triggers a browser CSV download from either custom period rows or active table rows. */
export function exportTelemetryCsv(
  activeContext: string,
  timescale: TimescaleMode,
  tableRows: TableRowData[],
  customPayload?: TelemetryCsvExportPayload,
): void {
  const escapeCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  let headers: string[];
  let dataRows: string[][];
  let filename = `solartrack_${activeContext}_${timescale}.csv`;

  if (customPayload && customPayload.rows.length > 0) {
    headers = customPayload.headers;
    dataRows = customPayload.rows;
    if (customPayload.filename) filename = customPayload.filename;
  } else {
    if (tableRows.length === 0) {
      alert('No telemetry records available to export.');
      return;
    }
    headers = ['Timestamp', 'Generation_Output', 'PV_DC_Power', 'Grid_Export', 'Status'];
    dataRows = tableRows.map((r) => [r.time, r.output, r.pv, r.feedin, r.status]);
  }

  let csv = headers.map(escapeCell).join(',') + '\n';
  for (const row of dataRows) {
    csv += row.map(escapeCell).join(',') + '\n';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
