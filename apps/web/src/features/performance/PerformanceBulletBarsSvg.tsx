import React from 'react';
import type {
  PerformanceBulletBarItem,
  StagePlotLayout,
} from './performanceStageTypes';

interface PerformanceBulletBarsSvgProps {
  uid: string;
  animGeneration: string;
  timescale: 'week' | 'month';
  layout: StagePlotLayout;
  bulletBars: PerformanceBulletBarItem[];
  yMaxKwh: number;
  kwhTicks: number[];
  monthAvgKwh: number | null;
  showClearSkyTicks: boolean;
  showPriorWeekOverlay: boolean;
  showCaptureLineOverlay: boolean;
  activeHoveredBarYmd: string | null;
  onHoverBarYmd: (ymd: string | null) => void;
  onSelectDay: (ymd: string) => void;
}

/**
 * Renders Week & Month nested bullet bars, outage buffers, model target ticks,
 * monthly average guideline, prior-7d polyline, and capture % polyline.
 */
export const PerformanceBulletBarsSvg: React.FC<PerformanceBulletBarsSvgProps> = ({
  uid: _uid,
  animGeneration,
  timescale,
  layout,
  bulletBars,
  yMaxKwh,
  kwhTicks,
  monthAvgKwh,
  showClearSkyTicks: _showClearSkyTicks,
  showPriorWeekOverlay,
  showCaptureLineOverlay,
  activeHoveredBarYmd,
  onHoverBarYmd,
  onSelectDay,
}) => {
  const { isCompact, plotLeft, plotRight, plotW, topY, baselineY, plotH } = layout;
  const kwhToY = (kwh: number) => baselineY - (Math.max(0, Math.min(yMaxKwh, kwh)) / yMaxKwh) * plotH;

  const n = Math.max(1, bulletBars.length);
  const slotW = plotW / n;
  // Apple Minimalist Rounded Capsule Geometry: unified bar width with soft background track
  const barW =
    timescale === 'week'
      ? Math.max(16, Math.min(32, slotW * 0.42))
      : Math.max(6, Math.min(14, slotW * 0.54));
  const barRx = Math.min(barW / 2, 7);

  const priorWeekPts =
    timescale === 'week' && showPriorWeekOverlay
      ? bulletBars
          .map((b, idx) =>
            typeof b.prevPeriodKwh === 'number' && b.prevPeriodKwh > 0
              ? { x: +(plotLeft + (idx + 0.5) * slotW).toFixed(1), y: +kwhToY(b.prevPeriodKwh).toFixed(1) }
              : null,
          )
          .filter((p): p is { x: number; y: number } => p !== null)
      : [];

  const captureLinePts =
    timescale === 'month' && showCaptureLineOverlay
      ? bulletBars
          .map((b, idx) =>
            b.capturePct !== null && b.isConfirmed
              ? {
                  x: +(plotLeft + (idx + 0.5) * slotW).toFixed(1),
                  y: +(baselineY - (Math.min(140, Math.max(0, b.capturePct)) / 140) * plotH).toFixed(1),
                }
              : null,
          )
          .filter((p): p is { x: number; y: number } => p !== null)
      : [];

  return (
    <g>
      {kwhTicks.map((val) => {
        const yPos = kwhToY(val);
        return (
          <g key={`wk-y-${val}`}>
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={yPos}
              y2={yPos}
              stroke={val === 0 ? '#CBD5E1' : '#F1F5F9'}
              strokeWidth={val === 0 ? 1.25 : 1}
              strokeDasharray={val === 0 ? undefined : '4 4'}
            />
            <text
              x={plotLeft - 8}
              y={yPos + 3.5}
              textAnchor="end"
              fill="#94A3B8"
              fontSize={isCompact ? '9.5' : '10.5'}
              fontWeight="600"
              className="tabular-nums"
            >
              {val.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Right Capture % Axis in Month mode */}
      {timescale === 'month' && showCaptureLineOverlay && (
        <>
          {[0, 50, 100, 125].map((pct) => {
            const yP = baselineY - (pct / 140) * plotH;
            return (
              <text
                key={`pct-${pct}`}
                x={plotRight + 6}
                y={yP + 3}
                textAnchor="start"
                fill="#6366F1"
                fontSize="9.5"
                fontWeight="600"
                className="tabular-nums"
              >
                {pct}%
              </text>
            );
          })}
        </>
      )}

      {/* Dashed Horizontal Monthly Average Line */}
      {timescale === 'month' && monthAvgKwh !== null && monthAvgKwh > 0.2 && (
        <g className="pointer-events-none">
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={kwhToY(monthAvgKwh)}
            y2={kwhToY(monthAvgKwh)}
            stroke="#475569"
            strokeOpacity="0.65"
            strokeWidth="1.25"
            strokeDasharray="6 4"
          />
          <text
            x={plotRight - 4}
            y={kwhToY(monthAvgKwh) - 5}
            textAnchor="end"
            fill="#475569"
            fontSize="10"
            fontWeight="700"
            className="tabular-nums"
          >
            Avg {monthAvgKwh.toFixed(1)} kWh
          </text>
        </g>
      )}

      {/* Nested Bullet Bars */}
      {bulletBars.map((b, idx) => {
        const cx = plotLeft + (idx + 0.5) * slotW;
        const envY = kwhToY(b.modelKwh);
        const envH = Math.max(0, baselineY - envY);
        const realY = kwhToY(b.realKwh);
        const realH = Math.max(0, baselineY - realY);
        const isHovered = activeHoveredBarYmd === b.ymd;
        const staggerMs = Math.min(280, idx * (timescale === 'week' ? 28 : 12));

        return (
          <g
            key={`${b.ymd}-${animGeneration}`}
            data-perf-bar-ymd={b.ymd}
            onMouseEnter={() => onHoverBarYmd(b.ymd)}
            onPointerEnter={() => onHoverBarYmd(b.ymd)}
            onClick={() => {
              if (!b.isFuture) onSelectDay(b.ymd);
            }}
            className={b.isFuture ? 'cursor-default' : 'cursor-pointer'}
          >
            <rect
              x={cx - slotW / 2}
              y={topY}
              width={slotW}
              height={plotH + 26}
              fill={isHovered ? '#F8FAFC' : 'transparent'}
            />

            <g
              style={{
                transformOrigin: `${cx}px ${baselineY}px`,
                animation: `perfBarRise 420ms cubic-bezier(0.22, 1, 0.36, 1) ${staggerMs}ms both`,
              }}
            >
              {/* Apple Minimalist Background Track: Benchmark potential */}
              {b.modelKwh > 0.05 && !b.isFuture && (
                <rect
                  x={cx - barW / 2}
                  y={envY}
                  width={barW}
                  height={envH}
                  rx={barRx}
                  fill={isHovered ? '#E2E8F0' : '#F1F5F9'}
                  className="transition-colors duration-150"
                />
              )}

              {/* Apple Minimalist Generation Capsule */}
              {b.realKwh > 0.05 && !b.isFuture && (
                <rect
                  x={cx - barW / 2}
                  y={realY}
                  width={barW}
                  height={realH}
                  rx={barRx}
                  fill={
                    b.isToday
                      ? '#10B981'
                      : b.capturePct !== null && b.capturePct >= 85
                        ? '#10B981'
                        : b.capturePct !== null && b.capturePct >= 65
                          ? '#F59E0B'
                          : '#F43F5E'
                  }
                  opacity={isHovered ? 1 : 0.94}
                  style={{ transition: 'height 240ms ease, y 240ms ease' }}
                />
              )}

              {/* Gentle indicator when today is live in progress */}
              {b.isToday && b.realKwh > 0.05 && (
                <circle
                  cx={cx}
                  cy={realY + barRx}
                  r={Math.min(2.5, barW * 0.22)}
                  fill="#FFFFFF"
                  opacity={0.9}
                />
              )}
            </g>

            {(timescale === 'week' || !isCompact || idx % 3 === 0 || idx === bulletBars.length - 1) && (
              <text
                x={cx}
                y={baselineY + 17}
                textAnchor="middle"
                fill={b.isToday ? '#059669' : isHovered ? '#0F172A' : '#64748B'}
                fontSize={timescale === 'week' ? '10.5' : isCompact ? '8.5' : '9.5'}
                fontWeight={b.isToday || isHovered ? '700' : '600'}
                className="tabular-nums"
              >
                {b.axisLabel}
              </text>
            )}
          </g>
        );
      })}

      {/* Optional Prior-7-Days Polyline in Week Mode */}
      {priorWeekPts.length >= 2 && (
        <g className="pointer-events-none">
          <path
            d={priorWeekPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#6366F1"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
          {priorWeekPts.map((p, i) => (
            <circle
              key={`pw-${i}`}
              cx={p.x}
              cy={p.y}
              r="3.2"
              fill="#6366F1"
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
          ))}
        </g>
      )}

      {/* Optional Capture % Polyline in Month Mode */}
      {captureLinePts.length >= 2 && (
        <g className="pointer-events-none">
          <path
            d={captureLinePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#6366F1"
            strokeWidth="1.8"
            strokeDasharray="2.5 3"
            strokeLinecap="round"
          />
          {captureLinePts.map((p, i) => (
            <circle
              key={`cp-${i}`}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="#6366F1"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          ))}
        </g>
      )}
    </g>
  );
};
