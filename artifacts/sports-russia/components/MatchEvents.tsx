import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

export interface MatchEvent {
  id: number;
  side: "home" | "away";
  minute: number;
  extra: number;
  type: "goal" | "yellow" | "red" | "sub" | "other";
  subtype?: "goal" | "penalty" | "own";
  player: string | null;
  assist: string | null;
  outPlayer: string | null;
}

function minuteLabel(min: number, extra: number): string {
  return extra > 0 ? `${min}+${extra}'` : `${min}'`;
}

function shortenName(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).map((p) => p[0] + ".").join("") + " " + parts[parts.length - 1];
}

function EventIcon({ type, subtype }: { type: MatchEvent["type"]; subtype?: string }) {
  if (type === "goal") {
    if (subtype === "penalty") return <Text style={styles.icon}>⚽П</Text>;
    return <Text style={styles.icon}>⚽</Text>;
  }
  if (type === "yellow") return <Text style={styles.icon}>🟨</Text>;
  if (type === "red")    return <Text style={styles.icon}>🟥</Text>;
  if (type === "sub")    return <Text style={[styles.icon, { fontSize: 11 }]}>🔄</Text>;
  return null;
}

function EventCell({ event, align }: { event: MatchEvent; align: "left" | "right" }) {
  const colors = useColors();
  const isLeft = align === "left";

  const playerLine = event.type === "sub"
    ? `${shortenName(event.player)} ↑`
    : shortenName(event.player);
  const secondLine = event.type === "sub" && event.outPlayer
    ? `${shortenName(event.outPlayer)} ↓`
    : event.type === "goal" && event.subtype === "own"
    ? "автогол"
    : event.type === "goal" && event.assist
    ? `↳ ${shortenName(event.assist)}`
    : null;

  return (
    <View style={[styles.cell, isLeft ? styles.cellLeft : styles.cellRight]}>
      {isLeft && <EventIcon type={event.type} subtype={event.subtype} />}
      <View style={[styles.cellText, isLeft ? { alignItems: "flex-start" } : { alignItems: "flex-end" }]}>
        <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
          {playerLine}
        </Text>
        {secondLine && (
          <Text style={[styles.assistName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {secondLine}
          </Text>
        )}
      </View>
      {!isLeft && <EventIcon type={event.type} subtype={event.subtype} />}
    </View>
  );
}

interface MatchEventsProps {
  flashId: string;
  homeTeamName: string;
  awayTeamName: string;
}

export function MatchEvents({ flashId, homeTeamName, awayTeamName }: MatchEventsProps) {
  const colors = useColors();
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const base = getApiBase();
    fetch(`${base}/api/sports/match-events?flashId=${flashId}`)
      .then((r) => r.json())
      .then((j: { events?: MatchEvent[] }) => {
        if (cancelled) return;
        setEvents(j.events ?? []);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [flashId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !events) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Не удалось загрузить события</Text>
      </View>
    );
  }

  const meaningful = events.filter((e) => e.type !== "other");

  if (meaningful.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>События не найдены</Text>
      </View>
    );
  }

  // Group events by minute+extra for same-minute rendering
  const rows: { minute: number; extra: number; home: MatchEvent[]; away: MatchEvent[] }[] = [];
  for (const ev of meaningful) {
    const row = rows.find((r) => r.minute === ev.minute && r.extra === ev.extra);
    if (row) {
      (ev.side === "home" ? row.home : row.away).push(ev);
    } else {
      const newRow = { minute: ev.minute, extra: ev.extra, home: [] as MatchEvent[], away: [] as MatchEvent[] };
      (ev.side === "home" ? newRow.home : newRow.away).push(ev);
      rows.push(newRow);
    }
  }
  rows.sort((a, b) => a.minute - b.minute || a.extra - b.extra);

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      {rows.map((row, idx) => {
        const maxRows = Math.max(row.home.length, row.away.length);
        return (
          <View key={idx} style={[styles.row, { borderBottomColor: colors.border }]}>
            {/* Home side */}
            <View style={styles.side}>
              {row.home.map((ev, i) => <EventCell key={i} event={ev} align="left" />)}
              {row.home.length === 0 && <View style={styles.cell} />}
            </View>

            {/* Minute */}
            <View style={styles.minuteCol}>
              <Text style={[styles.minuteText, { color: colors.mutedForeground }]}>
                {minuteLabel(row.minute, row.extra)}
              </Text>
            </View>

            {/* Away side */}
            <View style={styles.side}>
              {row.away.map((ev, i) => <EventCell key={i} event={ev} align="right" />)}
              {row.away.length === 0 && <View style={styles.cell} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 6,
  },
  center: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { flex: 1 },
  minuteCol: {
    width: 52,
    alignItems: "center",
    paddingTop: 2,
  },
  minuteText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingHorizontal: 4,
    minHeight: 20,
  },
  cellLeft: { justifyContent: "flex-start" },
  cellRight: { justifyContent: "flex-end" },
  cellText: { flex: 1 },
  icon: { fontSize: 13, lineHeight: 18 },
  playerName: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  assistName: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },
});
