import React from 'react';
import {
  formatMinutes12hUpper,
  type ParsedDayTelemetry,
  type ReconstructedGapCurveResult,
} from '@solar-track/core';
import type {
  DayHoverInfo,
  DayStageGeometryResult,
  StagePlotLayout,
} from './performanceStageTypes';

interface PerformanceDayStageSvgProps {
  uid: string;
  animGeneration: string;
  layout: StagePlotLayout;
  geometry: DayStageGeometryResult;
  primaryParsed: ParsedDayTelemetry;
  primaryGapCurve?: ReconstructedGapCurveResult | null;
  showModelOverlay: boolean;
  showNowRule: boolean;
  nowX: number;
  hasLiveBeacon: boolean;
  dayHoverInfo: DayHoverInfo | null;
}

/**
 * Renders the 5-minute Day telemetry SVG curves, outage gap bridges, DC-AC hatch band, and crosshair.
 */
export const PerformanceDayStageSvg: React.FC<PerformanceDayStageSvgProps> = ({
  uid,
  animGeneration,
  layout,
  geometry,
  primaryParsed,
  primaryGapCurve,
  showModelOverlay,
  showNowRule,
  nowX,
  hasLiveBeacon,
  dayHoverInfo,
}) => {
  const { isCompact, plotLeft, plotRight, plotW, topY, baselineY, plotH } = layout;
  const {
    dayStartMin,
    dayEndMin,
    timeToX,
    kwToY,
    yTicksKw,
    xTicksDay,
    calcLinePath,
    calcAreaPath,
    realSegments,
    bridgedGapSegments,
    pvDcPaths,
    dcAcGapBandPaths,
    comparePaths,
  } = geometry;

  const liveLatestSegment = realSegments[realSegments.length - 1];

  return (
    <g>
      <rect
        x={plotLeft}
        y={topY}
        width={plotW}
        height={plotH}
        fill="transparent"
      />

      {/* Y-axis horizontal rules */}
      {yTicksKw.map((val) => {
        const yPos = kwToY(val);
        return (
          <g key={`dy-${val}`}>
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
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* X-axis clock ticks & vertical hairline guides */}
      {xTicksDay.interior.map((tick) => {
        const tx = timeToX(tick.minutes);
        return (
          <g key={`dx-${tick.minutes}`}>
            <line
              x1={tx}
              x2={tx}
              y1={topY}
              y2={baselineY}
              stroke="#F8FAFC"
              strokeWidth="1"
            />
            <text
              x={tx}
              y={baselineY + 18}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize={isCompact ? '9.5' : '10.5'}
              fontWeight="600"
              className="tabular-nums"
            >
              {tick.label}
            </text>
          </g>
        );
      })}

      <text
        x={plotLeft}
        y={baselineY + 18}
        textAnchor="start"
        fill="#64748B"
        fontSize={isCompact ? '9' : '10'}
        fontWeight="700"
      >
        {formatMinutes12hUpper(dayStartMin)}
      </text>
      <text
        x={plotRight}
        y={baselineY + 18}
        textAnchor="end"
        fill="#64748B"
        fontSize={isCompact ? '9' : '10'}
        fontWeight="700"
      >
        {formatMinutes12hUpper(dayEndMin)}
      </text>

      {/* Hatched Wi-Fi gaps > 16m */}
      {primaryParsed.gaps.map((gap, i) => {
        const x1 = timeToX(gap.startMin);
        const x2 = timeToX(gap.endMin);
        const gw = x2 - x1;
        if (gw < 8) return null;
        const matchedBridge = primaryGapCurve?.bridgedSegments?.find(
          (s) => !s.isMorningPreConnect && Math.abs(s.startMin - gap.startMin) < 10,
        );
        return (
          <g key={`dgap-${i}`}>
            <rect
              x={x1}
              y={topY}
              width={gw}
              height={plotH}
              fill={matchedBridge ? `url(#bridgedGapHatch-${uid})` : `url(#gapOutageHatch-${uid})`}
              opacity={matchedBridge ? 0.85 : 0.45}
            />
            {matchedBridge && gw >= 72 && (
              <text
                x={(x1 + x2) / 2}
                y={topY + 14}
                textAnchor="middle"
                fill="#B45309"
                fontSize="9.5"
                fontWeight="600"
              >
                Recovered · +{matchedBridge.recoveredKwh.toFixed(1)} kWh
              </text>
            )}
          </g>
        );
      })}

      {/* Clipped & Period-Animated Curves */}
      <g clipPath={`url(#perfDayClip-${uid}-${animGeneration})`}>
        {showModelOverlay && calcLinePath && (
          <>
            {calcAreaPath && (
              <path
                d={calcAreaPath}
                fill={`url(#perfSkyArea-${uid})`}
                style={{ transition: 'd 240ms ease-out' }}
              />
            )}
            <path
              d={calcLinePath}
              fill="none"
              stroke="#0284C7"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
              style={{ transition: 'd 240ms ease-out' }}
            />
          </>
        )}

        {comparePaths.map((dPath, i) => (
          <path
            key={`cmp-${i}`}
            d={dPath}
            fill="none"
            stroke="#6366F1"
            strokeWidth="2"
            strokeDasharray="2.5 4"
            strokeLinecap="round"
          />
        ))}

        {dcAcGapBandPaths.map((bandD, i) => (
          <path
            key={`dcband-${i}`}
            d={bandD}
            fill={`url(#dcAcGapHatch-${uid})`}
            opacity={0.9}
          />
        ))}

        {bridgedGapSegments.map((bSeg, i) => {
          const isEeprom = bSeg.kind === 'EEPROM_CONFIRMED';
          return (
            <g key={`bseg-${i}`}>
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
                strokeWidth="2.3"
                strokeDasharray={isEeprom ? '8 4' : '5 4'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {realSegments.map((seg, i) => (
          <g key={`rseg-${i}`}>
            {seg.areaPath && (
              <path
                d={seg.areaPath}
                fill={`url(#perfEmArea-${uid})`}
                style={{ transition: 'd 240ms ease-out' }}
              />
            )}
            {seg.linePath && (
              <path
                d={seg.linePath}
                fill="none"
                stroke="#059669"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'd 240ms ease-out' }}
              />
            )}
          </g>
        ))}

        {pvDcPaths.map((dcD, i) => (
          <path
            key={`pvdc-${i}`}
            d={dcD}
            fill="none"
            stroke="#D97706"
            strokeWidth="1.75"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Current IST Time Vertical Indicator on Today */}
      {showNowRule && (
        <g>
          <line
            x1={nowX}
            x2={nowX}
            y1={topY}
            y2={baselineY}
            stroke="#059669"
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {hasLiveBeacon && liveLatestSegment && (
            <>
              <circle
                cx={liveLatestSegment.lastX}
                cy={liveLatestSegment.lastY}
                r="7"
                fill="#10B981"
                opacity="0.22"
                className="animate-ping"
              />
              <circle
                cx={liveLatestSegment.lastX}
                cy={liveLatestSegment.lastY}
                r="3.5"
                fill="#059669"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </>
          )}
        </g>
      )}

      {/* Day Crosshair Guide & Markers */}
      {dayHoverInfo && (
        <g className="pointer-events-none">
          <line
            x1={dayHoverInfo.x}
            x2={dayHoverInfo.x}
            y1={topY}
            y2={baselineY}
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {showModelOverlay && (
            <circle
              cx={dayHoverInfo.x}
              cy={dayHoverInfo.modelY}
              r="4"
              fill="#0284C7"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )}
          {dayHoverInfo.compareY !== null && (
            <circle
              cx={dayHoverInfo.x}
              cy={dayHoverInfo.compareY}
              r="4"
              fill="#6366F1"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )}
          {dayHoverInfo.dcY !== null && (
            <circle
              cx={dayHoverInfo.x}
              cy={dayHoverInfo.dcY}
              r="4"
              fill="#D97706"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )}
          {dayHoverInfo.realY !== null && (
            <circle
              cx={dayHoverInfo.x}
              cy={dayHoverInfo.realY}
              r="4.5"
              fill="#059669"
              stroke="#FFFFFF"
              strokeWidth="1.75"
            />
          )}
          {dayHoverInfo.bridgedY !== null && (
            <circle
              cx={dayHoverInfo.x}
              cy={dayHoverInfo.bridgedY}
              r="4.5"
              fill="#D97706"
              stroke="#FFFFFF"
              strokeWidth="1.75"
            />
          )}
        </g>
      )}
    </g>
  );
};
