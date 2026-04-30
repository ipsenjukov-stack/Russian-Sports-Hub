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
import { useSeasonMatches } from "@/hooks/useSportsData";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { LeagueDropdown } from "@/components/LeagueDropdown";
import { GearButton } from "@/components/GearButton";
import { useLeague } from "@/context/LeagueContext";
import { Match } from "@/types/sports";
import { matchesLeagueFilter, LIGA_A_KEY } from "@/utils/leagueUtils";

function roundSortKey(name: string): number {
  // "Тур N" (translated from "Group X - N")
  const turMatch = name.match(/^(?:.*—\s*)?Тур\s+(\d+)/i);
  if (turMatch) return parseInt(turMatch[1], 10);
  // "N тур" (RPL/Лига PARI style)
  const nTurMatch = name.match(/(\d+)\s*тур/i);
  if (nTurMatch) return parseInt(nTurMatch[1], 10);
  return 0;
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
  const { selectedLeagues, setSelectedLeagues } = useLeague();
  const { data: allMatches, isLoading, isError, refetch } = useSeasonMatches();

  const isLigaA = selectedLeagues[0] === LIGA_A_KEY;

  const finished = (allMatches || [])
    .filter((m) => m.status === "finished" && m.sport === "football")
    .filter((m) => matchesLeagueFilter(m.league, selectedLeagues))
    .sort((a, b) => isLigaA
      ? b.startTimestamp - a.startTimestamp
      : b.sortKey.localeCompare(a.sortKey));

  const groups = isLigaA ? [] : groupByRound(finished);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Результаты</Text>
          <GearButton />
        </View>
        <LeagueDropdown selected={selectedLeagues} onSelect={setSelectedLeagues} />
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
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["seasonMatches"] })}
              tintColor={colors.primary}
            />
          }
        >
          {finished.length === 0 ? (
            <EmptyState message="Результатов не найдено" />
          ) : isLigaA ? (
            finished.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
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
