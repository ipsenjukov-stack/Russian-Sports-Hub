import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  Animated,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
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

function OtherLiveBadge({ count, onPress }: { count: number; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.liveBadge, { backgroundColor: "#e03131", opacity: pulse }]}>
        <Text style={styles.liveBadgeText}>● LIVE{count > 1 ? ` ${count}` : ""}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedLeagues, setSelectedLeagues } = useLeague();
  const queryClient = useQueryClient();
  const { favorites } = useFavorites();
  const [liveModalVisible, setLiveModalVisible] = useState(false);

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

  // All live football matches across all leagues
  const allLiveMatches = footballMatches.filter((m) => m.status === "live");

  // Live matches in leagues the user is NOT currently viewing
  const otherLiveMatches = selectedLeagues.length > 0
    ? footballMatches.filter(
        (m) => m.status === "live" && !matchesLeagueFilter(m.league, selectedLeagues)
      )
    : [];

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
        <View style={styles.dropdownRow}>
          <LeagueDropdown selected={selectedLeagues} onSelect={setSelectedLeagues} />
          {otherLiveMatches.length > 0 && (
            <OtherLiveBadge count={otherLiveMatches.length} onPress={() => setLiveModalVisible(true)} />
          )}
        </View>
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

      <Modal
        visible={liveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLiveModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLiveModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={styles.modalTitle}>● Live-матчи</Text>
            <TouchableOpacity onPress={() => setLiveModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.modalClose, { color: colors.mutedForeground }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {allLiveMatches.length > 0
              ? allLiveMatches.map((match) => <MatchCard key={match.id} match={match} />)
              : <Text style={[styles.modalEmpty, { color: colors.mutedForeground }]}>Нет идущих матчей</Text>
            }
          </ScrollView>
        </View>
      </Modal>
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
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
  },
  liveBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  scroll: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#e03131",
  },
  modalClose: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
  },
  modalEmpty: {
    textAlign: "center",
    paddingVertical: 32,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
