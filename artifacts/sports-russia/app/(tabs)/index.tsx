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
import { SportFilterBar } from "@/components/SportFilterBar";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeader } from "@/components/SectionHeader";
import { LiveCounter } from "@/components/LiveCounter";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { SportType } from "@/types/sports";

type FilterOption = SportType;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterOption>("football");
  const queryClient = useQueryClient();

  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  const matches = (allMatches || []).filter((m) => m.sport === filter);
  const liveMatches = matches.filter((m) => m.status === "live");
  const finishedMatches = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Матчи</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Лайв и результаты</Text>
          </View>
          <View style={[styles.flagBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.flagText}>🇷🇺</Text>
          </View>
        </View>
      </View>

      <SportFilterBar selected={filter} onSelect={setFilter} />

      {isLoading ? (
        <LoadingState count={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
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
          {liveMatches.length > 0 && (
            <>
              <LiveCounter count={liveMatches.length} />
              <SectionHeader title="Идут сейчас" count={liveMatches.length} live />
              {liveMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </>
          )}

          {finishedMatches.length > 0 && (
            <>
              <SectionHeader title="Результаты" count={finishedMatches.length} />
              {finishedMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </>
          )}

          {upcomingMatches.length > 0 && (
            <>
              <SectionHeader title="Предстоящие" count={upcomingMatches.length} />
              {upcomingMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </>
          )}

          {!isLoading && matches.length === 0 && (
            <EmptyState message="Матчи не найдены" />
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
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  flagBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  flagText: { fontSize: 22 },
  scroll: { flex: 1 },
});
