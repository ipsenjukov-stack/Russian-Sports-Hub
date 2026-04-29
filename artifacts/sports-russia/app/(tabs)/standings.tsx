import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useStandings, StandingEntry } from "@/hooks/useSportsData";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { GearButton } from "@/components/GearButton";
import { LeagueDropdown } from "@/components/LeagueDropdown";
import { useLeague } from "@/context/LeagueContext";

const LOCAL_TEAM_LOGOS: Record<string, ReturnType<typeof require>> = {
  "ФК Сочи":          require("@/assets/images/team-sochi-nobg.png"),
  "Сочи":             require("@/assets/images/team-sochi-nobg.png"),
  "Спартак Кострома": require("@/assets/images/team-spartak-kostroma.png"),
  "Текстильщик":      require("@/assets/images/team-tekstilshchik-nobg.png"),
  "Севастополь":      require("@/assets/images/team-sevastopol-nobg.png"),
  "Дружба":           require("@/assets/images/team-druzhba-nobg.png"),
  "Луки-Энергия":     require("@/assets/images/team-luki-energiya-nobg.png"),
  "Коломна":          require("@/assets/images/team-kolomna-nobg.png"),
  "Знамя Труда":      require("@/assets/images/team-znamya-truda-nobg.png"),
  "Рязань":           require("@/assets/images/team-ryazan-nobg.png"),
  "Металлург Липецк": require("@/assets/images/team-metallurg-lipetsk-nobg.png"),
  "Строгино Москва":  require("@/assets/images/team-strogino-nobg.png"),
};

function TeamBadge({ uri, teamName, size = 28 }: { uri: string; teamName: string; size?: number }) {
  const colors = useColors();
  const [err, setErr] = useState(false);

  const localLogo = LOCAL_TEAM_LOGOS[teamName];
  if (localLogo) {
    return (
      <Image
        source={localLogo}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  if (!uri || err) {
    const initials = teamName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    return (
      <View style={[styles.badgeFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }]}>
        <Text style={[styles.badgeInitials, { fontSize: size * 0.36, color: colors.foreground }]}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
      onError={() => setErr(true)}
    />
  );
}

function StandingsTable({ entries, colors }: { entries: StandingEntry[]; colors: ReturnType<typeof useColors> }) {
  const cols = ["М", "ЗГ", "ПГ", "РМ", "О"];
  return (
    <View style={styles.table}>
      <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerRank, { color: colors.mutedForeground }]}>#</Text>
        <Text style={[styles.headerTeam, { color: colors.mutedForeground }]}>Команда</Text>
        {cols.map((c) => (
          <Text key={c} style={[styles.headerStat, { color: c === "О" ? colors.primary : colors.mutedForeground }]}>{c}</Text>
        ))}
      </View>
      {entries.map((e, idx) => {
        const isEven = idx % 2 === 0;
        return (
          <View
            key={e.team + idx}
            style={[
              styles.tableRow,
              {
                backgroundColor: isEven ? "transparent" : colors.muted + "50",
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.rankText, { color: e.rank <= 3 ? colors.primary : colors.foreground }]}>
              {e.rank}
            </Text>
            <View style={styles.teamCell}>
              <TeamBadge uri={e.badge} teamName={e.team} size={22} />
              <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={1}>
                {e.team}
              </Text>
            </View>
            <Text style={[styles.statCell, { color: colors.mutedForeground }]}>{e.gp}</Text>
            <Text style={[styles.statCell, { color: colors.mutedForeground }]}>{e.gf}</Text>
            <Text style={[styles.statCell, { color: colors.mutedForeground }]}>{e.ga}</Text>
            <Text style={[styles.statCell, { color: e.gd > 0 ? colors.live : e.gd < 0 ? "#e53e3e" : colors.mutedForeground }]}>
              {e.gd > 0 ? `+${e.gd}` : e.gd}
            </Text>
            <Text style={[styles.statCell, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{e.pts}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StandingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { selectedLeagues, setSelectedLeagues } = useLeague();

  const selectedLeague = selectedLeagues[0] ?? "Российская Премьер-лига";
  const { data, isLoading, isError, refetch } = useStandings("football", selectedLeague);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const hasEntries = !isLoading && !isError && (data?.entries?.length ?? 0) > 0;
  const hasMessage = !isLoading && !isError && !hasEntries && data?.message;
  const noData = !isLoading && !isError && !hasEntries && !hasMessage;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Таблицы</Text>
            {data?.season ? (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {selectedLeague} · {data.season}
              </Text>
            ) : null}
          </View>
          <GearButton />
        </View>
        <LeagueDropdown selected={selectedLeagues} onSelect={setSelectedLeagues} />
      </View>

      {isLoading ? (
        <LoadingState count={10} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : hasEntries ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["standings", selectedLeague] })}
              tintColor={colors.primary}
            />
          }
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableWrapper}>
              {data?.league && (
                <View style={[styles.leagueLabel, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.leagueLabelText, { color: colors.foreground }]}>{data.league}</Text>
                </View>
              )}
              <StandingsTable entries={data?.entries ?? []} colors={colors} />
            </View>
          </ScrollView>

          <View style={[styles.legend, { borderTopColor: colors.border }]}>
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              М — матчи · ЗГ — забито · ПГ — пропущено · РМ — разница · О — очки
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.emptyContainer, { paddingBottom: bottomPadding }]}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {hasMessage ? "Информация" : "Данные недоступны"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {data?.message ?? `Турнирная таблица «${selectedLeague}» пока не доступна`}
          </Text>
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
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  scroll: { flex: 1 },
  tableWrapper: {
    minWidth: "100%",
    paddingHorizontal: 4,
  },
  leagueLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leagueLabelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRank: {
    width: 24,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  headerTeam: {
    width: 190,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    paddingLeft: 4,
  },
  headerStat: {
    width: 32,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankText: {
    width: 24,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  teamCell: {
    width: 190,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
    overflow: "hidden",
  },
  teamName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  statCell: {
    width: 32,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  badgeFallback: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeInitials: {
    fontFamily: "Inter_700Bold",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  legend: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});
