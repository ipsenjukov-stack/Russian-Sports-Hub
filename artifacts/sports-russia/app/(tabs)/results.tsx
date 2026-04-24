import React from "react";
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
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Match } from "@/types/sports";

function roundSortKey(name: string): number {
  const m = name.match(/(\d+)\s*тур/);
  return m ? parseInt(m[1], 10) : 0;
}

function groupByRound(matches: Match[]): { round: string; matches: Match[] }[] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.roundName ?? m.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries())
    .map(([round, items]) => ({
      round,
      matches: items.sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
    }))
    .sort((a, b) => roundSortKey(b.round) - roundSortKey(a.round) || b.round.localeCompare(a.round));
}

function RoundHeader({ title, count, colors }: { title: string; count: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.roundHeader, { borderBottomColor: colors.border }]}>
      <Text style={[styles.roundTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.roundCount, { color: colors.mutedForeground }]}>{count} матча</Text>
    </View>
  );
}

export default function ResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  const finished = (allMatches || [])
    .filter((m) => m.status === "finished" && m.sport === "football")
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const groups = groupByRound(finished);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Результаты</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {finished.length > 0 ? `${finished.length} матчей за сезон` : "Завершённые матчи"}
        </Text>
      </View>

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
          {finished.length === 0 ? (
            <EmptyState message="Результатов не найдено" />
          ) : groups.length > 0 ? (
            groups.map(({ round, matches: roundMatches }) => (
              <View key={round}>
                <RoundHeader title={round} count={roundMatches.length} colors={colors} />
                {roundMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </View>
            ))
          ) : (
            finished.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
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
  roundHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roundTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  roundCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
