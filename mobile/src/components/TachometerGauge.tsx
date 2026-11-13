import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Line, Defs, LinearGradient, Stop } from "react-native-svg";

interface TachometerGaugeProps {
  currentKw: number;
  peakKw?: number;
  peakTimeLabel?: string;
  maxCapacityKwp?: number;
  isGenerating: boolean;
  isNight: boolean;
  efficiencyPct?: number;
}

export const TachometerGauge: React.FC<TachometerGaugeProps> = ({
  currentKw,
  peakKw = 2.11,
  peakTimeLabel = "11:47 AM",
  maxCapacityKwp = 3.27,
  isGenerating,
  isNight,
  efficiencyPct = 93.8,
}) => {
  const size = 310;
  const cx = size / 2;
  const cy = 160;
  const radius = 126;
  const tickLength = 12;

  // Arc angles: 150 deg to 390 deg -> 240 deg total sweep
  const startAngle = 150;
  const sweepAngle = 240;
  const totalTicks = 60;

  const currentFrac = Math.min(Math.max(currentKw / (maxCapacityKwp > 0 ? maxCapacityKwp : 3.27), 0), 1);
  const activeTicksCount = Math.round(currentFrac * totalTicks);

  const ticks = [];
  for (let i = 0; i <= totalTicks; i++) {
    const angleDeg = startAngle + (i / totalTicks) * sweepAngle;
    const angleRad = (angleDeg * Math.PI) / 180;

    const x1 = cx + (radius - tickLength) * Math.cos(angleRad);
    const y1 = cy + (radius - tickLength) * Math.sin(angleRad);
    const x2 = cx + radius * Math.cos(angleRad);
    const y2 = cy + radius * Math.sin(angleRad);

    const isActive = i <= activeTicksCount && !isNight && currentKw > 0.05;
    const isMajor = i % 10 === 0;

    ticks.push({
      x1,
      y1,
      x2,
      y2,
      isActive,
      isMajor,
      key: i,
    });
  }

  // Calculate percentage of target/peak
  const peakFrac = peakKw > 0 ? Math.min(100, Math.round((currentKw / peakKw) * 100)) : 0;

  return (
    <View style={styles.container}>
      {/* Svg Radial Ticks Arch */}
      <View style={styles.svgWrap}>
        <Svg width={size} height={205}>
          <Defs>
            <LinearGradient id="solarTickGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#F59E0B" />
              <Stop offset="100%" stopColor="#D97706" />
            </LinearGradient>
          </Defs>

          {ticks.map((t) => (
            <Line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                t.isActive
                  ? "#F59E0B"
                  : t.isMajor
                  ? "#CBD5E1"
                  : "#E2E8F0"
              }
              strokeWidth={t.isActive ? (t.isMajor ? 3 : 2.2) : t.isMajor ? 2 : 1.3}
              strokeLinecap="round"
            />
          ))}
        </Svg>

        {/* Center Illuminated Readout matching Reference Design */}
        <View style={styles.centerReadout}>
          <Text style={styles.heroNumber}>
            {isNight ? "0.00" : currentKw.toFixed(2)}
          </Text>
          <Text style={styles.heroSubLabel}>kW AC OUTPUT</Text>

          <View style={styles.metaRow}>
            <View style={styles.metricBadge}>
              <Text style={styles.metricBadgeText}>
                {isNight ? "Night Standby" : `${peakFrac}% of Peak`}
              </Text>
            </View>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.secondaryMeta}>
              Peak {peakKw.toFixed(2)} kW ({peakTimeLabel})
            </Text>
          </View>
        </View>
      </View>

      {/* 3-Column Luxury Micro Metrics directly below arch matching reference */}
      <View style={styles.threeColRow}>
        <View style={styles.colItem}>
          <Text style={styles.colLabel}>Daily Goal</Text>
          <Text style={styles.colValue}>
            {peakFrac > 0 ? `${peakFrac}%` : "--"}
          </Text>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.colItem}>
          <Text style={styles.colLabel}>Inverter Eff</Text>
          <Text style={styles.colValue}>{efficiencyPct}%</Text>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.colItem}>
          <Text style={styles.colLabel}>Capacity</Text>
          <Text style={styles.colValue}>{maxCapacityKwp.toFixed(2)} kW</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  svgWrap: {
    width: 310,
    height: 195,
    alignItems: "center",
    justifyContent: "center",
  },
  centerReadout: {
    position: "absolute",
    top: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  heroNumber: {
    fontSize: 54,
    fontWeight: "300",
    color: "#0F172A",
    letterSpacing: -1,
    lineHeight: 58,
    includeFontPadding: false,
  },
  heroSubLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 2.5,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  metricBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  metricBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B45309",
  },
  dotSeparator: {
    color: "#94A3B8",
    marginHorizontal: 6,
    fontSize: 10,
  },
  secondaryMeta: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  threeColRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "90%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  colItem: {
    flex: 1,
    alignItems: "center",
  },
  colLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "400",
    letterSpacing: 0.3,
  },
  colValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 2,
  },
  colDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },
});
