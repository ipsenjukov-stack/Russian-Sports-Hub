import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { SportType } from "@/types/sports";

type FilterOption = SportType;

const FILTERS: { key: FilterOption; label: string; icon: string }[] = [
  { key: "football", label: "Футбол", icon: "⚽" },
  { key: "hockey", label: "Хоккей", icon: "🏒" },
  { key: "basketball", label: "Баскетбол", icon: "🏀" },
  { key: "volleyball", label: "Волейбол", icon: "🏐" },
];

interface SportFilterBarProps {
  selected: FilterOption;
  onSelect: (filter: FilterOption) => void;
}

const SPORT_COLORS: Record<FilterOption, string> = {
  football: "#2ECC71",
  hockey: "#3498DB",
  basketball: "#F39C12",
  volleyball: "#9B59B6",
};

export function SportFilterBar({ selected, onSelect }: SportFilterBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {FILTERS.map((filter) => {
        const isActive = selected === filter.key;
        const activeColor = SPORT_COLORS[filter.key];
        return (
          <TouchableOpacity
            key={filter.key}
            onPress={() => onSelect(filter.key)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? activeColor : colors.muted,
                borderRadius: 20,
              },
            ]}
          >
            <Text style={styles.icon}>{filter.icon}</Text>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? "#fff" : colors.mutedForeground,
                  fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
                },
              ]}
              numberOfLines={1}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 12,
  },
});
