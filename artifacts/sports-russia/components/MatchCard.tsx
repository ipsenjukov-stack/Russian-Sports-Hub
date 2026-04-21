import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useFavorites } from "@/context/FavoritesContext";
import { Match, SportType } from "@/types/sports";
import { splitTeamName } from "@/utils/teamUtils";

const SPORT_COLORS: Record<SportType, string> = {
  football: "#2ECC71",
  hockey: "#3498DB",
  basketball: "#F39C12",
  volleyball: "#9B59B6",
};

interface MatchCardProps {
  match: Match;
  onPress?: () => void;
}

function TeamLogo({ uri, name, size = 32 }: { uri?: string; name: string; size?: number }) {
  const [error, setError] = React.useState(false);

  if (uri && !error) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="contain"
        onError={() => setError(true)}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <View style={[styles.logoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.logoFallbackText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

function LeagueLogo({ uri, size = 28 }: { uri?: string; size?: number }) {
  const [error, setError] = React.useState(false);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {uri && !error ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" onError={() => setError(true)} />
      ) : (
        <Text style={{ fontSize: size * 0.6, lineHeight: size + 2 }}>🏆</Text>
      )}
    </View>
  );
}

function StarButton({ teamName, sport }: { teamName: string; sport: SportType }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const starred = isFavorite(teamName, sport);
  return (
    <TouchableOpacity
      onPress={() => toggleFavorite(teamName, sport)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
      style={styles.starBtn}
    >
      <Ionicons
        name={starred ? "star" : "star-outline"}
        size={15}
        color={starred ? "#F5A623" : "#AAAAAA"}
      />
    </TouchableOpacity>
  );
}

function minutesUntilStart(ts: number): number {
  return Math.ceil((ts - Date.now()) / 60000);
}

export function MatchCard({ match, onPress }: MatchCardProps) {
  const colors = useColors();
  const sportColor = SPORT_COLORS[match.sport];

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "upcoming";

  const minsUntil = isUpcoming ? minutesUntilStart(match.startTimestamp) : null;
  const startedRecentlyMins = minsUntil !== null && minsUntil < 0 && minsUntil >= -120;
  const isStartingSoon = isUpcoming && minsUntil !== null && minsUntil >= 0 && minsUntil <= 30;
  const isJustStarted = isUpcoming && startedRecentlyMins;

  const home = splitTeamName(match.homeTeam.name);
  const away = splitTeamName(match.awayTeam.name);

  const showScore = isLive || isFinished;
  const homeScoreNum = match.homeScore ?? 0;
  const awayScoreNum = match.awayScore ?? 0;
  const homeWins = isFinished && homeScoreNum > awayScoreNum;
  const awayWins = isFinished && awayScoreNum > homeScoreNum;
  const homeDim = isFinished && !homeWins && homeScoreNum !== awayScoreNum;
  const awayDim = isFinished && !awayWins && homeScoreNum !== awayScoreNum;
  const periodFooter = isLive
    ? (match.period || (match.minute ? `${match.minute}'` : null))
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
    >
      <View style={[styles.sportBar, { backgroundColor: sportColor }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.leagueRow}>
            <LeagueLogo uri={match.leagueLogo} />
            <Text style={[styles.league, { color: colors.mutedForeground }]} numberOfLines={1}>
              {match.league}
            </Text>
          </View>
          {isLive && (
            <View style={[styles.liveBadge, { backgroundColor: colors.live }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {isStartingSoon && (
            <View style={[styles.soonBadge, { backgroundColor: "#F39C12" }]}>
              <View style={[styles.liveDot, { backgroundColor: "#fff" }]} />
              <Text style={styles.liveText}>
                {minsUntil! <= 1 ? "сейчас" : `через ${minsUntil} мин`}
              </Text>
            </View>
          )}
          {isJustStarted && (
            <View style={[styles.soonBadge, { backgroundColor: colors.live }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>идёт</Text>
            </View>
          )}
          {isFinished && (
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Завершён · {match.date}</Text>
          )}
          {isUpcoming && !isStartingSoon && !isJustStarted && (
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{match.date}</Text>
          )}
        </View>

        <View style={styles.matchBody}>
          {/* Home team row */}
          <View style={styles.teamRow}>
            <StarButton teamName={match.homeTeam.name} sport={match.sport} />
            <TeamLogo uri={match.homeTeam.logo || undefined} name={home.name} size={28} />
            <Text style={[styles.teamNameNew, { color: colors.foreground }]} numberOfLines={1}>
              {match.homeTeam.name}
            </Text>
            <Text style={[
              styles.scoreNum,
              { color: homeDim ? colors.mutedForeground : colors.foreground,
                fontFamily: homeWins ? "Inter_700Bold" : "Inter_500Medium",
                opacity: showScore ? 1 : 0 },
            ]}>
              {showScore ? String(match.homeScore ?? 0) : "0"}
            </Text>
          </View>

          {/* Away team row */}
          <View style={styles.teamRow}>
            <StarButton teamName={match.awayTeam.name} sport={match.sport} />
            <TeamLogo uri={match.awayTeam.logo || undefined} name={away.name} size={28} />
            <Text style={[styles.teamNameNew, { color: colors.foreground }]} numberOfLines={1}>
              {match.awayTeam.name}
            </Text>
            <Text style={[
              styles.scoreNum,
              { color: awayDim ? colors.mutedForeground : colors.foreground,
                fontFamily: awayWins ? "Inter_700Bold" : "Inter_500Medium",
                opacity: showScore ? 1 : 0 },
            ]}>
              {showScore ? String(match.awayScore ?? 0) : "0"}
            </Text>
          </View>

          {/* Live period / upcoming time footer */}
          {periodFooter && (
            <Text style={[styles.periodFooterText, { color: colors.live }]}>{periodFooter}</Text>
          )}
          {isUpcoming && !isStartingSoon && !isJustStarted && match.startTime && (
            <Text style={[styles.periodFooterText, { color: colors.mutedForeground }]}>
              {match.startTime}
            </Text>
          )}
        </View>

      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sportBar: { width: 4 },
  content: { flex: 1, padding: 12, gap: 8 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leagueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  league: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  soonBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  statusText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  starBtn: { padding: 1 },
  matchBody: { gap: 7 },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamNameNew: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  scoreNum: {
    fontSize: 18,
    minWidth: 22,
    textAlign: "right",
  },
  periodFooterText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 2,
  },
  logoFallback: { backgroundColor: "#E8E8E8", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#888", fontFamily: "Inter_700Bold" },
});
