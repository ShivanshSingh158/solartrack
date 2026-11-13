import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import {
  Sparkles,
  LogOut,
  User,
  MapPin,
  Zap,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Server,
} from "lucide-react-native";
import { solarClient, UserProfile } from "../api/solarClient";
import { AtmosphericBackground } from "../components/AtmosphericBackground";

interface SettingsScreenProps {
  user: UserProfile;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onLogout }) => {
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const handleMarkCleaned = async () => {
    setCleaningLoading(true);
    const ok = await solarClient.cleanPanels();
    setCleaningLoading(false);
    if (ok) {
      Alert.alert(
        "✅ Panels Marked Clean",
        "The dust accumulation model has been reset to 100% cleanliness starting from today.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert("Error", "Could not reach server. Try again later.", [{ text: "OK" }]);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Disconnect your Waaree plant session?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: onLogout },
      ]
    );
  };

  return (
    <AtmosphericBackground isNight={false} timeHour={12}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Plant & System Settings</Text>
          <Text style={styles.headerSubtitle}>Solar BaaS cloud infrastructure & configurations</Text>
        </View>

        {/* Account & Plant Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <User size={16} color="#60a5fa" />
            <Text style={styles.cardTitle}>Waaree Cloud Profile</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account</Text>
            <Text style={styles.infoValue}>{user.username}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plant Name</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{user.plantName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>Kanpur, UP (26.50° N, 80.24° E)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DC Rating</Text>
            <Text style={styles.infoValue}>{user.capacityKwp ?? 3.27} kWp DC / 3.00 kW AC</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DISCOM Tariff</Text>
            <Text style={styles.infoValue}>₹{user.tariffPerKwh ?? 7.35} / kWh</Text>
          </View>
        </View>

        {/* BaaS Cloud Status */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Server size={16} color="#34d399" />
            <Text style={styles.cardTitle}>Headless Solar BaaS</Text>
          </View>

          <View style={styles.connectionStatus}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>solartrack-j9wx.onrender.com</Text>
          </View>
          <Text style={styles.connectionSub}>
            24/7 keep-alive active · 256-bit crypto session tokens · Inverter EEPROM memory sync
          </Text>
        </View>

        {/* Panel Cleaning Maintenance Action */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Sparkles size={16} color="#38bdf8" />
            <Text style={styles.cardTitle}>Panel Maintenance Reset</Text>
          </View>
          <Text style={styles.cleanDesc}>
            After washing your rooftop solar panels, tap below to reset the physics soiling tracker to 100% clean.
          </Text>
          <TouchableOpacity
            style={styles.cleanBtn}
            onPress={handleMarkCleaned}
            disabled={cleaningLoading}
            activeOpacity={0.8}
          >
            {cleaningLoading ? (
              <ActivityIndicator color="#0284c7" size="small" />
            ) : (
              <>
                <RefreshCw size={15} color="#0284c7" />
                <Text style={styles.cleanBtnText}>Mark Panels as Cleaned Today</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={16} color="#f87171" />
          <Text style={styles.logoutText}>Sign Out of Waaree Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </AtmosphericBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  header: { marginBottom: 16, marginTop: 8 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: "rgba(255, 255, 255, 0.55)", fontWeight: "500", marginTop: 2 },
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
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  infoLabel: { fontSize: 12, color: "rgba(255, 255, 255, 0.5)" },
  infoValue: { fontSize: 12, fontWeight: "700", color: "#ffffff", maxWidth: 190, textAlign: "right" },
  divider: { height: 1, backgroundColor: "rgba(255, 255, 255, 0.05)" },
  connectionStatus: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#34d399", marginRight: 6 },
  onlineText: { fontSize: 12, fontWeight: "700", color: "#34d399" },
  connectionSub: { fontSize: 11, color: "rgba(255, 255, 255, 0.55)", lineHeight: 16 },
  cleanDesc: { fontSize: 12, color: "rgba(255, 255, 255, 0.65)", lineHeight: 18, marginBottom: 12 },
  cleanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  cleanBtnText: { fontSize: 12, fontWeight: "700", color: "#38bdf8", marginLeft: 6 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    marginTop: 6,
    marginBottom: 20,
  },
  logoutText: { fontSize: 13, fontWeight: "700", color: "#f87171", marginLeft: 6 },
});
