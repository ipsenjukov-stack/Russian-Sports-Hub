import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/context/SettingsContext";

export function GearButton() {
  const colors = useColors();
  const { openSettings } = useSettings();
  return (
    <TouchableOpacity
      onPress={openSettings}
      style={[styles.btn, { backgroundColor: colors.muted }]}
      activeOpacity={0.75}
    >
      <Ionicons name="settings-outline" size={22} color={colors.foreground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
