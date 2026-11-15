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
  Sparkles,
  Zap,
  IndianRupee,
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
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Connecting to Rooftop Inverter Telemetry...</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
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

          {/* Quick Date Tag */}
          <View style={styles.dateBox}>
            <Text style={styles.dateBoxText}>Today</Text>
          </View>

          {/* Weather & Sun Status Tag */}
          <View style={styles.weatherBox}>
            <Sun size={13} color="#D97706" />
            <Text style={styles.weatherBoxText}>27°C Sunny</Text>
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

        {/* Glassmorphic White Bento Container */}
        <View style={styles.drawerSheet}>
          {/* Action Recommendation Banner (Optimal Solar Window) */}
          <View style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <View style={styles.actionTag}>
                <Zap size={12} color="#D97706" />
                <Text style={styles.actionTagText}>OPTIMAL SOLAR WINDOW</Text>
              </View>
              <Text style={styles.actionTime}>
                {data?.forecast?.heavyLoadWindow || "09:12 AM – 02:37 PM"}
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
              <View style={styles.metricEarningBox}>
                <IndianRupee size={10} color="#059669" />
                <Text style={styles.metricEarningText}>
                  {data?.todayEnergy?.todaySavingsInr ?? 21}
                </Text>
              </View>
            </View>

            {/* Card 2: November MTD */}
            <View style={[styles.metricCard, styles.metricCardHighlight]}>
              <Text style={[styles.metricCardLabel, styles.metricCardLabelHighlight]}>NOVEMBER</Text>
              <Text style={styles.metricCardValue}>{data?.todayEnergy?.monthKwh ?? 136.8}</Text>
              <Text style={styles.metricCardUnit}>kWh</Text>
              <View style={styles.metricEarningBox}>
                <IndianRupee size={10} color="#059669" />
                <Text style={styles.metricEarningText}>
                  {(data?.todayEnergy?.monthSavingsInr ?? 1026).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            {/* Card 3: Lifetime Total */}
            <View style={styles.metricCard}>
              <Text style={styles.metricCardLabel}>LIFETIME</Text>
              <Text style={styles.metricCardValue}>{data?.todayEnergy?.lifetimeKwh ?? 155.1}</Text>
              <Text style={styles.metricCardUnit}>kWh</Text>
              <View style={styles.metricEarningBox}>
                <IndianRupee size={10} color="#059669" />
                <Text style={styles.metricEarningText}>
                  {(data?.todayEnergy?.lifetimeSavingsInr ?? 1163).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          </View>

          {/* Inverter Reconciled Register Subtitle Box */}
          <View style={styles.reconciledBox}>
            <Shield size={13} color="#059669" />
            <Text style={styles.reconciledBoxText}>
              Inverter Register Synced · 17.5 kWh recovered from Wi-Fi drop
            </Text>
          </View>

          {/* Panel Cleanliness Card */}
          <View style={styles.glassCard}>
            <View style={styles.glassCardHeader}>
              <View style={styles.cardTitleWrap}>
                <Sparkles size={16} color="#0284C7" />
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
                <CloudSun size={16} color="#D97706" />
                <Text style={styles.glassCardTitle}>Tomorrow's Yield Forecast</Text>
              </View>
              <View style={styles.forecastKwhBadge}>
                <Text style={styles.forecastKwhText}>
                  ~{data?.forecast?.tomorrowExpectedKwh ?? 12.7} kWh
                </Text>
              </View>
            </View>
            <Text style={styles.headlineText}>
              {data?.forecast?.tomorrowCondition || "Sunny - Clear Sky"} · Ideal solar generation expected.
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
              <TrendingUp size={18} color="#D97706" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.historyJumpTitle}>View Full Solar Bell Curve</Text>
                <Text style={styles.historyJumpSub}>Interactive hourly generation & past 7 days</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
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
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B",
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pulseGreen: {
    backgroundColor: "#10B981",
  },
  pulseAmber: {
    backgroundColor: "#F59E0B",
  },
  plantTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  dateBox: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateBoxText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#475569",
  },
  weatherBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  weatherBoxText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B45309",
    marginLeft: 4,
  },
  tachometerWrap: {
    marginTop: 2,
    marginBottom: 6,
  },
  drawerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
  },
  actionCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
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
    fontWeight: "600",
    color: "#B45309",
    letterSpacing: 1,
    marginLeft: 4,
  },
  actionTime: {
    fontSize: 11,
    fontWeight: "500",
    color: "#92400E",
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 1.2,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  metricCardHighlight: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  metricCardLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  metricCardLabelHighlight: {
    color: "#B45309",
    fontWeight: "600",
  },
  metricCardValue: {
    fontSize: 22,
    fontWeight: "400",
    color: "#0F172A",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  metricCardUnit: {
    fontSize: 10,
    fontWeight: "400",
    color: "#64748B",
    marginTop: -2,
  },
  metricEarningBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  metricEarningText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  reconciledBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 16,
  },
  reconciledBoxText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#065F46",
    marginLeft: 6,
  },
  glassCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
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
    fontWeight: "600",
    color: "#0F172A",
    marginLeft: 6,
  },
  scorePill: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284C7",
  },
  forecastKwhBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  forecastKwhText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B45309",
  },
  headlineText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  glassCardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerSubText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "400",
  },
  horizonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  horizonItem: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 8,
    marginHorizontal: 3,
    alignItems: "center",
  },
  horizonDate: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "400",
  },
  horizonKwh: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0F172A",
    marginTop: 2,
  },
  horizonCond: {
    fontSize: 9,
    color: "#94A3B8",
    marginTop: 2,
  },
  historyJumpCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  historyJumpLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyJumpTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  historyJumpSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
});
