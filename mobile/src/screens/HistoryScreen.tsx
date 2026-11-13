import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { TrendingUp, Calendar, Zap, Sun } from "lucide-react-native";
import { solarClient, HistoryPayload, UserProfile } from "../api/solarClient";

interface HistoryScreenProps {
  user: UserProfile;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ user }) => {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    const res = await solarClient.getHistory(user.stationId);
    if (res) setData(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user.stationId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading Generation History...</Text>
      </View>
    );
  }

  const past7 = data?.past7Days || [];
  const hourly = data?.hourlyCurve || [];
  const maxKw = Math.max(...hourly.map((h) => h.kw), 2.5);
  const maxDayKwh = Math.max(...past7.map((d) => d.kwh), 14);

  // SVG dimensions for hourly solar curve
  const chartWidth = 320;
  const chartHeight = 140;
  const paddingX = 10;
  const paddingY = 20;

  const points = hourly.map((item, idx) => {
    const x = paddingX + (idx / (hourly.length - 1)) * (chartWidth - 2 * paddingX);
    const y = chartHeight - paddingY - (item.kw / maxKw) * (chartHeight - 2 * paddingY);
    return { x, y, ...item };
  });

  // Construct smooth SVG path
  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z` : "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#f59e0b"]} />}
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>Generation History</Text>
          <Text style={styles.headerSubtitle}>Solar curves & daily yield telemetry</Text>
        </View>
      </View>

      {/* KPI Cards Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Today</Text>
          <Text style={styles.kpiValue}>{data?.todayKwh ?? 9.8} <Text style={styles.kpiUnit}>kWh</Text></Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Yesterday</Text>
          <Text style={styles.kpiValue}>{data?.yesterdayKwh ?? 11.9} <Text style={styles.kpiUnit}>kWh</Text></Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Peak Power</Text>
          <Text style={styles.kpiValue}>{data?.peakGenerationKw ?? 2.25} <Text style={styles.kpiUnit}>kW</Text></Text>
        </View>
      </View>

      {/* Hourly Generation Curve Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Sun size={18} color="#d97706" />
            <Text style={styles.cardTitle}>Today's Solar Bell Curve</Text>
          </View>
          <Text style={styles.badgeText}>06:00 AM – 06:00 PM</Text>
        </View>

        <View style={styles.chartWrapper}>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>
            {areaD ? <Path d={areaD} fill="url(#curveGradient)" /> : null}
            {pathD ? <Path d={pathD} stroke="#d97706" strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
          </Svg>

          <View style={styles.timeLabelsRow}>
            <Text style={styles.timeLabel}>6 AM</Text>
            <Text style={styles.timeLabel}>9 AM</Text>
            <Text style={styles.timeLabel}>12 PM</Text>
            <Text style={styles.timeLabel}>3 PM</Text>
            <Text style={styles.timeLabel}>6 PM</Text>
          </View>
        </View>
      </View>

      {/* Past 7 Days Bar Chart */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <TrendingUp size={18} color="#2563eb" />
            <Text style={styles.cardTitle}>Past 7 Days Production</Text>
          </View>
          <Text style={styles.badgeText}>Daily Yield</Text>
        </View>

        <View style={styles.barChartContainer}>
          {past7.map((item, idx) => {
            const barHeight = Math.max(16, (item.kwh / maxDayKwh) * 90);
            const isToday = item.day === "Today";
            return (
              <View key={idx} style={styles.barColumn}>
                <Text style={styles.barValue}>{item.kwh}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: barHeight, backgroundColor: isToday ? "#f59e0b" : "#3b82f6" },
                    ]}
                  />
                </View>
                <Text style={[styles.barDay, isToday && styles.barDayToday]}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  loadingText: { marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: "600" },
  header: { marginBottom: 16, marginTop: 8 },
  titleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 12, color: "#64748b", fontWeight: "500", marginTop: 2 },
  kpiRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  kpiValue: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  kpiUnit: { fontSize: 11, fontWeight: "600", color: "#94a3b8" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginLeft: 6 },
  badgeText: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  chartWrapper: { alignItems: "center", marginTop: 8 },
  timeLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 300,
    marginTop: 6,
  },
  timeLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "600" },
  barChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingTop: 10,
  },
  barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barValue: { fontSize: 10, fontWeight: "700", color: "#64748b", marginBottom: 4 },
  barTrack: { width: 14, height: 90, backgroundColor: "#f1f5f9", borderRadius: 7, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: 14, borderRadius: 7 },
  barDay: { fontSize: 10, fontWeight: "600", color: "#94a3b8", marginTop: 6 },
  barDayToday: { color: "#d97706", fontWeight: "800" },
});
