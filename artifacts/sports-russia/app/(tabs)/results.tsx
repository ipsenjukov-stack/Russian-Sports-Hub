import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAllMatches } from "@/hooks/useSportsData";
import { MatchCard } from "@/components/MatchCard";
import { SportFilterBar } from "@/components/SportFilterBar";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { SportType } from "@/types/sports";

type FilterOption = "all" | SportType;

export default function ResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sport, setSport] = useState<FilterOption>("all");
  const queryClient = useQueryClient();
  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  const sportType = sport === "all" ? undefined : sport;
  const finished = (allMatches || []).filter(
    (m) => m.status === "finished" && (!sportType || m.sport === sportType)
  );

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Результаты</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Завершённые матчи</Text>
      </View>

      <SportFilterBar selected={sport} onSelect={setSport} />

      {isLoading ? (
        <LoadingState count={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["allMatches"] })}
              tintColor={colors.primary}
            />
          }
        >
          {finished.length > 0 ? (
            <>
              <SectionHeader title="Результаты" count={finished.length} />
              {finished.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </>
          ) : (
            <EmptyState message="Результатов не найдено" />
          )}
        </ScrollView>
      )}
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
