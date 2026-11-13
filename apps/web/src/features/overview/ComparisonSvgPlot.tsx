import React from 'react';
import {
  formatIndianDate,
  formatMinutes12hUpper,
  type LiveNowcastResult,
  type ParsedDayTelemetry,
  type ReconstructedGapCurveResult,
  type XAxisClockTick,
} from '@solar-track/core';
import type {
  BridgedSegmentPath,
  ChartHoverDetails,
  RealSegmentPath,
} from './comparisonChartGeometry';

interface ComparisonSvgPlotProps {
  uid: string;
  plotContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedYmd: string;
  svgW: number;
  svgH: number;
  isCompact: boolean;
  plotLeft: number;
  plotRight: number;
  plotW: number;
  topY: number;
  baselineY: number;
  plotH: number;
  isTodaySelected: boolean;
  isNight: boolean;
  isTodayConfirmed: boolean;
  isDaytimeToday: boolean;
  isScrubbing: boolean;
  todayNowcast: LiveNowcastResult | null;
  sunX: number;
  sunY: number;
  sunLiveLabel: string;
  activeNowMinutes: number;
  realSegmentPaths: RealSegmentPath[];
  singleDotPoints: Array<{ x: number; y: number }>;
  bridgedSegmentPaths: BridgedSegmentPath[];
  calcAreaPath: string;
  calcLinePath: string;
  calcElapsedLinePath: string;
  purePhysicsRemainingPath: string;
  calcRemainingLinePath: string;
  yTicksKw: number[];
  xTicks: {
    edgeStart: XAxisClockTick;
    edgeEnd: XAxisClockTick;
    interior: XAxisClockTick[];
  };
  parsedReal: ParsedDayTelemetry;
  gapRecovery: ReconstructedGapCurveResult;
  selectedManualGridOff: boolean;
  hoverDetails: ChartHoverDetails | null;
  timeToX: (min: number) => number;
  kwToY: (kw: number) => number;
  onUpdateHoverFromPointer: (clientX: number) => void;
  onClearHover: () => void;
}

