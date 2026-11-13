import React from 'react';

export interface PerformanceKpiColumn {
  eyebrow: string;
  primary: string;
  primaryUnit?: string;
  primaryTone?: 'slate' | 'emerald' | 'sky' | 'amber' | 'rose';
  rightMeta?: string;
  subtitle: string;
  accentDot?: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
}

interface PerformanceKpiStripProps {
  columns: [
    PerformanceKpiColumn,
    PerformanceKpiColumn,
    PerformanceKpiColumn,
    PerformanceKpiColumn,
  ];
}

const DOT_CLASS: Record<NonNullable<PerformanceKpiColumn['accentDot']>, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
};

const TONE_CLASS: Record<NonNullable<PerformanceKpiColumn['primaryTone']>, string> = {
  slate: 'text-slate-900',
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
};

export const PerformanceKpiStrip: React.FC<PerformanceKpiStripProps> = ({ columns }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75 border-b border-slate-200/75 bg-slate-50/40">
      {columns.map((col, idx) => (
        <div
          key={`${col.eyebrow}-${idx}`}
          className="px-4 sm:px-5 py-3 flex flex-col justify-between gap-1 min-w-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
              {col.accentDot && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[col.accentDot]}`} />
              )}
              <span className="truncate">{col.eyebrow}</span>
            </span>
            {col.rightMeta && (
              <span className="text-[10.5px] font-semibold text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                {col.rightMeta}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className={`text-[18px] sm:text-[19px] font-extrabold tracking-tight tabular-nums whitespace-nowrap ${
                TONE_CLASS[col.primaryTone || 'slate']
              }`}
            >
              {col.primary}
            </span>
            {col.primaryUnit && (
              <span className="text-[11.5px] font-semibold text-slate-500 truncate">
                {col.primaryUnit}
              </span>
            )}
          </div>

          <div className="text-[11px] font-medium text-slate-500 tabular-nums truncate">
            {col.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
};
