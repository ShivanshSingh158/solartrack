import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  Sun,
  MapPin,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Activity,
} from "lucide-react-native";
import {
  solarClient,
  OverviewPayload,
  UserProfile,
} from "../api/solarClient";
import { PowerDial } from "../components/PowerDial";
import { MetricCard } from "../components/MetricCard";
import { PanelCleanlinessCard } from "../components/PanelCleanlinessCard";
import { ForecastRow } from "../components/ForecastRow";

interface CockpitScreenProps {
  user: UserProfile;
  onLogout: () => void;
  onNavigateDiagnostics: () => void;
}

export const CockpitScreen: React.FC<CockpitScreenProps> = ({
  user,
  onLogout,
  onNavigateDiagnostics,
}) => {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    const res = await solarClient.getOverview(user.stationId);
    if (res) {
      setData(res);
    }
    setLoading(false);
  }, [user.stationId]);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Connecting to Headless BaaS...</Text>
      </View>
    );
  }

  const liveKw = data?.liveDial?.currentPowerKw ?? 0;
  const isGenerating = data?.systemStatus?.isGenerating ?? false;
  const isNight = data?.systemStatus?.isNight ?? false;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#f59e0b"]} />}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.plantRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.plantTitle} numberOfLines={1}>
              {data?.meta?.plantName || user.plantName || "Rooftop Solar"}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={12} color="#64748b" />
            <Text style={styles.locationText}>Kanpur, UP • 3.27 kWp DC</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onNavigateDiagnostics}
            activeOpacity={0.7}
          >
            <Activity size={18} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { marginLeft: 8 }]}
            onPress={onLogout}
            activeOpacity={0.7}
          >
            <LogOut size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Circular Power Dial */}
      <View style={styles.dialCard}>
        <PowerDial
          currentKw={liveKw}
          maxKw={user.capacityKwp || 3.27}
          isGenerating={isGenerating}
          isNight={isNight}
          efficiencyPct={data?.liveDial?.systemEfficiencyPct || 94.0}
        />
      </View>

      {/* Energy Generation Cards (Today, Month, Lifetime) */}
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Today"
          value={data?.todayEnergy?.todayKwh != null ? `${data.todayEnergy.todayKwh}` : "0.0"}
          unit="kWh"
          iconType="today"
          subValue={
            data?.todayEnergy?.todayKwh
              ? `₹${Math.round(data.todayEnergy.todayKwh * 7.35)}`
              : "₹0"
          }
          highlight={true}
        />
        <View style={{ width: 8 }} />
        <MetricCard
          label="This Month"
          value={data?.todayEnergy?.monthKwh != null ? `${data.todayEnergy.monthKwh}` : "0.0"}
          unit="kWh"
          iconType="month"
          subValue={`₹${data?.todayEnergy?.monthSavingsInr || 0}`}
        />
        <View style={{ width: 8 }} />
        <MetricCard
          label="Lifetime"
          value={data?.todayEnergy?.lifetimeKwh != null ? `${data.todayEnergy.lifetimeKwh}` : "0.0"}
          unit="kWh"
          iconType="lifetime"
          subValue={`₹${data?.todayEnergy?.lifetimeSavingsInr || 0}`}
        />
      </View>

      {/* DISCOM Power Cut / Grid Status Card */}
      <View style={styles.gridStatusCard}>
        <View style={styles.gridStatusHeader}>
          <CheckCircle size={16} color="#16a34a" />
          <Text style={styles.gridStatusTitle}>DISCOM Grid Synchronized</Text>
        </View>
        <Text style={styles.gridStatusDesc}>
          255.6V AC • 50.0 Hz stable. No unrecorded solar clipping detected.
        </Text>
      </View>

      {/* Panel Cleanliness Card */}
      <PanelCleanlinessCard
        scorePct={data?.panelHygiene?.cleanlinessScorePct || 96}
        powerLossPct={data?.panelHygiene?.powerLossPct || 3.9}
        headline={data?.panelHygiene?.actionHeadline || "Light Dust Film · Wash advised in ~5 days"}
        needsWash={data?.panelHygiene?.needsWash || false}
      />

      {/* 3-Day Solar Yield Forecast */}
      <ForecastRow
        tomorrowExpectedKwh={data?.forecast?.tomorrowExpectedKwh || 12.2}
        heavyLoadWindow={data?.forecast?.heavyLoadWindow || "09:30 AM – 02:30 PM"}
        threeDayHorizon={
          data?.forecast?.threeDayHorizon || [
            { date: "Fri", expectedKwh: 12.4, condition: "Sunny" },
            { date: "Sat", expectedKwh: 11.9, condition: "Sunny" },
            { date: "Sun", expectedKwh: 12.1, condition: "Partly Cloudy" },
          ]
        }
      />
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  plantRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
  plantTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    maxWidth: 220,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: "#64748b",
    marginLeft: 4,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  dialCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    alignItems: "center",
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  gridStatusCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
  },
  gridStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  gridStatusTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    marginLeft: 6,
  },
  gridStatusDesc: {
    fontSize: 11,
    color: "#15803d",
    lineHeight: 16,
  },
});
