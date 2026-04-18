import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SectionHeaderProps {
  title: string;
  count?: number;
  live?: boolean;
}

export function SectionHeader({ title, count, live }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      {live && <View style={[styles.liveDot, { backgroundColor: colors.live }]} />}
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {count !== undefined && (
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  count: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
