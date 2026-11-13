import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { Zap, Moon, Sun, ArrowUpRight } from "lucide-react-native";

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
  const size = 300;
  const cx = size / 2;
  const cy = 165;
  const radius = 125;
  const tickLength = 12;

  // Arc angles: 150 deg (left bottom) to 390 deg (right bottom) -> 240 deg total sweep
  const startAngle = 150;
  const sweepAngle = 240;
  const totalTicks = 64;

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
    const isMajor = i % 8 === 0;

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
        <Svg width={size} height={210}>
          <Defs>
            <LinearGradient id="activeTickGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#f59e0b" />
              <Stop offset="100%" stopColor="#fef08a" />
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
                  ? "#fef08a"
                  : t.isMajor
                  ? "rgba(255, 255, 255, 0.22)"
                  : "rgba(255, 255, 255, 0.09)"
              }
              strokeWidth={t.isActive ? (t.isMajor ? 2.5 : 2) : t.isMajor ? 2 : 1.2}
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

          <View style={styles.pillMetaRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>
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
    width: 300,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  centerReadout: {
    position: "absolute",
    top: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  heroNumber: {
    fontSize: 54,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1.5,
    includeFontPadding: false,
    textShadowColor: "rgba(245, 158, 11, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 16,
  },
  heroSubLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.55)",
    letterSpacing: 2,
    marginTop: -4,
  },
  pillMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  metricPill: {
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  metricPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fbbf24",
  },
  dotSeparator: {
    color: "rgba(255, 255, 255, 0.25)",
    marginHorizontal: 6,
    fontSize: 10,
  },
  secondaryMeta: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.55)",
    fontWeight: "500",
  },
  threeColRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "88%",
    backgroundColor: "rgba(18, 24, 21, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  colItem: {
    flex: 1,
    alignItems: "center",
  },
  colLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  colValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 2,
  },
  colDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
});
