import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Zap, IndianRupee, Calendar, Award } from "lucide-react-native";

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  subValue?: string;
  iconType: "today" | "month" | "lifetime";
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subValue,
  iconType,
  highlight = false,
}) => {
  const renderIcon = () => {
    switch (iconType) {
      case "today":
        return <Zap size={18} color="#d97706" />;
      case "month":
        return <Calendar size={18} color="#2563eb" />;
      case "lifetime":
        return <Award size={18} color="#16a34a" />;
    }
  };

  const getIconBg = () => {
    switch (iconType) {
      case "today":
        return "#fef3c7";
      case "month":
        return "#dbeafe";
      case "lifetime":
        return "#dcfce7";
    }
  };

  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: getIconBg() }]}>
          {renderIcon()}
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {subValue ? (
        <View style={styles.subRow}>
          <IndianRupee size={12} color="#059669" />
          <Text style={styles.subValue}>{subValue}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.85)",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    flex: 1,
    minWidth: 100,
  },
  cardHighlight: {
    borderColor: "#fde68a",
    backgroundColor: "#fffdfa",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  unit: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginLeft: 4,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  subValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    marginLeft: 2,
  },
});
