import React, { useEffect, useRef, useState } from "react";
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
import { MatchCard } from "@/components/MatchCard";
import { SportFilterBar } from "@/components/SportFilterBar";
import { EmptyState } from "@/components/EmptyState";
import { SportType } from "@/types/sports";
import { getLiveMatches } from "@/data/mockData";

type FilterOption = "all" | SportType;

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sport, setSport] = useState<FilterOption>("all");
  const pulse = useRef(new Animated.Value(1)).current;

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

  const sportType = sport === "all" ? undefined : sport;
  const liveMatches = getLiveMatches(sportType);

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
          {liveMatches.length > 0
            ? `${liveMatches.length} матч${liveMatches.length === 1 ? "" : "а"} сейчас`
            : "Активных матчей нет"}
        </Text>
      </View>

      <SportFilterBar selected={sport} onSelect={setSport} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {liveMatches.length > 0 ? (
          liveMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))
        ) : (
          <EmptyState message="Сейчас нет активных матчей. Загляните позже!" />
        )}
      </ScrollView>
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
  scroll: { flex: 1 },
});
