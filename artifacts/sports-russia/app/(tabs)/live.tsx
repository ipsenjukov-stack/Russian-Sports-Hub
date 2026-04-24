import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAllMatches } from "@/hooks/useSportsData";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(1)).current;
  const { data: allMatches, isLoading, isError, refetch } = useAllMatches();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const liveMatches = (allMatches || []).filter(
    (m) => m.status === "live" && m.sport === "football"
  );
  const todayMatches = (allMatches || []).filter((m) => {
    if (m.status !== "upcoming" || m.sport !== "football") return false;
    return m.date === "Сегодня";
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.liveDot, { backgroundColor: colors.live, opacity: pulse }]} />
          <Text style={[styles.title, { color: colors.live }]}>ПРЯМОЙ ЭФИР</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {isLoading ? "Загрузка..." :
           liveMatches.length > 0
            ? `${liveMatches.length} матч${liveMatches.length === 1 ? "" : liveMatches.length < 5 ? "а" : "ей"} сейчас`
            : "Нет активных матчей"}
        </Text>
      </View>

      {isLoading ? (
        <LoadingState count={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          {liveMatches.length > 0 && liveMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}

          {todayMatches.length > 0 && (
            <>
              <View style={[styles.todayHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.todayTitle, { color: colors.foreground }]}>Сегодня</Text>
              </View>
              {todayMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </>
          )}

          {liveMatches.length === 0 && todayMatches.length === 0 && (
            <EmptyState message="Сейчас нет активных матчей. Загляните позже!" />
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
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  todayHeader: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    marginTop: 8,
  },
  todayTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  scroll: { flex: 1 },
});
