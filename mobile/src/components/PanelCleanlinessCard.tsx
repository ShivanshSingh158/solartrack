import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Sparkles, AlertCircle } from "lucide-react-native";

interface PanelCleanlinessCardProps {
  scorePct: number;
  powerLossPct: number;
  headline: string;
  needsWash: boolean;
}

export const PanelCleanlinessCard: React.FC<PanelCleanlinessCardProps> = ({
  scorePct,
  powerLossPct,
  headline,
  needsWash,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={16} color="#0284c7" />
          <Text style={styles.title}>Panel Cleanliness Index</Text>
        </View>
        <View style={[styles.scoreBadge, needsWash ? styles.scoreWarning : styles.scoreGood]}>
          <Text style={[styles.scoreText, needsWash ? styles.textWarning : styles.textGood]}>
            {scorePct}% Clean
          </Text>
        </View>
      </View>

      <Text style={styles.headline}>{headline}</Text>

      <View style={styles.footer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Current Dust Loss</Text>
          <Text style={styles.statValue}>-{powerLossPct}%</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Action</Text>
          <Text style={[styles.statValue, needsWash ? styles.textWarning : styles.textGood]}>
            {needsWash ? "Wash Advised" : "Clean · No Action"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.85)",
    marginVertical: 8,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
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
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scoreGood: {
    backgroundColor: "#e0f2fe",
  },
  scoreWarning: {
    backgroundColor: "#fef3c7",
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "800",
  },
  textGood: {
    color: "#0369a1",
  },
  textWarning: {
    color: "#b45309",
  },
  headline: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
  },
  statItem: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 2,
  },
});
