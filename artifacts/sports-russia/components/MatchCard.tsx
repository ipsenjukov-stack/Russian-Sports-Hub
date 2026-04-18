import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Match, SportType } from "@/types/sports";

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

export function MatchCard({ match, onPress }: MatchCardProps) {
  const colors = useColors();
  const sportColor = SPORT_COLORS[match.sport];

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "upcoming";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
    >
      <View style={[styles.sportBar, { backgroundColor: sportColor }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.league, { color: colors.mutedForeground }]} numberOfLines={1}>
            {match.league}
          </Text>
          {isLive && (
            <View style={[styles.liveBadge, { backgroundColor: colors.live }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {isFinished && (
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Завершён</Text>
          )}
          {isUpcoming && (
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{match.startTime} · {match.date}</Text>
          )}
        </View>

        <View style={styles.matchRow}>
          <View style={styles.teamBlock}>
            <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={1}>
              {match.homeTeam.name}
            </Text>
          </View>

          <View style={styles.scoreBlock}>
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

          <View style={[styles.teamBlock, styles.awayBlock]}>
            <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={1}>
              {match.awayTeam.name}
            </Text>
          </View>
        </View>

        {match.venue && (
          <Text style={[styles.venue, { color: colors.mutedForeground }]} numberOfLines={1}>
            {match.venue}
          </Text>
        )}
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
  sportBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  league: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
    marginRight: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#fff",
  },
  liveText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  teamBlock: {
    flex: 1,
  },
  awayBlock: {
    alignItems: "flex-end",
  },
  teamName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  scoreBlock: {
    width: 80,
    alignItems: "center",
  },
  score: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  vsText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  period: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  venue: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
