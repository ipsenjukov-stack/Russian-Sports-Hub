import React, { useEffect, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useAllMatches } from "@/hooks/useSportsData";
import { LeagueDropdown } from "@/components/LeagueDropdown";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeader } from "@/components/SectionHeader";
import { LiveCounter } from "@/components/LiveCounter";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { GearButton } from "@/components/GearButton";
import { useFavorites } from "@/context/FavoritesContext";
import { useLeague } from "@/context/LeagueContext";
import { matchesLeagueFilter } from "@/utils/leagueUtils";
import { scheduleMatchReminders, registerWithBackend, DEFAULT_NOTIF_PREFS, NotifPrefs } from "@/services/pushNotifications";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedLeagues, setSelectedLeagues } = useLeague();
  const queryClient = useQueryClient();
  const { favorites } = useFavorites();

  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  useEffect(() => {
    AsyncStorage.multiGet(["@sports_russia_notif", "@sports_russia_push_token", "@sports_russia_notif_prefs"])
      .then(([notifPair, tokenPair, prefsPair]) => {
        const notifEnabled = notifPair[1] === "true";
        const token = tokenPair[1];
        if (!notifEnabled || !token) return;
        try {
          const prefs: NotifPrefs = prefsPair[1]
            ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(prefsPair[1]) }
            : DEFAULT_NOTIF_PREFS;
          registerWithBackend(token, favorites, prefs).catch(() => {});
        } catch {}
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!allMatches?.length || !favorites.length) return;
    AsyncStorage.getItem("@sports_russia_notif").then((val) => {
      if (val !== "true") return;
      scheduleMatchReminders(allMatches, favorites).catch(() => {});
    });
  }, [allMatches, favorites]);

  const now = Date.now();
  const SOON_MS = 30 * 60 * 1000;
  const STARTED_RECENTLY_MS = 2 * 60 * 60 * 1000;

  // Only football matches, filtered by selected leagues (empty = all)
  const footballMatches = (allMatches || []).filter((m) => m.sport === "football");
  const matches = footballMatches.filter((m) => matchesLeagueFilter(m.league, selectedLeagues));

  const liveMatches = matches.filter((m) => m.status === "live");

  const startingSoonMatches = matches.filter((m) => {
    if (m.status !== "upcoming" || !m.startTimestamp) return false;
    const delta = m.startTimestamp - now;
    const startedRecently = delta < 0 && now - m.startTimestamp <= STARTED_RECENTLY_MS;
    const startingSoon = delta >= 0 && delta <= SOON_MS;
    return startingSoon || startedRecently;
  }).sort((a, b) => a.startTimestamp - b.startTimestamp);

  const liveAndSoonMatches = [...liveMatches, ...startingSoonMatches];
  const finishedMatches = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Матчи</Text>
          <GearButton />
        </View>
        <LeagueDropdown selected={selectedLeagues} onSelect={setSelectedLeagues} />
      </View>

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
          {liveAndSoonMatches.length > 0 && (
            <>
              <LiveCounter count={liveAndSoonMatches.length} />
              <SectionHeader title="Идут сейчас" count={liveAndSoonMatches.length} live />
              {liveAndSoonMatches.map((match) => (
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

          {!isLoading && liveAndSoonMatches.length === 0 && finishedMatches.length === 0 && (
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
    paddingBottom: 4,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  scroll: { flex: 1 },
});
