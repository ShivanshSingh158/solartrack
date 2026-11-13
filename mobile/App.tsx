import React, { useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Sun, TrendingUp, Activity, IndianRupee, Settings } from "lucide-react-native";
import { solarClient, UserProfile } from "./src/api/solarClient";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CockpitScreen } from "./src/screens/CockpitScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { DiagnosticsScreen } from "./src/screens/DiagnosticsScreen";
import { SavingsScreen } from "./src/screens/SavingsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { FloatingPillTabBar, TabId, TabItemDef } from "./src/components/FloatingPillTabBar";

const TABS: TabItemDef[] = [
  { id: "cockpit",     label: "Cockpit",     Icon: Sun },
  { id: "history",    label: "History",     Icon: TrendingUp },
  { id: "diagnostics",label: "Health",      Icon: Activity },
  { id: "savings",    label: "Credits",     Icon: IndianRupee },
  { id: "settings",   label: "Settings",    Icon: Settings },
];

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
            onNavigateHistory={() => setActiveTab("history")}
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
      <FloatingPillTabBar activeTab={activeTab} onSelect={setActiveTab} tabs={TABS} />
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
        const status = await solarClient.getStatus();
        if (status.authenticated) {
          setUser(status.user || savedUser);
        } else {
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
      <ExpoStatusBar style="light" />
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
    backgroundColor: "#090d0b",
    justifyContent: "center",
    alignItems: "center",
  },
  root: {
    flex: 1,
    backgroundColor: "#090d0b",
  },
  appContainer: {
    flex: 1,
    backgroundColor: "#090d0b",
  },
  screenArea: {
    flex: 1,
  },
});
