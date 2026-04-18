import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { MatchCard } from "@/components/MatchCard";
import { SportFilterBar } from "@/components/SportFilterBar";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { SportType } from "@/types/sports";
import { getFinishedMatches } from "@/data/mockData";

type FilterOption = "all" | SportType;

export default function ResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sport, setSport] = useState<FilterOption>("all");

  const sportType = sport === "all" ? undefined : sport;
  const finished = getFinishedMatches(sportType);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Результаты</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Завершённые матчи</Text>
      </View>

      <SportFilterBar selected={sport} onSelect={setSport} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {finished.length > 0 ? (
          <>
            <SectionHeader title="Результаты" count={finished.length} />
            {finished.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </>
        ) : (
          <EmptyState message="Завершённых матчей не найдено" />
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
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  scroll: { flex: 1 },
});
