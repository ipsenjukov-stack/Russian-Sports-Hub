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

function EventTextCell({ event, align }: { event: MatchEvent; align: "left" | "right" }) {
  const colors = useColors();
  const isRight = align === "right";

  if (event.type === "sub") {
    return (
      <View style={[styles.textCell, isRight ? styles.textRight : styles.textLeft]}>
        <Text
          style={[styles.playerName, { color: "#22c55e" }]}
          numberOfLines={1}
        >
          {shortenName(event.player)}
        </Text>
        {event.outPlayer ? (
          <Text
            style={[styles.assistName, { color: "#ef4444" }]}
            numberOfLines={1}
          >
            {shortenName(event.outPlayer)}
          </Text>
        ) : null}
      </View>
    );
  }

  const secondLine = event.type === "goal" && event.subtype === "own"
    ? "автогол"
    : event.type === "goal" && event.assist
    ? `↳ ${shortenName(event.assist)}`
    : null;

  return (
    <View style={[styles.textCell, isRight ? styles.textRight : styles.textLeft]}>
      <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
        {shortenName(event.player)}
      </Text>
      {secondLine ? (
        <Text style={[styles.assistName, { color: colors.mutedForeground }]} numberOfLines={1}>
          {secondLine}
        </Text>
      ) : null}
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
      {rows.map((row, idx) => (
        <View key={idx} style={[styles.row, { borderBottomColor: colors.border }]}>
          {/* Home side — text right-aligned */}
          <View style={styles.side}>
            {row.home.map((ev, i) => (
              <EventTextCell key={i} event={ev} align="right" />
            ))}
            {row.home.length === 0 && <View style={styles.textCell} />}
          </View>

          {/* Center: home icons | minute | away icons */}
          <View style={styles.centerCol}>
            <View style={styles.centerInner}>
              <View style={styles.iconSlot}>
                {row.home.map((ev, i) => (
                  <EventIcon key={i} type={ev.type} subtype={ev.subtype} />
                ))}
              </View>
              <Text style={[styles.minuteText, { color: colors.mutedForeground }]}>
                {minuteLabel(row.minute, row.extra)}
              </Text>
              <View style={styles.iconSlot}>
                {row.away.map((ev, i) => (
                  <EventIcon key={i} type={ev.type} subtype={ev.subtype} />
                ))}
              </View>
            </View>
          </View>

          {/* Away side — text left-aligned */}
          <View style={styles.side}>
            {row.away.map((ev, i) => (
              <EventTextCell key={i} event={ev} align="left" />
            ))}
            {row.away.length === 0 && <View style={styles.textCell} />}
          </View>
        </View>
      ))}
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
  centerCol: {
    width: 72,
    alignItems: "center",
    paddingTop: 2,
  },
  centerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconSlot: {
    width: 20,
    alignItems: "center",
  },
  minuteText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  textCell: {
    paddingHorizontal: 4,
    minHeight: 20,
  },
  textLeft: { alignItems: "flex-start" },
  textRight: { alignItems: "flex-end" },
  icon: { fontSize: 13, lineHeight: 18 },
  playerName: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  assistName: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },
});
