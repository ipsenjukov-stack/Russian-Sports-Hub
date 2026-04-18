import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { MatchCard } from "@/components/MatchCard";
import { SportFilterBar } from "@/components/SportFilterBar";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { SportType } from "@/types/sports";
import { getUpcomingMatches } from "@/data/mockData";

type FilterOption = "all" | SportType;

const DATE_FILTERS = [
  { key: "today", label: "Сегодня" },
  { key: "tomorrow", label: "Завтра" },
  { key: "week", label: "На неделю" },
];

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sport, setSport] = useState<FilterOption>("all");
  const [dateFilter, setDateFilter] = useState("today");

  const sportType = sport === "all" ? undefined : sport;
  const upcoming = getUpcomingMatches(sportType);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Расписание</Text>
        <View style={styles.dateFilters}>
          {DATE_FILTERS.map((df) => {
            const isActive = dateFilter === df.key;
            return (
              <TouchableOpacity
                key={df.key}
                onPress={() => setDateFilter(df.key)}
                style={[
                  styles.datePill,
                  {
                    backgroundColor: isActive ? colors.primary : colors.muted,
                    borderRadius: 20,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.datePillText,
                    {
                      color: isActive ? "#fff" : colors.mutedForeground,
                      fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {df.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <SportFilterBar selected={sport} onSelect={setSport} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {upcoming.length > 0 ? (
          <>
            <SectionHeader title="Предстоящие матчи" count={upcoming.length} />
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </>
        ) : (
          <EmptyState message="Предстоящих матчей не найдено" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  dateFilters: {
    flexDirection: "row",
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  datePillText: {
    fontSize: 13,
  },
  scroll: { flex: 1 },
});
