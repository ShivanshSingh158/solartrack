import React, { useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { solarClient, UserProfile } from "./src/api/solarClient";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CockpitScreen } from "./src/screens/CockpitScreen";
import { DiagnosticsScreen } from "./src/screens/DiagnosticsScreen";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<"cockpit" | "diagnostics">("cockpit");

  useEffect(() => {
    async function checkAuthSession() {
      await solarClient.init();
      const savedUser = await solarClient.getSavedUser();
      const status = await solarClient.getStatus();

      if (status.authenticated) {
        setUser(status.user || savedUser || {
          username: "Solar User",
          plantName: "Rooftop Solar Plant",
          stationId: "",
        });
      } else if (savedUser) {
        setUser(savedUser);
      }
      setLoading(false);
    }
    checkAuthSession();
  }, []);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setCurrentScreen("cockpit");
  };

  const handleLogout = async () => {
    await solarClient.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="dark" />
        {!user ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        ) : currentScreen === "diagnostics" ? (
          <DiagnosticsScreen user={user} onBack={() => setCurrentScreen("cockpit")} />
        ) : (
          <CockpitScreen
            user={user}
            onLogout={handleLogout}
            onNavigateDiagnostics={() => setCurrentScreen("diagnostics")}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
});
