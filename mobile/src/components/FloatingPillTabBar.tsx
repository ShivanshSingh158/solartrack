import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TabId = "cockpit" | "history" | "diagnostics" | "savings" | "settings";

export interface TabItemDef {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

interface FloatingPillTabBarProps {
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  tabs: TabItemDef[];
}

export const FloatingPillTabBar: React.FC<FloatingPillTabBarProps> = ({
  activeTab,
  onSelect,
  tabs,
}) => {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.outerWrapper, { bottom: bottomOffset }]}>
      <View style={styles.dockCapsule}>
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => onSelect(id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Icon
                  size={20}
                  color={isActive ? "#0d140f" : "rgba(255, 255, 255, 0.45)"}
                />
              </View>
              {isActive ? (
                <Text style={styles.activeLabel} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  dockCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 22, 18, 0.92)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: "#fef08a",
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {},
  activeLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0d140f",
    marginLeft: 4,
    marginRight: 2,
    letterSpacing: -0.2,
  },
});
