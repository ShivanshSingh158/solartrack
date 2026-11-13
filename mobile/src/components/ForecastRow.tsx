import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CloudSun, Sun, CloudRain, Clock } from "lucide-react-native";

interface ForecastRowProps {
  tomorrowExpectedKwh: number;
  heavyLoadWindow: string;
  threeDayHorizon: Array<{
    date: string;
    expectedKwh: number;
    condition: string;
  }>;
}

export const ForecastRow: React.FC<ForecastRowProps> = ({
  tomorrowExpectedKwh,
  heavyLoadWindow,
  threeDayHorizon,
}) => {
  const renderConditionIcon = (condition: string) => {
    const c = condition.toLowerCase();
    if (c.includes("rain") || c.includes("shower")) {
      return <CloudRain size={16} color="#0284c7" />;
    }
    if (c.includes("cloud")) {
      return <CloudSun size={16} color="#ea580c" />;
    }
    return <Sun size={16} color="#f59e0b" />;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sun size={16} color="#f59e0b" />
          <Text style={styles.title}>Solar Yield Forecast</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Tomorrow ~{tomorrowExpectedKwh} kWh</Text>
        </View>
      </View>

      <View style={styles.windowRow}>
        <Clock size={13} color="#64748b" />
        <Text style={styles.windowLabel}>Best Solar Appliance Window:</Text>
        <Text style={styles.windowValue}>{heavyLoadWindow}</Text>
      </View>

      <View style={styles.horizonContainer}>
        {threeDayHorizon.map((day, idx) => (
          <View key={idx} style={styles.dayCol}>
            <Text style={styles.dayLabel}>{day.date}</Text>
            <View style={styles.iconWrap}>{renderConditionIcon(day.condition)}</View>
            <Text style={styles.kwhValue}>{day.expectedKwh} kWh</Text>
            <Text style={styles.conditionLabel} numberOfLines={1}>
              {day.condition}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginVertical: 8,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 6,
  },
  badge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
  },
  windowRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  windowLabel: {
    fontSize: 11,
    color: "#64748b",
    marginLeft: 6,
  },
  windowValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 4,
  },
  horizonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCol: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    marginHorizontal: 3,
    borderRadius: 10,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 4,
  },
  iconWrap: {
    marginVertical: 4,
  },
  kwhValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  conditionLabel: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
});
