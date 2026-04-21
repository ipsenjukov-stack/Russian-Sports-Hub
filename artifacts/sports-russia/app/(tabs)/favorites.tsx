import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAllMatches } from "@/hooks/useSportsData";
import { useFavorites } from "@/context/FavoritesContext";
import { MatchCard } from "@/components/MatchCard";
import { SportFilterBar } from "@/components/SportFilterBar";
import { SectionHeader } from "@/components/SectionHeader";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { SportType } from "@/types/sports";

type FilterOption = "all" | SportType;

const SPORT_LABELS: Record<SportType, string> = {
  football: "Футбол",
  hockey: "Хоккей",
  basketball: "Баскетбол",
  volleyball: "Волейбол",
};

const SPORT_ICONS: Record<SportType, string> = {
  football: "⚽",
  hockey: "🏒",
  basketball: "🏀",
  volleyball: "🏐",
};

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [sport, setSport] = useState<FilterOption>("all");

  const { favorites, toggleFavorite } = useFavorites();
  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  const sportType = sport === "all" ? undefined : sport;

  const favoriteMatches = (allMatches || []).filter((m) => {
    if (sportType && m.sport !== sportType) return false;
    return (
      favorites.some((f) => f.name === m.homeTeam.name && f.sport === m.sport) ||
      favorites.some((f) => f.name === m.awayTeam.name && f.sport === m.sport)
    );
  });

  const liveMatches = favoriteMatches.filter((m) => m.status === "live");
  const finishedMatches = favoriteMatches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const upcomingMatches = favoriteMatches.filter((m) => m.status === "upcoming");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const count = favorites.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Избранное</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {count > 0
            ? `${count} ${count === 1 ? "команда" : count < 5 ? "команды" : "команд"}`
            : "Нет избранных команд"}
        </Text>
      </View>

      {favorites.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.teamsBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={styles.teamsBarInner}
        >
          {favorites.map((fav) => (
            <TouchableOpacity
              key={`${fav.sport}::${fav.name}`}
              onPress={() => toggleFavorite(fav.name, fav.sport)}
              style={[styles.teamChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={styles.sportEmoji}>{SPORT_ICONS[fav.sport]}</Text>
              <Text style={[styles.teamChipText, { color: colors.foreground }]} numberOfLines={1}>
                {fav.name}
              </Text>
              <Ionicons name="close" size={12} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {favorites.length > 0 && <SportFilterBar selected={sport} onSelect={setSport} />}

      {isLoading ? (
        <LoadingState count={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : favorites.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingBottom: bottomPadding }]}>
          <Ionicons name="star-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Нет избранных команд</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Нажмите на звёздочку рядом с названием команды в карточке матча, чтобы добавить её в избранное
          </Text>
        </View>
      ) : favoriteMatches.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingBottom: bottomPadding }]}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Матчей не найдено</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            У избранных команд нет матчей в текущем периоде
          </Text>
        </View>
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
              <SectionHeader title="Идут сейчас" count={liveMatches.length} live />
              {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
            </>
          )}
          {finishedMatches.length > 0 && (
            <>
              <SectionHeader title="Результаты" count={finishedMatches.length} />
              {finishedMatches.map((m) => <MatchCard key={m.id} match={m} />)}
            </>
          )}
          {upcomingMatches.length > 0 && (
            <>
              <SectionHeader title="Предстоящие" count={upcomingMatches.length} />
              {upcomingMatches.map((m) => <MatchCard key={m.id} match={m} />)}
            </>
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
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  teamsBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxHeight: 52,
  },
  teamsBarInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  teamChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 180,
  },
  sportEmoji: { fontSize: 12 },
  teamChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  scroll: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
