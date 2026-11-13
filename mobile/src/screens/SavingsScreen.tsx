import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { IndianRupee, Leaf, Zap, TrendingUp, Award } from "lucide-react-native";
import { solarClient, SavingsPayload, UserProfile } from "../api/solarClient";

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
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading Savings Report...</Text>
      </View>
    );
  }

  const s = data?.savings;
  const e = data?.environmental;
  const tariff = data?.tariffPerKwh ?? 7.35;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#059669"]} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Savings & Credits</Text>
        <Text style={styles.headerSubtitle}>Financial & environmental impact of your plant</Text>
      </View>

      {/* Hero Lifetime Savings Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Award size={22} color="#059669" />
          </View>
          <Text style={styles.heroLabel}>Lifetime Solar Savings</Text>
        </View>
        <Text style={styles.heroValue}>
          ₹{(s?.lifetimeInr ?? 1120).toLocaleString("en-IN")}
        </Text>
        <Text style={styles.heroSub}>
          Since commissioning · ₹{tariff}/kWh tariff
        </Text>
      </View>

      {/* Savings Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <IndianRupee size={18} color="#16a34a" />
          <Text style={styles.cardTitle}>Savings Breakdown</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>Today</Text>
            <Text style={styles.rowSub}>From live generation</Text>
          </View>
          <Text style={styles.rowGreen}>₹{s?.todayInr ?? 72}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>This Month</Text>
            <Text style={styles.rowSub}>November 2026</Text>
          </View>
          <Text style={styles.rowGreen}>₹{(s?.monthInr ?? 986).toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowLabel}>Projected Annual</Text>
            <Text style={styles.rowSub}>Based on plant capacity</Text>
          </View>
          <Text style={styles.rowGreen}>₹{(s?.projectedAnnualInr ?? 10658).toLocaleString("en-IN")}</Text>
        </View>
      </View>

      {/* Carbon & Environmental Impact */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Leaf size={18} color="#16a34a" />
          <Text style={styles.cardTitle}>Environmental Impact</Text>
        </View>

        <View style={styles.envGrid}>
          <View style={styles.envItem}>
            <View style={[styles.envIconWrap, { backgroundColor: "#dcfce7" }]}>
              <Leaf size={20} color="#16a34a" />
            </View>
            <Text style={styles.envValue}>{(e?.co2AvoidedKg ?? 130).toLocaleString("en-IN")} kg</Text>
            <Text style={styles.envLabel}>CO₂ Avoided</Text>
          </View>

          <View style={styles.envItem}>
            <View style={[styles.envIconWrap, { backgroundColor: "#fef3c7" }]}>
              <TrendingUp size={20} color="#d97706" />
            </View>
            <Text style={styles.envValue}>{e?.treesEquivalent ?? 6}</Text>
            <Text style={styles.envLabel}>Trees Equivalent</Text>
          </View>

          <View style={styles.envItem}>
            <View style={[styles.envIconWrap, { backgroundColor: "#f1f5f9" }]}>
              <Zap size={20} color="#64748b" />
            </View>
            <Text style={styles.envValue}>{e?.coalSavedKg ?? 61} kg</Text>
            <Text style={styles.envLabel}>Coal Saved</Text>
          </View>
        </View>
      </View>

      {/* Tariff Info */}
      <View style={styles.tariffCard}>
        <Text style={styles.tariffLabel}>Current Electricity Tariff (Kanpur DISCOM)</Text>
        <Text style={styles.tariffValue}>₹{tariff} / kWh</Text>
        <Text style={styles.tariffSub}>Set in Settings · Net metering applicable</Text>
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
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 12, color: "#64748b", fontWeight: "500", marginTop: 2 },

  heroCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  heroIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  heroLabel: { fontSize: 14, fontWeight: "700", color: "#166534" },
  heroValue: { fontSize: 40, fontWeight: "900", color: "#15803d", marginBottom: 4 },
  heroSub: { fontSize: 12, color: "#16a34a", fontWeight: "500" },

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
  cardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginLeft: 8 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  rowSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  rowGreen: { fontSize: 18, fontWeight: "800", color: "#16a34a" },
  divider: { height: 1, backgroundColor: "#f1f5f9" },

  envGrid: { flexDirection: "row", justifyContent: "space-between" },
  envItem: { flex: 1, alignItems: "center", padding: 8 },
  envIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  envValue: { fontSize: 15, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  envLabel: { fontSize: 11, color: "#64748b", fontWeight: "600", textAlign: "center", marginTop: 2 },

  tariffCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  tariffLabel: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  tariffValue: { fontSize: 24, fontWeight: "900", color: "#b45309", marginVertical: 4 },
  tariffSub: { fontSize: 11, color: "#d97706", fontWeight: "500" },
});
