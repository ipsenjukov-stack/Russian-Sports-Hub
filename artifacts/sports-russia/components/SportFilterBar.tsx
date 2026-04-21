import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 5,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: 13,
  },
});
