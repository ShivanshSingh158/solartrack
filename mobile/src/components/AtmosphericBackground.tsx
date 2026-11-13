import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from "react-native-svg";

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
  // Morning (6-9): Warm amber/mist; Noon (9-16): Golden sun mist; Sunset (16-18): Burnt ochre; Night: Deep pine forest
  const isMorning = timeHour >= 6 && timeHour < 10;
  const isSunset = timeHour >= 16 && timeHour < 19;
  const isNoon = !isNight && !isMorning && !isSunset;

  const skyTop = isNight
    ? "#090d0b"
    : isMorning
    ? "#1e1d16"
    : isSunset
    ? "#241612"
    : "#161d19";

  const skyMid = isNight
    ? "#121a15"
    : isMorning
    ? "#382d1c"
    : isSunset
    ? "#3a2216"
    : "#282a1d";

  const skyGlow = isNight
    ? "#0f1612"
    : isMorning
    ? "#4a3c22"
    : isSunset
    ? "#4d2c18"
    : "#3a341e";

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={skyTop} />
            <Stop offset="35%" stopColor={skyMid} />
            <Stop offset="65%" stopColor={skyGlow} />
            <Stop offset="100%" stopColor="#0b0e0c" />
          </LinearGradient>
          <LinearGradient id="sunGlowGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop offset="0%" stopColor={isNight ? "#1e2922" : "#f59e0b"} stopOpacity={isNight ? 0.08 : 0.25} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="pineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={isNight ? "#060907" : "#0d140f"} stopOpacity={0.65} />
            <Stop offset="100%" stopColor="#050706" stopOpacity={0.98} />
          </LinearGradient>
        </Defs>

        {/* Base Atmospheric Sky Gradient */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#skyGrad)" />

        {/* Ambient Sun/Moon Diffusion Sphere */}
        <Circle
          cx={SCREEN_WIDTH / 2}
          cy={220}
          r={SCREEN_WIDTH * 0.75}
          fill="url(#sunGlowGrad)"
        />

        {/* Distant Misty Pine Forest Silhouettes */}
        <Path
          d={`
            M 0 320
            L 20 305 L 40 318 L 65 298 L 90 315 L 120 290 L 150 312 L 180 285 L 210 308 L 245 280 L 280 310 L 315 288 L 350 315 L 380 295 L ${SCREEN_WIDTH} 320
            L ${SCREEN_WIDTH} ${SCREEN_HEIGHT}
            L 0 ${SCREEN_HEIGHT}
            Z
          `}
          fill="url(#pineGrad)"
          opacity={0.4}
        />

        {/* Foreground Pine Silhouette matching reference */}
        <Path
          d={`
            M 0 350
            L 25 330 L 50 345 L 85 315 L 115 340 L 155 305 L 190 338 L 230 298 L 265 332 L 305 310 L 340 335 L 375 318 L ${SCREEN_WIDTH} 345
            L ${SCREEN_WIDTH} ${SCREEN_HEIGHT}
            L 0 ${SCREEN_HEIGHT}
            Z
          `}
          fill="#070a08"
          opacity={0.7}
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
    backgroundColor: "#090d0b",
  },
  contentWrap: {
    flex: 1,
  },
});
