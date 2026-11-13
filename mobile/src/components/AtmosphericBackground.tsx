import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from "react-native-svg";

interface AtmosphericBackgroundProps {
  isNight?: boolean;
  timeHour?: number;
  children: React.ReactNode;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({
  isNight = false,
  timeHour = 11,
  children,
}) => {
  // Morning (6-9): Soft golden sunrise mist
  // Noon / Midday (10-15): Radiant warm solar butter glow (SolarTrack web signature)
  // Sunset (16-18): Peach apricot sunset glow
  // Night: Crisp clean twilight slate
  const isMorning = timeHour >= 6 && timeHour < 10;
  const isSunset = timeHour >= 16 && timeHour < 19;
  const isNoon = !isNight && !isMorning && !isSunset;

  const sunGlowColor = isNight
    ? "#94A3B8"
    : isMorning
    ? "#FDE68A"
    : isSunset
    ? "#FDBA74"
    : "#FCD34D";

  const sunGlowOpacity = isNight ? 0.06 : isNoon ? 0.35 : 0.25;

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Main Daylight Atmosphere Gradient matching SolarTrack Website */}
          <LinearGradient id="daylightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={isNight ? "#F1F5F9" : isNoon ? "#FEF3C7" : isMorning ? "#FFFBEB" : "#FFEDD5"} stopOpacity={0.9} />
            <Stop offset="28%" stopColor={isNight ? "#F8FAFC" : "#FFFDF5"} stopOpacity={0.95} />
            <Stop offset="55%" stopColor="#F8FAFC" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F1F5F9" stopOpacity={1} />
          </LinearGradient>

          {/* Radial Solar Aura Diffusion at top */}
          <LinearGradient id="solarAuraGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop offset="0%" stopColor={sunGlowColor} stopOpacity={sunGlowOpacity} />
            <Stop offset="60%" stopColor={sunGlowColor} stopOpacity={sunGlowOpacity * 0.3} />
            <Stop offset="100%" stopColor="#F8FAFC" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Base Daylight Canvas */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#daylightGrad)" />

        {/* Ambient Solar Corona Dome */}
        <Circle
          cx={SCREEN_WIDTH / 2}
          cy={80}
          r={SCREEN_WIDTH * 0.72}
          fill="url(#solarAuraGrad)"
        />
      </Svg>

      {/* Foreground Content */}
      <View style={styles.contentWrap}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  contentWrap: {
    flex: 1,
  },
});
