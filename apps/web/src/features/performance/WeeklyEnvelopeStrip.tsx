import React, { useId } from 'react';
import {
  buildDaySparkPoints,
  formatIndianDate,
  formatWeekdayShort,
  getDipCategoryBarColor,
  type DailyPerformanceLedgerEntry,
  type RawSeries,
} from '@solar-track/core';

export interface WeekSparkDayItem {
  ymd: string;
  ledgerEntry?: DailyPerformanceLedgerEntry | null;
  rawSeries?: RawSeries[] | null;
  hourlyGti?: number[];
  sunriseMin: number;
  sunsetMin: number;
  eepromKwh?: number;
  isToday: boolean;
}

interface WeeklyEnvelopeStripProps {
  days: WeekSparkDayItem[];
  hoveredYmd: string | null;
  onHoverYmd: (ymd: string | null) => void;
  onSelectDay: (ymd: string) => void;
}

function toPolylinePath(pts: Array<{ t: number; v: number }>, w: number, h: number, padX = 2, padY = 4): string {
  if (pts.length === 0) return '';
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  return pts
    .map((p, idx) => {
      const x = +(padX + p.t * innerW).toFixed(1);
      const y = +(padY + (1 - p.v) * innerH).toFixed(1);
      return `${idx === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');
}

function toAreaPath(pts: Array<{ t: number; v: number }>, w: number, h: number, padX = 2, padY = 4): string {
  if (pts.length === 0) return '';
  const line = toPolylinePath(pts, w, h, padX, padY);
  const firstX = +(padX + pts[0].t * (w - padX * 2)).toFixed(1);
  const lastX = +(padX + pts[pts.length - 1].t * (w - padX * 2)).toFixed(1);
  const base = h - padY;
  return `${line} L ${lastX},${base} L ${firstX},${base} Z`;
}

function getCleanWeatherLabel(
  entry?: DailyPerformanceLedgerEntry | null,
  fallbackLabel?: string,
  isToday?: boolean,
  capturePct?: number | null,
): string {
  if (isToday) return 'Live today';
  if (!entry) return fallbackLabel || 'Verified';

  const cat = (entry.dipCategory || '').toLowerCase();
  const raw = (entry.dipReasonLabel || '').toLowerCase();

  if (raw.includes('normal solar') || cat === 'optimal' || (capturePct != null && capturePct >= 88)) {
    return 'Sunny & Clear';
  }
  if (cat === 'cloud' || raw.includes('cloud') || raw.includes('rain')) {
    return 'Passing Clouds';
  }
  if (cat === 'fog' || cat === 'haze' || raw.includes('haze') || raw.includes('fog') || raw.includes('smog')) {
    return 'Morning Haze';
  }
  if (cat === 'outage' || cat === 'gap' || raw.includes('telemetry') || raw.includes('outage') || raw.includes('cut')) {
    return 'Partial Sync';
  }
  if (cat === 'soiling' || raw.includes('dust') || raw.includes('soiling')) {
    return 'Dust Impact';
  }
  if (capturePct != null && capturePct >= 75) {
    return 'Good Sunlight';
  }
  return 'Mixed Weather';
}

export const WeeklyEnvelopeStrip: React.FC<WeeklyEnvelopeStripProps> = ({
  days,
  hoveredYmd,
  onHoverYmd,
  onSelectDay,
}) => {
  const uid = useId().replace(/:/g, '');
  const sparkW = 112;
  const sparkH = 42;

  return (
    <div className="border-t border-slate-200/75 bg-slate-50/35 rounded-b-3xl overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75">
        {days.map((item) => {
          const entry = item.ledgerEntry;
          const realKwh =
            typeof item.eepromKwh === 'number' && item.eepromKwh > 0
              ? item.eepromKwh
              : Number(entry?.realKwh || 0);
          const modelKwh = Number(entry?.modeledAfterSoilingKwh || 0);
          const capturePct =
            entry?.realVsModelPct ??
            (modelKwh > 0.2 && realKwh > 0 ? Math.round((realKwh / modelKwh) * 100) : null);

          const spark = buildDaySparkPoints({
            rawSeries: item.rawSeries,
            sunriseMin: item.sunriseMin,
            sunsetMin: item.sunsetMin,
            hourlyGti: item.hourlyGti,
            targetRealKwh: realKwh,
            targetModelKwh: modelKwh,
          });

          const palette = getDipCategoryBarColor(entry?.dipCategory);
          const isHovered = hoveredYmd === item.ymd;
          const realLine = toPolylinePath(spark.realNormPoints, sparkW, sparkH);
          const realArea = toAreaPath(spark.realNormPoints, sparkW, sparkH);
          const modelLine = toPolylinePath(spark.modelNormPoints, sparkW, sparkH);

          return (
            <button
              key={item.ymd}
              type="button"
              onMouseEnter={() => onHoverYmd(item.ymd)}
              onMouseLeave={() => onHoverYmd(null)}
              onClick={() => onSelectDay(item.ymd)}
              className={`group text-left px-3.5 py-3 transition-colors cursor-pointer flex flex-col justify-between gap-2 min-w-0 ${
                isHovered ? 'bg-white' : 'hover:bg-white/80'
              }`}
            >
              {/* Top: Weekday + Date + Dot */}
              <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: palette.fill }}
                  />
                  <span className="text-[11px] font-bold text-slate-700 truncate">
                    {formatWeekdayShort(item.ymd)} · {formatIndianDate(item.ymd, 'short')}
                  </span>
                </div>
                {item.isToday && (
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 shrink-0">
                    Live
                  </span>
                )}
              </div>

              {/* Middle: Real Telemetry or Scaled Hourly-GTI Envelope SVG */}
              <div className="w-full h-[42px] relative">
                <svg
                  viewBox={`0 0 ${sparkW} ${sparkH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id={`wkSparkGrad-${uid}-${item.ymd}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.fill} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={palette.fill} stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line
                    x1="2"
                    x2={sparkW - 2}
                    y1={sparkH - 4}
                    y2={sparkH - 4}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  {modelLine && (
                    <path
                      d={modelLine}
                      fill="none"
                      stroke="#0284C7"
                      strokeOpacity="0.45"
                      strokeWidth="1.25"
                      strokeDasharray="2.5 2.5"
                    />
                  )}
                  {realArea && (
                    <path
                      d={realArea}
                      fill={`url(#wkSparkGrad-${uid}-${item.ymd})`}
                    />
                  )}
                  {realLine && (
                    <path
                      d={realLine}
                      fill="none"
                      stroke={palette.fill}
                      strokeWidth={isHovered ? '2.1' : '1.75'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>

              {/* Bottom: Real kWh + Capture % + Honest Reason / Peak */}
              <div className="space-y-0.5 w-full min-w-0">
                <div className="flex items-baseline justify-between gap-1 tabular-nums">
                  <span className="text-[14px] font-extrabold text-slate-900">
                    {realKwh > 0 ? `${realKwh.toFixed(1)}` : '0.0'}{' '}
                    <span className="text-[10.5px] font-semibold text-slate-500">kWh</span>
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      capturePct === null
                        ? 'text-slate-400'
                        : capturePct >= 95
                          ? 'text-emerald-700'
                          : capturePct >= 70
                            ? 'text-sky-700'
                            : 'text-amber-700'
                    }`}
                  >
                    {capturePct !== null ? `${capturePct}%` : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 font-medium">
                  <span className="truncate">{getCleanWeatherLabel(entry, palette.label, item.isToday, capturePct)}</span>
                  <span className="tabular-nums shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors">
                    {spark.peakKw !== null
                      ? `${spark.peakKw.toFixed(1)} kW`
                      : modelKwh > 0
                        ? `~${modelKwh.toFixed(1)}`
                        : '—'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