export const ComparisonSvgPlot: React.FC<ComparisonSvgPlotProps> = ({
  uid,
  plotContainerRef,
  selectedYmd,
  svgW,
  svgH,
  isCompact,
  plotLeft,
  plotRight,
  plotW,
  topY,
  baselineY,
  plotH,
  isTodaySelected,
  isNight,
  isTodayConfirmed,
  isDaytimeToday,
  isScrubbing,
  todayNowcast,
  sunX,
  sunY,
  sunLiveLabel,
  activeNowMinutes,
  realSegmentPaths,
  singleDotPoints,
  bridgedSegmentPaths,
  calcAreaPath,
  calcLinePath,
  calcElapsedLinePath,
  purePhysicsRemainingPath,
  calcRemainingLinePath,
  yTicksKw,
  xTicks,
  parsedReal,
  gapRecovery,
  selectedManualGridOff,
  hoverDetails,
  timeToX,
  kwToY,
  onUpdateHoverFromPointer,
  onClearHover,
}) => (
  <div
    ref={plotContainerRef}
    className="relative w-full select-none touch-none"
    style={{ height: `${svgH}px` }}
    onPointerMove={(e) => onUpdateHoverFromPointer(e.clientX)}
    onPointerDown={(e) => onUpdateHoverFromPointer(e.clientX)}
    onPointerLeave={onClearHover}
  >
    <svg
      key={selectedYmd}
      data-plot-svg="true"
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="block w-full h-full overflow-visible"
    >
      <defs>
        <linearGradient id={`calcAreaGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity={isTodaySelected && isNight ? '0.07' : '0.18'} />
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.01" />
        </linearGradient>

        <linearGradient id={`realAreaGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
        </linearGradient>

        <linearGradient id={`surplusFillGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`deficitFillGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.06" />
        </linearGradient>

        <linearGradient id={`horizonGrad-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.45" />
          <stop offset="22%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.55" />
          <stop offset="78%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0.45" />
        </linearGradient>

        <linearGradient id={`sunBeamGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={isTodayConfirmed ? '#10B981' : '#F59E0B'}
            stopOpacity="0.38"
          />
          <stop
            offset="100%"
            stopColor={isTodayConfirmed ? '#10B981' : '#F59E0B'}
            stopOpacity="0.02"
          />
        </linearGradient>

        <pattern
          id={`wifiGapHatch-${uid}`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#CBD5E1" strokeWidth="1.5" strokeOpacity="0.45" />
        </pattern>

        <pattern
          id={`bridgedGapHatch-${uid}`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill="#FEF3C7" fillOpacity="0.28" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#F59E0B" strokeWidth="1.35" strokeOpacity="0.45" />
        </pattern>

        <clipPath id={`elapsedClip-${uid}`}>
          <rect
            x={plotLeft}
            y={topY - 6}
            width={Math.max(0, sunX - plotLeft)}
            height={plotH + 10}
          />
        </clipPath>

        <clipPath id={`revealCalcClip-${uid}`}>
          <rect x={plotLeft - 6} y={topY - 10} width={plotW + 12} height={plotH + 18}>
            <animate
              attributeName="width"
              from="0"
              to={String(plotW + 12)}
              dur="0.68s"
              calcMode="spline"
              keyTimes="0;1"
              keySplines="0.22 1 0.36 1"
              fill="freeze"
            />
          </rect>
        </clipPath>

        <clipPath id={`revealRealClip-${uid}`}>
          <rect x={plotLeft - 6} y={topY - 10} width={0} height={plotH + 18}>
            <animate
              attributeName="width"
              from="0"
              to={String(plotW + 12)}
              begin="0.12s"
              dur="0.78s"
              calcMode="spline"
              keyTimes="0;1"
              keySplines="0.22 1 0.36 1"
              fill="freeze"
            />
          </rect>
        </clipPath>

        {realSegmentPaths.length > 0 && (
          <>
            <mask id={`surplusMask-${uid}`}>
              <rect x={0} y={0} width={svgW} height={svgH} fill="black" />
              {realSegmentPaths.map((seg, i) => (
                <path key={`sm-${i}`} d={seg.areaPath} fill="white" />
              ))}
              <path d={calcAreaPath} fill="black" />
            </mask>

            <mask id={`deficitMask-${uid}`}>
              <rect x={0} y={0} width={svgW} height={svgH} fill="black" />
              {realSegmentPaths.map((seg, i) => (
                <g key={`dm-${i}`}>
                  <clipPath id={`segSpan-${uid}-${i}`}>
                    <rect
                      x={seg.startX}
                      y={topY - 4}
                      width={Math.max(0, seg.endX - seg.startX)}
                      height={plotH + 8}
                    />
                  </clipPath>
                  <path
                    d={calcAreaPath}
                    fill="white"
                    clipPath={`url(#segSpan-${uid}-${i})`}
                  />
                </g>
              ))}
              {realSegmentPaths.map((seg, i) => (
                <path key={`dmb-${i}`} d={seg.areaPath} fill="black" />
              ))}
            </mask>
          </>
        )}
      </defs>

      {yTicksKw.map((val) => {
        const yPos = kwToY(val);
        return (
          <g key={val}>
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
              {val.toFixed(1)} kW
            </text>
          </g>
        );
      })}

      {xTicks.interior.map((tick) => {
        const tx = timeToX(tick.minutes);
        return (
          <line
            key={`vg-${tick.minutes}`}
            x1={tx}
            x2={tx}
            y1={topY}
            y2={baselineY}
            stroke="#F8FAFC"
            strokeWidth="1"
          />
        );
      })}

      {parsedReal.gaps.map((gap, idx) => {
        const gx1 = timeToX(gap.startMin);
        const gx2 = timeToX(gap.endMin);
        const gw = gx2 - gx1;
        if (gw < 10) return null;
        const matchedBridge = gapRecovery.bridgedSegments.find(
          (s) => Math.abs(s.startMin - gap.startMin) < 12 || (gap.startMin <= s.startMin && s.endMin <= gap.endMin)
        );
        const isEeprom = matchedBridge?.kind === 'EEPROM_CONFIRMED';
        const isBuffer = matchedBridge?.kind === 'BUFFER_ESTIMATED';
        return (
          <g key={`gap-${idx}`}>
            <rect
              x={gx1}
              y={topY}
              width={gw}
              height={plotH}
              fill={isBuffer ? `url(#bridgedGapHatch-${uid})` : `url(#wifiGapHatch-${uid})`}
              rx="4"
            />
            {gw >= 72 && (
              <text
                x={(gx1 + gx2) / 2}
                y={topY + 14}
                textAnchor="middle"
                fill={isEeprom ? '#0F766E' : isBuffer ? '#B45309' : '#94A3B8'}
                fontSize="9.5"
                fontWeight="600"
              >
                {isEeprom && matchedBridge
                  ? `EDay Bridge ✓ +${matchedBridge.recoveredKwh.toFixed(1)} kWh`
                  : isBuffer && matchedBridge
                  ? `Outage Buffer · +${matchedBridge.recoveredKwh.toFixed(1)} kWh`
                  : selectedManualGridOff || gapRecovery.suspectedGridCut
                  ? `Grid Off · ${gap.durationText}`
                  : `Gap · ${gap.durationText}`}
              </text>
            )}
          </g>
        );
      })}
      {parsedReal.gaps.length === 0 &&
        bridgedSegmentPaths.map((bSeg, idx) => {
          const gx1 = timeToX(bSeg.startMin);
          const gx2 = timeToX(bSeg.endMin);
          const gw = gx2 - gx1;
          if (gw < 12) return null;
          const isEeprom = bSeg.kind === 'EEPROM_CONFIRMED';
          return (
            <g key={`pregap-${idx}`}>
              <rect
                x={gx1}
                y={topY}
                width={gw}
                height={plotH}
                fill={isEeprom ? `url(#wifiGapHatch-${uid})` : `url(#bridgedGapHatch-${uid})`}
                rx="4"
              />
              {gw >= 72 && (
                <text
                  x={(gx1 + gx2) / 2}
                  y={topY + 14}
                  textAnchor="middle"
                  fill={isEeprom ? '#0F766E' : '#B45309'}
                  fontSize="9.5"
                  fontWeight="600"
                >
                  {isEeprom
                    ? `EDay Bridge ✓ +${bSeg.recoveredKwh.toFixed(1)} kWh`
                    : `Outage Buffer · +${bSeg.recoveredKwh.toFixed(1)} kWh`}
                </text>
              )}
            </g>
          );
        })}

      {isDaytimeToday && (
        <rect
          x={sunX}
          y={topY}
          width={Math.max(0, plotRight - sunX)}
          height={plotH}
          fill="#F8FAFC"
          fillOpacity="0.46"
          pointerEvents="none"
        />
      )}

      <g clipPath={`url(#revealCalcClip-${uid})`}>
        {calcAreaPath && !isDaytimeToday && (
          <path
            d={calcAreaPath}
            fill={`url(#calcAreaGrad-${uid})`}
            className="chart-area-reveal"
          />
        )}

        {calcAreaPath && isDaytimeToday && (
          <>
            <path
              d={calcAreaPath}
              fill={`url(#calcAreaGrad-${uid})`}
              clipPath={`url(#elapsedClip-${uid})`}
            />
            <path d={calcAreaPath} fill="#0EA5E9" fillOpacity="0.04" />
          </>
        )}

        {isDaytimeToday ? (
          <>
            {calcElapsedLinePath && (
              <path
                d={calcElapsedLinePath}
                fill="none"
                stroke="#0284C7"
                strokeWidth="2.4"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            )}
            {purePhysicsRemainingPath && (
              <path
                d={purePhysicsRemainingPath}
                fill="none"
                stroke="#0284C7"
                strokeOpacity="0.28"
                strokeWidth="1.6"
                strokeDasharray="3 5"
                strokeLinecap="round"
              />
            )}
            {calcRemainingLinePath && (
              <path
                d={calcRemainingLinePath}
                fill="none"
                stroke={
                  !isScrubbing && todayNowcast?.active && todayNowcast.skyMode === 'haze_veil'
                    ? '#EA580C'
                    : '#0284C7'
                }
                strokeOpacity={!isScrubbing && todayNowcast?.active ? '0.82' : '0.45'}
                strokeWidth="2.2"
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
            )}
          </>
        ) : (
          calcLinePath && (
            <path
              d={calcLinePath}
              fill="none"
              stroke="#0284C7"
              strokeWidth="2.4"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          )
        )}
      </g>

      {(realSegmentPaths.length > 0 || bridgedSegmentPaths.length > 0) && (
        <g clipPath={`url(#revealRealClip-${uid})`}>
          {realSegmentPaths.length > 0 && (
            <>
              <rect
                x={plotLeft}
                y={topY}
                width={plotW}
                height={plotH}
                fill={`url(#surplusFillGrad-${uid})`}
                mask={`url(#surplusMask-${uid})`}
                className="chart-area-reveal"
              />
              <rect
                x={plotLeft}
                y={topY}
                width={plotW}
                height={plotH}
                fill={`url(#deficitFillGrad-${uid})`}
                mask={`url(#deficitMask-${uid})`}
                className="chart-area-reveal"
              />
            </>
          )}

          {bridgedSegmentPaths.map((bSeg, i) => {
            const isEeprom = bSeg.kind === 'EEPROM_CONFIRMED';
            return (
              <g key={`bridged-seg-${i}`}>
                {bSeg.areaPath && (
                  <path
                    d={bSeg.areaPath}
                    fill={isEeprom ? '#0D9488' : '#F59E0B'}
                    fillOpacity={isEeprom ? '0.11' : '0.14'}
                  />
                )}
                <path
                  d={bSeg.linePath}
                  fill="none"
                  stroke={isEeprom ? '#0D9488' : '#D97706'}
                  strokeWidth="2.4"
                  strokeDasharray={isEeprom ? '8 4' : '5 4'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {realSegmentPaths.map((seg, i) => (
            <g key={`real-seg-${i}`}>
              <path
                d={seg.areaPath}
                fill={`url(#realAreaGrad-${uid})`}
                fillOpacity="0.55"
              />
              <path
                d={seg.linePath}
                fill="none"
                stroke="#059669"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g>
                <circle r="5.5" fill="#10B981" fillOpacity="0.22">
                  <animateMotion dur="4.4s" repeatCount="indefinite" path={seg.linePath} />
                </circle>
                <circle r="2.6" fill="#10B981" stroke="#FFFFFF" strokeWidth="1">
                  <animateMotion dur="4.4s" repeatCount="indefinite" path={seg.linePath} />
                </circle>
              </g>
            </g>
          ))}
        </g>
      )}

      {singleDotPoints.map((pt, idx) => (
        <g key={`sdot-${idx}`}>
          <circle cx={pt.x} cy={pt.y} r="7" fill="#10B981" fillOpacity="0.24" className="sun-node-halo" />
          <circle cx={pt.x} cy={pt.y} r="4" fill="#059669" stroke="#FFFFFF" strokeWidth="1.8" />
        </g>
      ))}

      <rect
        x={plotLeft}
        y={baselineY - 1.5}
        width={plotW}
        height="3"
        rx="1.5"
        fill={`url(#horizonGrad-${uid})`}
        opacity="0.7"
      />

      {isDaytimeToday && (
        <g pointerEvents="none">
          <polygon
            points={`${sunX - 11},${sunY + 4} ${sunX + 11},${sunY + 4} ${sunX + 20},${baselineY - 1} ${
              sunX - 20
            },${baselineY - 1}`}
            fill={`url(#sunBeamGrad-${uid})`}
            className="sun-beam-pulse"
          />
          <line
            x1={sunX}
            x2={sunX}
            y1={sunY + 8}
            y2={baselineY}
            stroke={isTodayConfirmed ? '#059669' : '#D97706'}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.75"
          />

          <circle
            cx={sunX}
            cy={sunY}
            r="14"
            fill={isTodayConfirmed ? 'rgba(16, 185, 129, 0.22)' : 'rgba(245, 158, 11, 0.24)'}
            className="sun-node-halo"
          />

          <g transform={`translate(${sunX}, ${sunY})`}>
            <g className="sun-corona-rays">
              {Array.from({ length: 12 }).map((_, rayIdx) => {
                const angle = (rayIdx * 30 * Math.PI) / 180;
                const r1 = 8.5;
                const r2 = rayIdx % 2 === 0 ? 12.2 : 10.6;
                return (
                  <line
                    key={rayIdx}
                    x1={Math.cos(angle) * r1}
                    y1={Math.sin(angle) * r1}
                    x2={Math.cos(angle) * r2}
                    y2={Math.sin(angle) * r2}
                    stroke={isTodayConfirmed ? '#10B981' : '#F59E0B'}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                );
              })}
            </g>
          </g>

          <circle
            cx={sunX}
            cy={sunY}
            r="5.8"
            fill={isTodayConfirmed ? '#10B981' : '#F59E0B'}
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          <text
            x={sunX}
            y={Math.max(16, sunY - 17)}
            textAnchor={sunX < plotLeft + 52 ? 'start' : sunX > plotRight - 52 ? 'end' : 'middle'}
            fill={isTodayConfirmed ? '#065F46' : '#0F172A'}
            fontSize="12"
            fontWeight="800"
            className="tabular-nums"
            style={{
              paintOrder: 'stroke',
              stroke: 'rgba(255,255,255,0.92)',
              strokeWidth: 4,
              strokeLinejoin: 'round',
            }}
          >
            {sunLiveLabel}
          </text>
        </g>
      )}

      <g>
        <line x1={plotLeft} x2={plotLeft} y1={baselineY} y2={baselineY + 5} stroke="#94A3B8" strokeWidth="1.25" />
        <text
          x={plotLeft}
          y={baselineY + 18}
          textAnchor="start"
          fill="#475569"
          fontSize={isCompact ? '9.5' : '10.5'}
          fontWeight="700"
          className="tabular-nums"
        >
          {xTicks.edgeStart.label}
        </text>
        <text x={plotLeft} y={baselineY + 31} textAnchor="start" fill="#94A3B8" fontSize="9" fontWeight="600">
          Sunrise
        </text>

        {xTicks.interior.map((tick) => {
          const tx = timeToX(tick.minutes);
          return (
            <g key={tick.minutes}>
              <line x1={tx} x2={tx} y1={baselineY} y2={baselineY + 4} stroke="#CBD5E1" strokeWidth="1" />
              <text
                x={tx}
                y={baselineY + 18}
                textAnchor="middle"
                fill="#64748B"
                fontSize={isCompact ? '9.5' : '10.5'}
                fontWeight="600"
                className="tabular-nums"
              >
                {isCompact ? tick.compactLabel : tick.label}
              </text>
            </g>
          );
        })}

        {isDaytimeToday && (
          <g>
            <line
              x1={sunX}
              x2={sunX}
              y1={baselineY}
              y2={baselineY + 7}
              stroke={isTodayConfirmed ? '#059669' : '#D97706'}
              strokeWidth="2"
            />
            <text
              x={sunX}
              y={baselineY + 19}
              textAnchor={sunX < plotLeft + 46 ? 'start' : sunX > plotRight - 46 ? 'end' : 'middle'}
              fill={isTodayConfirmed ? '#047857' : '#B45309'}
              fontSize="10.5"
              fontWeight="800"
              className="tabular-nums"
            >
              {formatMinutes12hUpper(activeNowMinutes)}
            </text>
            <text
              x={sunX}
              y={baselineY + 31}
              textAnchor={sunX < plotLeft + 46 ? 'start' : sunX > plotRight - 46 ? 'end' : 'middle'}
              fill={isTodayConfirmed ? '#059669' : '#D97706'}
              fontSize="8.5"
              fontWeight="800"
              letterSpacing="0.06em"
            >
              {isScrubbing ? 'SCRUB' : 'NOW'}
            </text>
          </g>
        )}

        <line x1={plotRight} x2={plotRight} y1={baselineY} y2={baselineY + 5} stroke="#94A3B8" strokeWidth="1.25" />
        <text
          x={plotRight}
          y={baselineY + 18}
          textAnchor="end"
          fill="#475569"
          fontSize={isCompact ? '9.5' : '10.5'}
          fontWeight="700"
          className="tabular-nums"
        >
          {xTicks.edgeEnd.label}
        </text>
        <text x={plotRight} y={baselineY + 31} textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="600">
          Sunset
        </text>
      </g>

      {hoverDetails && (
        <g pointerEvents="none">
          <line
            x1={hoverDetails.x}
            x2={hoverDetails.x}
            y1={topY}
            y2={baselineY}
            stroke="#94A3B8"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {hoverDetails.yReal !== null && (
            <line
              x1={hoverDetails.x}
              x2={hoverDetails.x}
              y1={hoverDetails.yCalc}
              y2={hoverDetails.yReal}
              stroke={hoverDetails.deltaKw !== null && hoverDetails.deltaKw >= 0 ? '#10B981' : '#F59E0B'}
              strokeWidth="2.5"
              strokeOpacity="0.7"
            />
          )}

          <circle cx={hoverDetails.x} cy={hoverDetails.yCalc} r="4.5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="2" />
          {hoverDetails.yReal !== null && (
            <circle cx={hoverDetails.x} cy={hoverDetails.yReal} r="5" fill="#059669" stroke="#FFFFFF" strokeWidth="2" />
          )}
          {hoverDetails.yBridged !== null && (
            <circle cx={hoverDetails.x} cy={hoverDetails.yBridged} r="5" fill="#D97706" stroke="#FFFFFF" strokeWidth="2" />
          )}
        </g>
      )}
    </svg>

    {hoverDetails && (
      <div
        className="pointer-events-none absolute top-2 z-20 w-[220px] rounded-2xl apple-glass-dark text-white px-3.5 py-2.5 shadow-2xl border border-white/20 text-[11px]"
        style={{
          left: `${
            hoverDetails.x + 232 <= svgW
              ? hoverDetails.x + 14
              : Math.max(8, hoverDetails.x - 230)
          }px`,
        }}
      >
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/15">
          <span className="font-bold text-white tabular-nums">
            {formatIndianDate(selectedYmd, 'short')} · {hoverDetails.timeText}
          </span>
          <span className="text-[10px] font-semibold text-amber-300 tabular-nums">
            {hoverDetails.calc.gti} W/m²
          </span>
        </div>

        <div className="mt-1.5 space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sky-300 font-medium">
              <span className="w-2.5 border-t border-dashed border-sky-400" />
              Engine
            </span>
            <span className="font-bold text-white">
              ~{hoverDetails.calc.kw.toFixed(2)} kW · {hoverDetails.calc.cumKwh.toFixed(1)} kWh
            </span>
          </div>

          {hoverDetails.real ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Real
                </span>
                <span className="font-bold text-emerald-200">
                  {hoverDetails.real.kw.toFixed(2)} kW · {hoverDetails.real.cumKwh.toFixed(1)} kWh
                </span>
              </div>
              {hoverDetails.capturePct !== null && (
                <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-slate-300">Capture vs. Model</span>
                  <span
                    className={`font-bold ${
                      hoverDetails.capturePct >= 95
                        ? 'text-emerald-300'
                        : hoverDetails.capturePct >= 65
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {hoverDetails.capturePct}% ({hoverDetails.deltaKw! >= 0 ? '+' : ''}
                    {hoverDetails.deltaKw!.toFixed(2)} kW)
                  </span>
                </div>
              )}
            </>
          ) : hoverDetails.bridged ? (
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    hoverDetails.bridged.kind === 'EEPROM_CONFIRMED' ? 'text-teal-300' : 'text-amber-300'
                  }`}
                >
                  <span
                    className={`w-2.5 border-t border-dashed ${
                      hoverDetails.bridged.kind === 'EEPROM_CONFIRMED' ? 'border-teal-400' : 'border-amber-400'
                    }`}
                  />
                  {hoverDetails.bridged.kind === 'EEPROM_CONFIRMED' ? 'EDay Bridged' : 'Outage Buffer'}
                </span>
                <span
                  className={`font-bold ${
                    hoverDetails.bridged.kind === 'EEPROM_CONFIRMED' ? 'text-teal-200' : 'text-amber-200'
                  }`}
                >
                  ~{hoverDetails.bridged.kw.toFixed(2)} kW
                </span>
              </div>
              <div className="text-[10px] text-slate-300">
                {hoverDetails.bridged.kind === 'EEPROM_CONFIRMED'
                  ? `✓ Counted in Inverter EDay (+${hoverDetails.bridged.segmentRecoveredKwh.toFixed(1)} kWh)`
                  : `Estimated Outage Buffer (+${hoverDetails.bridged.segmentRecoveredKwh.toFixed(1)} kWh · Twin gap-fill)`}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-amber-300/90 pt-0.5">
              Waaree Real:{' '}
              {isTodaySelected
                ? 'Awaiting Wi-Fi sync'
                : selectedManualGridOff || gapRecovery.suspectedGridCut
                ? 'Grid Off (0.0 kWh)'
                : 'No interval point'}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
