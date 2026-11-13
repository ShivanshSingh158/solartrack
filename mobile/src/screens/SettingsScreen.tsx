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
  Info,
} from "lucide-react-native";
import { solarClient, UserProfile } from "../api/solarClient";

interface SettingsScreenProps {
  user: UserProfile;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onLogout }) => {
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [nightModeEnabled, setNightModeEnabled] = useState(false);

  const handleMarkCleaned = async () => {
    setCleaningLoading(true);
    const ok = await solarClient.cleanPanels();
    setCleaningLoading(false);
    if (ok) {
      Alert.alert("✅ Panels Marked Clean", "Panel cleanliness counter has been reset. Dust tracking starts fresh from today.", [{ text: "OK" }]);
    } else {
      Alert.alert("Error", "Could not reach the SolarTrack server. Try again later.", [{ text: "OK" }]);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Disconnect your Waaree account from SolarTrack?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: onLogout },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Account, plant config & preferences</Text>
      </View>

      {/* Account Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <User size={18} color="#2563eb" />
          <Text style={styles.cardTitle}>Waaree Account</Text>
        </View>

        <View style={styles.infoRow}>
          <User size={14} color="#94a3b8" />
          <Text style={styles.infoLabel}>Username</Text>
          <Text style={styles.infoValue}>{user.username}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Zap size={14} color="#94a3b8" />
          <Text style={styles.infoLabel}>Plant</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{user.plantName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <MapPin size={14} color="#94a3b8" />
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>Kanpur, UP, India</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <IndianRupee size={14} color="#94a3b8" />
          <Text style={styles.infoLabel}>Tariff</Text>
          <Text style={styles.infoValue}>₹{user.tariffPerKwh ?? 7.35} / kWh</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Zap size={14} color="#94a3b8" />
          <Text style={styles.infoLabel}>Capacity</Text>
          <Text style={styles.infoValue}>{user.capacityKwp ?? 3.27} kWp DC · 3.00 kW AC</Text>
        </View>
      </View>

      {/* BaaS Connection Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <ShieldCheck size={18} color="#059669" />
          <Text style={styles.cardTitle}>BaaS Server Connection</Text>
        </View>
        <View style={styles.connectionStatus}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>solartrack-j9wx.onrender.com</Text>
        </View>
        <Text style={styles.connectionSub}>
          Headless Solar BaaS · 24/7 UptimeRobot keep-alive · 256-bit session encryption
        </Text>
      </View>

      {/* Notifications & Preferences */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Info size={18} color="#7c3aed" />
          <Text style={styles.cardTitle}>Preferences</Text>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLeft}>
            <Text style={styles.switchLabel}>Generation Alerts</Text>
            <Text style={styles.switchSub}>Notify when plant goes offline</Text>
          </View>
          <Switch
            value={alertsEnabled}
            onValueChange={setAlertsEnabled}
            trackColor={{ false: "#e2e8f0", true: "#fde68a" }}
            thumbColor={alertsEnabled ? "#d97706" : "#94a3b8"}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <View style={styles.switchLeft}>
            <Text style={styles.switchLabel}>Auto Night Mode</Text>
            <Text style={styles.switchSub}>Dim UI after 7 PM IST</Text>
          </View>
          <Switch
            value={nightModeEnabled}
            onValueChange={setNightModeEnabled}
            trackColor={{ false: "#e2e8f0", true: "#dbeafe" }}
            thumbColor={nightModeEnabled ? "#2563eb" : "#94a3b8"}
          />
        </View>
      </View>

      {/* Panel Cleaning Action */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Sparkles size={18} color="#0284c7" />
          <Text style={styles.cardTitle}>Panel Maintenance</Text>
        </View>
        <Text style={styles.cleanDesc}>
          After physically cleaning your solar panels, tap below to reset the dust accumulation tracker. The cleanliness index will restart from 100%.
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
              <RefreshCw size={16} color="#0284c7" />
              <Text style={styles.cleanBtnText}>Mark Panels as Cleaned Today</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoTitle}>SolarTrack Mobile v1.0</Text>
        <Text style={styles.appInfoSub}>Expo SDK 58 · Built on Node.js BaaS</Text>
        <Text style={styles.appInfoSub}>Plant: {user.stationId?.slice(0, 8)}…</Text>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color="#dc2626" />
        <Text style={styles.logoutText}>Sign Out of Waaree Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 48 },

  header: { marginBottom: 16, marginTop: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 12, color: "#64748b", fontWeight: "500", marginTop: 2 },

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

  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoLabel: { fontSize: 13, color: "#64748b", marginLeft: 8, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "700", color: "#0f172a", maxWidth: 180, textAlign: "right" },
  divider: { height: 1, backgroundColor: "#f8fafc" },

  connectionStatus: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981", marginRight: 8 },
  onlineText: { fontSize: 13, fontWeight: "700", color: "#059669" },
  connectionSub: { fontSize: 11, color: "#64748b", lineHeight: 16 },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  switchLeft: { flex: 1, paddingRight: 16 },
  switchLabel: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  switchSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  cleanDesc: { fontSize: 12, color: "#64748b", lineHeight: 18, marginBottom: 14 },
  cleanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f2fe",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  cleanBtnText: { fontSize: 13, fontWeight: "700", color: "#0284c7", marginLeft: 8 },

  appInfo: { alignItems: "center", marginVertical: 16 },
  appInfoTitle: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  appInfoSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 16,
  },
  logoutText: { fontSize: 14, fontWeight: "700", color: "#dc2626", marginLeft: 8 },
});
