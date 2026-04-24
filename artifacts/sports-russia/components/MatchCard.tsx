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
import { splitTeamName, abbreviateLongName } from "@/utils/teamUtils";

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
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{match.startTime} · {match.date}</Text>
          )}
        </View>

        <View style={styles.matchRow}>
          <View style={styles.teamBlock}>
            <View style={styles.teamNameRow}>
              <StarButton teamName={match.homeTeam.name} sport={match.sport} />
              <View>
                <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>
                  {abbreviateLongName(home.name)}
                </Text>
                {match.sport === "football" && home.city ? (
                  <Text style={[styles.teamCity, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {home.city}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.scoreBlock}>
            <View style={styles.scoreRow}>
              <TeamLogo uri={match.homeTeam.logo || undefined} name={home.name} size={28} />
              <View style={styles.scoreCenter}>
                {isLive || isFinished ? (
                  <>
                    <Text style={[styles.score, { color: colors.foreground }]}>
                      {match.homeScore} : {match.awayScore}
                    </Text>
                    {isLive && match.period && (
                      <Text style={[styles.period, { color: colors.live }]}>{match.period}</Text>
                    )}
                    {isLive && match.minute && !match.period && (
                      <Text style={[styles.period, { color: colors.live }]}>{match.minute}'</Text>
                    )}
                  </>
                ) : (
                  <Text style={[styles.vsText, { color: colors.mutedForeground }]}>vs</Text>
                )}
              </View>
              <TeamLogo uri={match.awayTeam.logo || undefined} name={away.name} size={28} />
            </View>
          </View>

          <View style={[styles.teamBlock, styles.awayBlock]}>
            <View style={styles.teamNameRow}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>
                  {abbreviateLongName(away.name)}
                </Text>
                {match.sport === "football" && away.city ? (
                  <Text style={[styles.teamCity, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {away.city}
                  </Text>
                ) : null}
              </View>
              <StarButton teamName={match.awayTeam.name} sport={match.sport} />
            </View>
          </View>
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
  matchRow: { flexDirection: "row", alignItems: "center" },
  teamBlock: { flex: 1, alignItems: "flex-start", marginRight: 8 },
  awayBlock: { alignItems: "flex-end", marginRight: 0, marginLeft: 8 },
  teamNameRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 5,
  },
  starBtn: { justifyContent: "flex-start", paddingHorizontal: 2, paddingTop: 2 },
  teamName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  teamCity: { fontSize: 9, fontFamily: "Inter_400Regular", marginTop: 1 },
  scoreBlock: { width: 110, alignItems: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreCenter: { alignItems: "center", minWidth: 46 },
  score: { fontSize: 20, fontFamily: "Inter_700Bold" },
  vsText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  period: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  logoFallback: { backgroundColor: "#E8E8E8", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#888", fontFamily: "Inter_700Bold" },
});
