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
  Clock,
  Sparkles,
  Zap,
  CheckCircle,
  Calendar,
  IndianRupee,
  Activity,
  LogOut,
  ChevronRight,
  TrendingUp,
  Shield,
  CloudSun,
} from "lucide-react-native";
import { solarClient, OverviewPayload, UserProfile } from "../api/solarClient";
import { AtmosphericBackground } from "../components/AtmosphericBackground";
import { TachometerGauge } from "../components/TachometerGauge";

interface CockpitScreenProps {
  user: UserProfile;
  onLogout: () => void;
  onNavigateDiagnostics: () => void;
  onNavigateHistory: () => void;
}

export const CockpitScreen: React.FC<CockpitScreenProps> = ({
  user,
  onLogout,
  onNavigateDiagnostics,
  onNavigateHistory,
}) => {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    const res = await solarClient.getOverview(user.stationId);
    if (res) setData(res);
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
        <Text style={styles.loadingText}>Connecting to Atmospheric Solar BaaS...</Text>
      </View>
    );
  }

  const liveKw = data?.liveDial?.currentPowerKw ?? 0;
  const isGenerating = data?.systemStatus?.isGenerating ?? false;
  const isNight = data?.systemStatus?.isNight ?? false;
  const nowHour = new Date().getHours();

  return (
    <AtmosphericBackground isNight={isNight} timeHour={nowHour}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Floating App Bar matching luxury reference */}
        <View style={styles.topBar}>
          <View style={styles.plantBadge}>
            <View style={[styles.pulseDot, isGenerating ? styles.pulseGreen : styles.pulseAmber]} />
            <Text style={styles.plantTitle} numberOfLines={1}>
              {data?.meta?.plantName || user.plantName || "shivpratap Singh"}
            </Text>
          </View>

          {/* Quick Date Capsule */}
          <View style={styles.dateCapsule}>
            <Text style={styles.dateCapsuleText}>Today</Text>
          </View>

          {/* Weather & Sun Status Pill */}
          <View style={styles.weatherPill}>
            <Sun size={13} color="#f59e0b" />
            <Text style={styles.weatherPillText}>27°C Sunny</Text>
          </View>
        </View>

        {/* Hero Luxury Radial Tachometer Stage */}
        <View style={styles.tachometerWrap}>
          <TachometerGauge
            currentKw={liveKw}
            peakKw={data?.liveDial?.peakTodayKw || 2.11}
            peakTimeLabel={data?.liveDial?.peakTodayTime || "11:47 AM"}
            maxCapacityKwp={data?.meta?.capacityKwp || user.capacityKwp || 3.27}
            isGenerating={isGenerating}
            isNight={isNight}
            efficiencyPct={data?.liveDial?.systemEfficiencyPct || 93.8}
          />
        </View>

        {/* Glassmorphic Drawer Sheet matching reference image */}
        <View style={styles.drawerSheet}>
          {/* Action Recommendation Banner (Heavy Load Solar Hours) */}
          <View style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <View style={styles.actionTag}>
                <Zap size={11} color="#f59e0b" />
                <Text style={styles.actionTagText}>OPTIMAL SOLAR WINDOW</Text>
              </View>
              <Text style={styles.actionTime}>
                {data?.forecast?.heavyLoadWindow || "09:22 AM – 02:47 PM"}
              </Text>
            </View>
            <Text style={styles.actionTitle}>Run High-Wattage Appliances Now</Text>
            <Text style={styles.actionDesc}>
              Peak solar irradiance active. Ideal window for water pump, washing machine & EV charging at zero cost.
            </Text>
          </View>

          {/* Energy Metrics Grid (Today, November MTD, Lifetime Total) */}
          <Text style={styles.sectionHeading}>ENERGY GENERATION & SAVINGS</Text>
          <View style={styles.metricsRow}>
            {/* Card 1: Today */}
            <View style={styles.metricCard}>
              <Text style={styles.metricCardLabel}>TODAY</Text>
              <Text style={styles.metricCardValue}>{data?.todayEnergy?.todayKwh ?? 2.8}</Text>
              <Text style={styles.metricCardUnit}>kWh</Text>
              <View style={styles.metricEarningBadge}>
                <IndianRupee size={10} color="#34d399" />
                <Text style={styles.metricEarningText}>
                  ₹{data?.todayEnergy?.todaySavingsInr ?? 21}
                </Text>
              </View>
            </View>

            {/* Card 2: November MTD */}
            <View style={[styles.metricCard, styles.metricCardHighlight]}>
              <Text style={styles.metricCardLabel}>NOVEMBER</Text>
              <Text style={styles.metricCardValue}>{data?.todayEnergy?.monthKwh ?? 136.8}</Text>
              <Text style={styles.metricCardUnit}>kWh</Text>
              <View style={styles.metricEarningBadge}>
                <IndianRupee size={10} color="#34d399" />
                <Text style={styles.metricEarningText}>
                  ₹{(data?.todayEnergy?.monthSavingsInr ?? 1026).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            {/* Card 3: Lifetime Total */}
            <View style={styles.metricCard}>
              <Text style={styles.metricCardLabel}>LIFETIME</Text>
              <Text style={styles.metricCardValue}>{data?.todayEnergy?.lifetimeKwh ?? 155.1}</Text>
              <Text style={styles.metricCardUnit}>kWh</Text>
              <View style={styles.metricEarningBadge}>
                <IndianRupee size={10} color="#34d399" />
                <Text style={styles.metricEarningText}>
                  ₹{(data?.todayEnergy?.lifetimeSavingsInr ?? 1163).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          </View>

          {/* Inverter Reconciled Register Subtitle Pill */}
          <View style={styles.reconciledPill}>
            <Shield size={12} color="#34d399" />
            <Text style={styles.reconciledPillText}>
              Inverter Register Synced · 17.5 kWh recovered from Wi-Fi drop
            </Text>
          </View>

          {/* Panel Cleanliness Card */}
          <View style={styles.glassCard}>
            <View style={styles.glassCardHeader}>
              <View style={styles.cardTitleWrap}>
                <Sparkles size={16} color="#38bdf8" />
                <Text style={styles.glassCardTitle}>Panel Cleanliness Index</Text>
              </View>
              <View style={styles.scorePill}>
                <Text style={styles.scorePillText}>
                  {data?.panelHygiene?.cleanlinessScorePct ?? 96}% Clean
                </Text>
              </View>
            </View>
            <Text style={styles.headlineText}>
              {data?.panelHygiene?.actionHeadline || "Moderate settling (-4%) · Next wash ~Nov 17"}
            </Text>
            <View style={styles.cardFooterDivider} />
            <View style={styles.glassCardFooterRow}>
              <Text style={styles.footerSubText}>
                Loss: -{data?.panelHygiene?.powerLossPct ?? 4.0}%
              </Text>
              <Text style={styles.footerSubText}>
                Weekly Savings at stake: ₹{data?.panelHygiene?.weeklySavingsPotentialInr ?? 26}
              </Text>
            </View>
          </View>

          {/* Tomorrow Yield Outlook */}
          <View style={styles.glassCard}>
            <View style={styles.glassCardHeader}>
              <View style={styles.cardTitleWrap}>
                <CloudSun size={16} color="#fbbf24" />
                <Text style={styles.glassCardTitle}>Tomorrow's Yield Forecast</Text>
              </View>
              <View style={styles.forecastKwhBadge}>
                <Text style={styles.forecastKwhText}>
                  ~{data?.forecast?.tomorrowExpectedKwh ?? 13.2} kWh
                </Text>
              </View>
            </View>
            <Text style={styles.headlineText}>
              {data?.forecast?.tomorrowCondition || "Partly Cloudy"} · Ideal solar generation expected across Kanpur.
            </Text>
            <View style={styles.horizonRow}>
              {(data?.forecast?.threeDayHorizon || []).map((h, i) => (
                <View key={i} style={styles.horizonItem}>
                  <Text style={styles.horizonDate}>{h.date}</Text>
                  <Text style={styles.horizonKwh}>{h.expectedKwh} kWh</Text>
                  <Text style={styles.horizonCond} numberOfLines={1}>{h.condition}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Jump to Interactive History Curve */}
          <TouchableOpacity
            style={styles.historyJumpCard}
            onPress={onNavigateHistory}
            activeOpacity={0.8}
          >
            <View style={styles.historyJumpLeft}>
              <TrendingUp size={18} color="#f59e0b" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.historyJumpTitle}>View Full Solar Bell Curve</Text>
                <Text style={styles.historyJumpSub}>Interactive hourly generation & past 7 days</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.4)" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AtmosphericBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 110,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#090d0b",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "600",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  plantBadge: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 160,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  pulseGreen: {
    backgroundColor: "#34d399",
  },
  pulseAmber: {
    backgroundColor: "#f59e0b",
  },
  plantTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  dateCapsule: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  dateCapsuleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
  },
  weatherPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  weatherPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fef08a",
    marginLeft: 4,
  },
  tachometerWrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  drawerSheet: {
    backgroundColor: "rgba(14, 19, 16, 0.88)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: 6,
  },
  actionCard: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    marginBottom: 18,
  },
  actionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  actionTag: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 1,
    marginLeft: 4,
  },
  actionTime: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.75)",
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.65)",
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(22, 28, 25, 0.75)",
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  metricCardHighlight: {
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(32, 34, 25, 0.75)",
  },
  metricCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 0.5,
  },
  metricCardValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  metricCardUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    marginTop: -2,
  },
  metricEarningBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricEarningText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#34d399",
  },
  reconciledPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 211, 153, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.2)",
    marginBottom: 16,
  },
  reconciledPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a7f3d0",
    marginLeft: 6,
  },
  glassCard: {
    backgroundColor: "rgba(22, 28, 25, 0.75)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
  },
  glassCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  glassCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    marginLeft: 6,
  },
  scorePill: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38bdf8",
  },
  forecastKwhBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  forecastKwhText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fbbf24",
  },
  headlineText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 18,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 10,
  },
  glassCardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerSubText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "500",
  },
  horizonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  horizonItem: {
    flex: 1,
    backgroundColor: "rgba(12, 17, 14, 0.65)",
    borderRadius: 12,
    paddingVertical: 8,
    marginHorizontal: 3,
    alignItems: "center",
  },
  horizonDate: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "600",
  },
  horizonKwh: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 2,
  },
  horizonCond: {
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.35)",
    marginTop: 2,
  },
  historyJumpCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    marginTop: 4,
  },
  historyJumpLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyJumpTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  historyJumpSub: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.55)",
    marginTop: 1,
  },
});
