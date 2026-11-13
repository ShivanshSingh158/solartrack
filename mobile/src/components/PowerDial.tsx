import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Zap, Moon, Sun } from "lucide-react-native";

interface PowerDialProps {
  currentKw: number;
  maxKw?: number;
  isGenerating: boolean;
  isNight: boolean;
  efficiencyPct?: number;
}

export const PowerDial: React.FC<PowerDialProps> = ({
  currentKw,
  maxKw = 3.27,
  isGenerating,
  isNight,
  efficiencyPct = 94.0,
}) => {
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Arc from 135deg to 405deg (270 degrees sweep)
  const arcSweep = 0.75;
  const arcTotal = circumference * arcSweep;

  const pct = Math.min(Math.max(currentKw / maxKw, 0), 1);
  const strokeDashoffset = arcTotal - pct * arcTotal;

  return (
    <View style={styles.container}>
      <View style={styles.gaugeWrapper}>
        <Svg width={size} height={size} style={styles.svg}>
          <Defs>
            <LinearGradient id="solarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#f59e0b" />
              <Stop offset="100%" stopColor="#ea580c" />
            </LinearGradient>
            <LinearGradient id="nightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#64748b" />
              <Stop offset="100%" stopColor="#334155" />
            </LinearGradient>
          </Defs>

          {/* Background Track Arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcTotal} ${circumference}`}
            strokeLinecap="round"
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
          />

          {/* Active Generation Arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isNight ? "url(#nightGradient)" : "url(#solarGradient)"}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcTotal} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>

        {/* Center Content */}
        <View style={styles.centerContent}>
          <View style={[styles.badge, isNight ? styles.badgeNight : styles.badgeSun]}>
            {isNight ? (
              <Moon size={16} color="#64748b" />
            ) : isGenerating ? (
              <Sun size={16} color="#d97706" />
            ) : (
              <Zap size={16} color="#f59e0b" />
            )}
            <Text style={[styles.badgeText, isNight ? styles.badgeNightText : styles.badgeSunText]}>
              {isNight ? "Night Standby" : isGenerating ? "Live Solar" : "Waiting for Sun"}
            </Text>
          </View>

          <Text style={styles.powerValue}>{currentKw.toFixed(2)}</Text>
          <Text style={styles.powerUnit}>kW AC Output</Text>

          <View style={styles.capacityRow}>
            <Text style={styles.capacityLabel}>Plant: {maxKw.toFixed(2)} kWp</Text>
            <Text style={styles.efficiencyDot}>•</Text>
            <Text style={styles.capacityLabel}>{efficiencyPct}% Eff</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  gaugeWrapper: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  badgeSun: {
    backgroundColor: "#fef3c7",
  },
  badgeNight: {
    backgroundColor: "#f1f5f9",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
  badgeSunText: {
    color: "#b45309",
  },
  badgeNightText: {
    color: "#475569",
  },
  powerValue: {
    fontSize: 42,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -1,
  },
  powerUnit: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: -2,
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  capacityLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  efficiencyDot: {
    fontSize: 11,
    color: "#cbd5e1",
    marginHorizontal: 4,
  },
});
