import React from 'react';
import type {
  PerformanceYearMonthItem,
  StagePlotLayout,
} from './performanceStageTypes';

interface PerformanceYearBarsSvgProps {
  animGeneration: string;
  layout: StagePlotLayout;
  yearMonths: PerformanceYearMonthItem[];
  yMaxYearKwh: number;
  yearTicks: number[];
  hoveredYearIdx: number | null;
  onHoverYearIdx: (idx: number | null) => void;
  onSelectMonth: (ym: string) => void;
}

/**
 * Renders the 12-month Annual Progression bar group with Pre-Install vs Active differentiation.
 */
export const PerformanceYearBarsSvg: React.FC<PerformanceYearBarsSvgProps> = ({
  animGeneration,
  layout,
  yearMonths,
  yMaxYearKwh,
  yearTicks,
  hoveredYearIdx,
  onHoverYearIdx,
  onSelectMonth,
}) => {
  const { isCompact, plotLeft, plotRight, plotW, topY, baselineY, plotH } = layout;
  const yearKwhToY = (kwh: number) =>
    baselineY - (Math.max(0, Math.min(yMaxYearKwh, kwh)) / yMaxYearKwh) * plotH;

  const slotW = plotW / 12;
  const barW = Math.max(12, Math.min(38, slotW * 0.56));

  return (
    <g>
      {yearTicks.map((val) => {
        const yPos = yearKwhToY(val);
        return (
          <g key={`yr-y-${val}`}>
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
              {val}
            </text>
          </g>
        );
      })}

      {yearMonths.map((m, idx) => {
        const cx = plotLeft + (idx + 0.5) * slotW;
        const barY = yearKwhToY(m.realKwh);
        const barH = Math.max(0, baselineY - barY);
        const isHovered = hoveredYearIdx === idx;
        const canDrill = !m.isPreCommissioning && !m.isFutureMonth;

        return (
          <g
            key={`${m.ym}-${animGeneration}`}
            data-perf-year-ym={m.ym}
            onMouseEnter={() => onHoverYearIdx(idx)}
            onPointerEnter={() => onHoverYearIdx(idx)}
            onClick={() => {
              if (canDrill) onSelectMonth(m.ym);
            }}
            className={canDrill ? 'cursor-pointer' : 'cursor-default'}
          >
            <rect
              x={cx - slotW / 2}
              y={topY}
              width={slotW}
              height={plotH + 26}
              fill={isHovered ? '#F8FAFC' : 'transparent'}
            />

            {m.isPreCommissioning ? (
              <g>
                <rect
                  x={cx - barW / 2}
                  y={baselineY - 3}
                  width={barW}
                  height={3}
                  rx="1.5"
                  fill="#E2E8F0"
                />
                {!isCompact && (
                  <text
                    x={cx}
                    y={baselineY - 9}
                    textAnchor="middle"
                    fill="#CBD5E1"
                    fontSize="8.5"
                    fontWeight="600"
                  >
                    Pre
                  </text>
                )}
              </g>
            ) : m.realKwh > 0.05 ? (
              <g
                style={{
                  transformOrigin: `${cx}px ${baselineY}px`,
                  animation: `perfBarRise 420ms cubic-bezier(0.22, 1, 0.36, 1) ${idx * 20}ms both`,
                }}
              >
                <rect
                  x={cx - barW / 2}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx="4"
                  fill={m.isPartialCommissioning ? '#10B981' : '#059669'}
                  opacity={isHovered ? 1 : 0.9}
                />
                <text
                  x={cx}
                  y={barY - 6}
                  textAnchor="middle"
                  fill="#0F172A"
                  fontSize="10"
                  fontWeight="700"
                  className="tabular-nums"
                >
                  {Math.round(m.realKwh)}
                </text>
              </g>
            ) : (
              <rect
                x={cx - barW / 2}
                y={baselineY - 3}
                width={barW}
                height={3}
                rx="1.5"
                fill="#F1F5F9"
              />
            )}

            <text
              x={cx}
              y={baselineY + 17}
              textAnchor="middle"
              fill={m.isPreCommissioning ? '#94A3B8' : isHovered ? '#0F172A' : '#475569'}
              fontSize={isCompact ? '9.5' : '10.5'}
              fontWeight={canDrill ? '700' : '500'}
            >
              {m.shortMonth}
            </text>
          </g>
        );
      })}
    </g>
  );
};
