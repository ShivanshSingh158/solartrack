import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  TouchableOpacity,
  Text,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Home, TrendingUp, Activity, IndianRupee, Settings } from "lucide-react-native";
import { solarClient, UserProfile } from "./src/api/solarClient";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CockpitScreen } from "./src/screens/CockpitScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { DiagnosticsScreen } from "./src/screens/DiagnosticsScreen";
import { SavingsScreen } from "./src/screens/SavingsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

type TabId = "cockpit" | "history" | "diagnostics" | "savings" | "settings";

interface TabDef {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const TABS: TabDef[] = [
  { id: "cockpit",     label: "Home",        Icon: Home },
  { id: "history",    label: "History",     Icon: TrendingUp },
  { id: "diagnostics",label: "Health",      Icon: Activity },
  { id: "savings",    label: "Savings",     Icon: IndianRupee },
  { id: "settings",   label: "Settings",    Icon: Settings },
];

function BottomTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: TabId;
  onSelect: (id: TabId) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 4 }]}>
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <TouchableOpacity
            key={id}
            style={styles.tabItem}
            onPress={() => onSelect(id)}
            activeOpacity={0.75}
          >
            <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
              <Icon size={20} color={active ? "#d97706" : "#94a3b8"} />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainApp({
  user,
  onLogout,
}: {
  user: UserProfile;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("cockpit");

  const renderScreen = () => {
    switch (activeTab) {
      case "cockpit":
        return (
          <CockpitScreen
            user={user}
            onLogout={onLogout}
            onNavigateDiagnostics={() => setActiveTab("diagnostics")}
          />
        );
      case "history":
        return <HistoryScreen user={user} />;
      case "diagnostics":
        return <DiagnosticsScreen user={user} onBack={() => setActiveTab("cockpit")} />;
      case "savings":
        return <SavingsScreen user={user} />;
      case "settings":
        return <SettingsScreen user={user} onLogout={onLogout} />;
    }
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.screenArea}>{renderScreen()}</View>
      <BottomTabBar activeTab={activeTab} onSelect={setActiveTab} />
    </View>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      await solarClient.init();
      const savedUser = await solarClient.getSavedUser();
      if (savedUser) {
        // Silently verify token still works
        const status = await solarClient.getStatus();
        if (status.authenticated) {
          setUser(status.user || savedUser);
        } else {
          // Token expired — force fresh login
          await solarClient.logout();
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    await solarClient.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ExpoStatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={["top"]}>
        {!user ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        ) : (
          <MainApp user={user} onLogout={handleLogout} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  appContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  screenArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  tabIconWrap: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: "#fef3c7",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 2,
  },
  tabLabelActive: {
    color: "#d97706",
    fontWeight: "700",
  },
});
