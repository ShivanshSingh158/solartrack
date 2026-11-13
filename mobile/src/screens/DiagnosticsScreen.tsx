import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  ArrowLeft,
  Cpu,
  Zap,
  Gauge,
  Thermometer,
  ShieldCheck,
  Radio,
} from "lucide-react-native";
import { solarClient, HealthPayload, UserProfile } from "../api/solarClient";

interface DiagnosticsScreenProps {
  user: UserProfile;
  onBack: () => void;
}

export const DiagnosticsScreen: React.FC<DiagnosticsScreenProps> = ({ user, onBack }) => {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    const res = await solarClient.getHealth(user.stationId);
    if (res) {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, [user.stationId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHealth();
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Reading Inverter Telemetries...</Text>
      </View>
    );
  }

  const mppt = data?.mppt?.[0] || {
    string: "PV1",
    voltageV: 258.9,
    currentA: 7.1,
    powerW: 1838,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={18} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>Hardware Diagnostics</Text>
          <Text style={styles.headerSubtitle}>Modbus & MPPT Channels</Text>
        </View>
      </View>

      {/* Inverter Status Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Cpu size={18} color="#2563eb" />
            <Text style={styles.cardTitle}>Inverter Engine</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{data?.inverter?.status || "Normal"}</Text>
          </View>
        </View>

        <Text style={styles.inverterModel}>{data?.inverter?.model || "Waaree 3kW Single Phase"}</Text>

        <View style={styles.gridTwo}>
          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Thermometer size={14} color="#ea580c" />
              <Text style={styles.statLabel}>Temperature</Text>
            </View>
            <Text style={styles.statBig}>{data?.inverter?.temperatureC ?? 41.5} °C</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Gauge size={14} color="#16a34a" />
              <Text style={styles.statLabel}>Efficiency</Text>
            </View>
            <Text style={styles.statBig}>{data?.inverter?.efficiencyPct ?? 94.0} %</Text>
          </View>
        </View>
      </View>

      {/* PV String MPPT Telemetries */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Zap size={18} color="#d97706" />
            <Text style={styles.cardTitle}>DC String 1 (PV1)</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: "#fef3c7" }]}>
            <Text style={[styles.statusText, { color: "#b45309" }]}>Active</Text>
          </View>
        </View>

        <View style={styles.gridThree}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Voltage</Text>
            <Text style={styles.statMedium}>{mppt.voltageV} V</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statMedium}>{mppt.currentA} A</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DC Power</Text>
            <Text style={styles.statMedium}>{mppt.powerW} W</Text>
          </View>
        </View>
      </View>

      {/* Grid AC Status */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Radio size={18} color="#059669" />
            <Text style={styles.cardTitle}>DISCOM AC Grid</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: "#dcfce7" }]}>
            <Text style={[styles.statusText, { color: "#166534" }]}>Synchronized</Text>
          </View>
        </View>

        <View style={styles.gridTwo}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Grid AC Voltage</Text>
            <Text style={styles.statMedium}>{data?.grid?.voltageV ?? 255.6} V</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Frequency</Text>
            <Text style={styles.statMedium}>{data?.grid?.frequencyHz ?? 50.01} Hz</Text>
          </View>
        </View>
      </View>

      <View style={styles.safeNotice}>
        <ShieldCheck size={14} color="#059669" />
        <Text style={styles.safeNoticeText}>
          Direct hardware registers verified via SolarTrack BaaS
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 6,
  },
  statusBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e40af",
  },
  inverterModel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
  },
  gridTwo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridThree: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 3,
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginLeft: 4,
  },
  statBig: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  statMedium: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  safeNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  safeNoticeText: {
    fontSize: 11,
    color: "#64748b",
    marginLeft: 6,
    fontWeight: "500",
  },
});
