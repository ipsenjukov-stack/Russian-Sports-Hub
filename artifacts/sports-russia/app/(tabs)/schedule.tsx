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
import { LeagueDropdown } from "@/components/LeagueDropdown";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { GearButton } from "@/components/GearButton";

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(["Российская Премьер-лига"]);
  const queryClient = useQueryClient();
  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  const footballMatches = (allMatches || []).filter(
    (m) => m.status === "upcoming" && m.sport === "football"
  );

  const upcoming = selectedLeagues.length === 0
    ? footballMatches
    : footballMatches.filter((m) => selectedLeagues.includes(m.league ?? ""));

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Расписание</Text>
          <GearButton />
        </View>
        <LeagueDropdown selected={selectedLeagues} onSelect={setSelectedLeagues} />
      </View>

      {isLoading ? (
        <LoadingState count={4} />
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  scroll: { flex: 1 },
});
