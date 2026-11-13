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
              <View style={styles.iconWrap}>
                <Icon
                  size={19}
                  color={isActive ? "#F59E0B" : "#64748B"}
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
    backgroundColor: "#FFFFFF",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: "#0F172A",
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 5,
    marginRight: 2,
    letterSpacing: -0.2,
  },
});
