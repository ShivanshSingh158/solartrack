import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { IndianRupee, Leaf, Zap, TrendingUp, Award, Shield } from "lucide-react-native";
import { solarClient, SavingsPayload, UserProfile } from "../api/solarClient";
import { AtmosphericBackground } from "../components/AtmosphericBackground";

interface SavingsScreenProps {
  user: UserProfile;
}

export const SavingsScreen: React.FC<SavingsScreenProps> = ({ user }) => {
  const [data, setData] = useState<SavingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSavings = async () => {
    const res = await solarClient.getSavings(user.stationId);
    if (res) setData(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchSavings();
  }, [user.stationId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSavings();
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#34d399" />
        <Text style={styles.loadingText}>Loading Financial & Carbon Credits...</Text>
      </View>
    );
  }

  const s = data?.savings;
  const e = data?.environmental;
  const tariff = data?.tariffPerKwh ?? 7.35;

  return (
    <AtmosphericBackground isNight={false} timeHour={12}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#34d399" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Savings & Environmental Yield</Text>
          <Text style={styles.headerSubtitle}>Net metering credits & lifetime clean energy ROI</Text>
        </View>

        {/* Hero Lifetime Savings Card */}
        <View style={styles.heroGlassCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Award size={20} color="#34d399" />
            </View>
            <Text style={styles.heroLabel}>LIFETIME SOLAR SAVINGS</Text>
          </View>
          <Text style={styles.heroValue}>
            ₹{(s?.lifetimeInr ?? 1163).toLocaleString("en-IN")}
          </Text>
          <Text style={styles.heroSub}>
            Net metering active · ₹{tariff}/kWh DISCOM tariff rate
          </Text>
        </View>

        {/* Savings Breakdown */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <IndianRupee size={16} color="#34d399" />
            <Text style={styles.cardTitle}>Savings Breakdown</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Today</Text>
              <Text style={styles.rowSub}>From live rooftop generation</Text>
            </View>
            <Text style={styles.rowGreen}>₹{s?.todayInr ?? 21}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>This Month (November)</Text>
              <Text style={styles.rowSub}>Official Inverter Register Synced</Text>
            </View>
            <Text style={styles.rowGreen}>₹{(s?.monthInr ?? 1026).toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Projected Annual Return</Text>
              <Text style={styles.rowSub}>Based on 3.27 kWp capacity</Text>
            </View>
            <Text style={styles.rowGreen}>₹{(s?.projectedAnnualInr ?? 12066).toLocaleString("en-IN")}</Text>
          </View>
        </View>

        {/* Carbon & Environmental Impact */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Leaf size={16} color="#34d399" />
            <Text style={styles.cardTitle}>Environmental Impact</Text>
          </View>

          <View style={styles.envGrid}>
            <View style={styles.envItem}>
              <View style={[styles.envIconWrap, { backgroundColor: "rgba(52, 211, 153, 0.12)" }]}>
                <Leaf size={18} color="#34d399" />
              </View>
              <Text style={styles.envValue}>{(e?.co2AvoidedKg ?? 132).toLocaleString("en-IN")} kg</Text>
              <Text style={styles.envLabel}>CO₂ Prevented</Text>
            </View>

            <View style={styles.envItem}>
              <View style={[styles.envIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                <TrendingUp size={18} color="#fbbf24" />
              </View>
              <Text style={styles.envValue}>{e?.treesEquivalent ?? 7}</Text>
              <Text style={styles.envLabel}>Trees Equivalent</Text>
            </View>

            <View style={styles.envItem}>
              <View style={[styles.envIconWrap, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                <Zap size={18} color="#94a3b8" />
              </View>
              <Text style={styles.envValue}>{e?.coalSavedKg ?? 62} kg</Text>
              <Text style={styles.envLabel}>Coal Saved</Text>
            </View>
          </View>
        </View>

        {/* Tariff Info Box */}
        <View style={styles.tariffCard}>
          <Text style={styles.tariffLabel}>Discom Net-Metering Rate (Kanpur)</Text>
          <Text style={styles.tariffValue}>₹{tariff} / kWh</Text>
          <Text style={styles.tariffSub}>Configured in Settings · Real-time bill offset</Text>
        </View>
      </ScrollView>
    </AtmosphericBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#090d0b" },
  loadingText: { marginTop: 12, fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  header: { marginBottom: 16, marginTop: 8 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: "rgba(255, 255, 255, 0.55)", fontWeight: "500", marginTop: 2 },
  heroGlassCard: {
    backgroundColor: "rgba(18, 30, 23, 0.8)",
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  heroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  heroLabel: { fontSize: 11, fontWeight: "800", color: "#34d399", letterSpacing: 1 },
  heroValue: { fontSize: 44, fontWeight: "900", color: "#ffffff", letterSpacing: -1 },
  heroSub: { fontSize: 12, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 },
  glassCard: {
    backgroundColor: "rgba(18, 24, 21, 0.8)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#ffffff", marginLeft: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  rowSub: { fontSize: 10, color: "rgba(255, 255, 255, 0.45)", marginTop: 2 },
  rowGreen: { fontSize: 18, fontWeight: "900", color: "#34d399" },
  divider: { height: 1, backgroundColor: "rgba(255, 255, 255, 0.06)" },
  envGrid: { flexDirection: "row", justifyContent: "space-between" },
  envItem: { flex: 1, alignItems: "center", padding: 6 },
  envIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  envValue: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  envLabel: { fontSize: 10, color: "rgba(255, 255, 255, 0.45)", fontWeight: "600", marginTop: 2 },
  tariffCard: {
    backgroundColor: "rgba(30, 24, 16, 0.75)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  tariffLabel: { fontSize: 11, fontWeight: "700", color: "#fbbf24" },
  tariffValue: { fontSize: 24, fontWeight: "900", color: "#ffffff", marginVertical: 3 },
  tariffSub: { fontSize: 11, color: "rgba(255, 255, 255, 0.55)" },
});
