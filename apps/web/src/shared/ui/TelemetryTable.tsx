import React from 'react';
import type { TableRowData, TimescaleMode } from '@solar-track/core';

interface TelemetryTableProps {
  rows: TableRowData[];
  timescale?: TimescaleMode;
  onSelectDate?: (ymd: string) => void;
  onSelectMonth?: (ym: string) => void;
}

export const TelemetryTable: React.FC<TelemetryTableProps> = ({
  rows,
  timescale = 'day',
  onSelectDate,
  onSelectMonth,
}) => {
  const showModelCols = rows.some((r) => Boolean(r.model || r.capturePct || r.note));
  const showElectricalCols = timescale === 'day' || rows.some((r) => r.pv !== '---' || r.feedin !== '---');

  const getStatusBadgeClass = (status: string) => {
    const low = status.toLowerCase();
    if (low.includes('generating') || low.includes('on track') || low.includes('optimal') || low.includes('production ok') || low.includes('active')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
    }
    if (low.includes('cloud') || low.includes('rain')) {
      return 'bg-sky-50 text-sky-700 border-sky-200/70';
    }
    if (low.includes('fog') || low.includes('haze') || low.includes('interpolated') || low.includes('pending') || low.includes('telemetry')) {
      return 'bg-amber-50 text-amber-700 border-amber-200/70';
    }
    if (low.includes('outage') || low.includes('soiling') || low.includes('gap')) {
      return 'bg-rose-50 text-rose-700 border-rose-200/70';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200/70';
  };

  return (
    <div className="border-t border-slate-200/75 overflow-hidden">
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/80">
            <tr className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-4 whitespace-nowrap">
                {timescale === 'day' ? 'Timestamp (IST)' : timescale === 'year' ? 'Month' : 'Date'}
              </th>
              <th className="py-2.5 px-4 whitespace-nowrap text-right">
                {timescale === 'day' ? 'AC Output' : 'Real Yield'}
              </th>
              {showModelCols && (
                <>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Physics Model</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Capture</th>
                </>
              )}
              {showElectricalCols && (
                <>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">PV DC Power</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Grid Export</th>
                </>
              )}
              <th className="py-2.5 px-4 whitespace-nowrap">Status / Attribution</th>
              {showModelCols && (
                <th className="py-2.5 px-4 whitespace-nowrap hidden md:table-cell">Notes</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[12.5px] tabular-nums">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 px-4 text-center text-slate-400 text-xs font-medium"
                >
                  No telemetry log entries available for this selection.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const isClickableDate =
                  (timescale === 'week' || timescale === 'month') &&
                  /^\d{4}-\d{2}-\d{2}/.test(r.time) &&
                  Boolean(onSelectDate);
                const isClickableMonth =
                  timescale === 'year' &&
                  /^\d{4}-\d{2}$/.test(r.note || '') &&
                  Boolean(onSelectMonth);

                return (
                  <tr
                    key={`${r.time}-${idx}`}
                    onClick={() => {
                      if (isClickableDate && onSelectDate) {
                        onSelectDate(r.time.slice(0, 10));
                      } else if (isClickableMonth && onSelectMonth && r.note) {
                        onSelectMonth(r.note);
                      }
                    }}
                    className={`hover:bg-slate-50/90 transition-colors ${
                      isClickableDate || isClickableMonth ? 'cursor-pointer' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                      {r.time}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 text-right whitespace-nowrap">
                      {r.output}
                    </td>
                    {showModelCols && (
                      <>
                        <td className="py-2.5 px-4 font-medium text-sky-700 text-right whitespace-nowrap">
                          {r.model || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-700 text-right whitespace-nowrap">
                          {r.capturePct || '—'}
                        </td>
                      </>
                    )}
                    {showElectricalCols && (
                      <>
                        <td className="py-2.5 px-4 font-medium text-amber-700 text-right whitespace-nowrap">
                          {r.pv}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-emerald-700 text-right whitespace-nowrap">
                          {r.feedin}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getStatusBadgeClass(
                          r.status,
                        )}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    {showModelCols && (
                      <td className="py-2.5 px-4 text-[11.5px] text-slate-500 hidden md:table-cell">
                        {r.note || '—'}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
