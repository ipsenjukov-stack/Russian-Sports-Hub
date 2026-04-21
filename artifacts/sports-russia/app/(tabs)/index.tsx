import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useAllMatches } from "@/hooks/useSportsData";
import { SportFilterBar } from "@/components/SportFilterBar";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeader } from "@/components/SectionHeader";
import { LiveCounter } from "@/components/LiveCounter";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { SettingsModal } from "@/components/SettingsModal";
import { SportType } from "@/types/sports";
import { useFavorites } from "@/context/FavoritesContext";
import { scheduleMatchReminders } from "@/services/pushNotifications";

type FilterOption = SportType;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterOption>("football");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { favorites } = useFavorites();

  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  useEffect(() => {
    if (!allMatches?.length || !favorites.length) return;
    AsyncStorage.getItem("@sports_russia_notif").then((val) => {
      if (val !== "true") return;
      scheduleMatchReminders(allMatches, favorites).catch(() => {});
    });
  }, [allMatches, favorites]);

  const now = Date.now();
  const SOON_MS = 30 * 60 * 1000;
  const STARTED_RECENTLY_MS = 2 * 60 * 60 * 1000; // 2h — ESPN lag window

  const matches = (allMatches || []).filter((m) => m.sport === filter);
  const liveMatches = matches.filter((m) => m.status === "live");

  // Matches starting within 30 min OR already started (ESPN not updated yet, within 2h)
  const startingSoonMatches = matches.filter((m) => {
    if (m.status !== "upcoming" || !m.startTimestamp) return false;
    const delta = m.startTimestamp - now;
    const startedRecently = delta < 0 && now - m.startTimestamp <= STARTED_RECENTLY_MS;
    const startingCoon = delta >= 0 && delta <= SOON_MS;
    return startingCoon || startedRecently;
  }).sort((a, b) => a.startTimestamp - b.startTimestamp);

  const liveAndSoonMatches = [
    ...liveMatches,
    ...startingSoonMatches,
  ];
  const finishedMatches = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const upcomingMatches = matches.filter((m) => {
    if (m.status !== "upcoming" || !m.startTimestamp) return m.status === "upcoming";
    const delta = m.startTimestamp - now;
    const startedRecently = delta < 0 && now - m.startTimestamp <= STARTED_RECENTLY_MS;
    const startingSoon = delta >= 0 && delta <= SOON_MS;
    return !startingSoon && !startedRecently;
  });

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
          <TouchableOpacity
            onPress={() => setSettingsOpen(true)}
            style={[styles.gearBtn, { backgroundColor: colors.muted }]}
            activeOpacity={0.75}
          >
            <Ionicons name="settings-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
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

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
});
