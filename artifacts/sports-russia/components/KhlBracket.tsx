import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { KhlPlayoffRound, KhlPlayoffSeries } from "@/hooks/useSportsData";

// ── Layout constants ─────────────────────────────────────────────────────────
const CARD_W   = 148;
const CARD_H   = 66;
const ARM_W    = 18;      // horizontal arm width (connector column half-width)
const LINE_PX  = 1.5;
const BASE_SLOT = 78;     // vertical slot per series in round 0

// derived: connector column total width
const CONN_W = ARM_W * 2 + LINE_PX;

function slotH(ri: number): number {
  return BASE_SLOT * Math.pow(2, ri);
}
function cardTopY(ri: number, si: number): number {
  const sh = slotH(ri);
  return si * sh + (sh - CARD_H) / 2;
}
function cardMidY(ri: number, si: number): number {
  return cardTopY(ri, si) + CARD_H / 2;
}
function totalH(r0Count: number): number {
  return Math.max(r0Count * BASE_SLOT, CARD_H + 20);
}

// ── SmallBadge ───────────────────────────────────────────────────────────────
function SmallBadge({ uri, name, size = 18 }: { uri: string; name: string; size?: number }) {
  const colors = useColors();
  const [err, setErr] = useState(false);
  if (!uri || err) {
    const initials = name.split(" ").filter(Boolean).slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? "").join("");
    return (
      <View style={[bs.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }]}>
        <Text style={{ fontSize: size * 0.42, fontFamily: "Inter_700Bold", color: colors.foreground }}>
          {initials}
        </Text>
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

// ── SeriesCard ────────────────────────────────────────────────────────────────
function SeriesCard({ series, winsNeeded }: { series: KhlPlayoffSeries; winsNeeded: number }) {
  const colors = useColors();
  const homeWon   = series.homeWins >= winsNeeded;
  const awayWon   = series.awayWins >= winsNeeded;
  const homeLeads = series.homeWins > series.awayWins;
  const awayLeads = series.awayWins > series.homeWins;

  const homeColor = homeWon ? colors.primary
    : homeLeads && !series.isDone ? colors.foreground
    : colors.mutedForeground;
  const awayColor = awayWon ? colors.primary
    : awayLeads && !series.isDone ? colors.foreground
    : colors.mutedForeground;

  return (
    <View style={[bs.card, {
      backgroundColor: colors.card,
      borderColor: series.isDone ? colors.border : colors.primary + "40",
      borderWidth: series.isDone ? StyleSheet.hairlineWidth : 1,
    }]}>
      <View style={bs.teamRow}>
        <SmallBadge uri={series.homeBadge ?? ""} name={series.homeTeam} />
        <Text numberOfLines={1} style={[bs.teamName, {
          color: homeColor,
          fontFamily: homeLeads || homeWon ? "Inter_600SemiBold" : "Inter_400Regular",
        }]}>
          {series.homeTeam}
        </Text>
        <Text style={[bs.wins, {
          color: homeColor,
          fontFamily: homeWon ? "Inter_700Bold" : "Inter_500Medium",
        }]}>
          {series.homeWins}
        </Text>
      </View>

      <View style={[bs.divider, { backgroundColor: colors.border }]} />

      <View style={bs.teamRow}>
        <SmallBadge uri={series.awayBadge ?? ""} name={series.awayTeam} />
        <Text numberOfLines={1} style={[bs.teamName, {
          color: awayColor,
          fontFamily: awayLeads || awayWon ? "Inter_600SemiBold" : "Inter_400Regular",
        }]}>
          {series.awayTeam}
        </Text>
        <Text style={[bs.wins, {
          color: awayColor,
          fontFamily: awayWon ? "Inter_700Bold" : "Inter_500Medium",
        }]}>
          {series.awayWins}
        </Text>
      </View>
    </View>
  );
}

// ── Connector column ──────────────────────────────────────────────────────────
// Draws the bracket lines between round `ri` and round `ri+1`.
// This View is a flex sibling of the card columns with explicit height = totalH.
function ConnectorCol({
  roundIdx, leftCount, lineColor, canvasH,
}: {
  roundIdx: number;
  leftCount: number;
  lineColor: string;
  canvasH: number;
}) {
  const lines: React.ReactNode[] = [];

  for (let si = 0; si < leftCount; si += 2) {
    const top     = cardMidY(roundIdx, si);
    const bot     = cardMidY(roundIdx, si + 1);
    const midY    = (top + bot) / 2;
    const nextIdx = Math.floor(si / 2);
    const outY    = cardMidY(roundIdx + 1, nextIdx);

    // top arm (left → fork)
    lines.push(
      <View key={`ta${si}`} style={{
        position: "absolute", left: 0, top: top - LINE_PX / 2,
        width: ARM_W, height: LINE_PX, backgroundColor: lineColor,
      }} />,
    );
    // bottom arm
    lines.push(
      <View key={`ba${si}`} style={{
        position: "absolute", left: 0, top: bot - LINE_PX / 2,
        width: ARM_W, height: LINE_PX, backgroundColor: lineColor,
      }} />,
    );
    // vertical join
    lines.push(
      <View key={`vj${si}`} style={{
        position: "absolute",
        left: ARM_W - LINE_PX / 2,
        top: Math.min(top, bot),
        width: LINE_PX,
        height: Math.abs(bot - top) + LINE_PX,
        backgroundColor: lineColor,
      }} />,
    );
    // output arm
    lines.push(
      <View key={`oa${si}`} style={{
        position: "absolute",
        left: ARM_W,
        top: outY - LINE_PX / 2,
        width: ARM_W + LINE_PX,
        height: LINE_PX,
        backgroundColor: lineColor,
      }} />,
    );
  }

  return (
    <View style={{ width: CONN_W, height: canvasH }}>
      {lines}
    </View>
  );
}

// ── Round label ───────────────────────────────────────────────────────────────
function RoundLabel({ name, colors }: { name: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[bs.roundLabel, { width: CARD_W }]}>
      <Text style={[bs.roundLabelText, { color: colors.mutedForeground }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

// ── ROUND_WINS map ────────────────────────────────────────────────────────────
const ROUND_WINS: Record<string, number> = {
  "1/8 финала":    3,
  "1/4 финала":    3,
  "1/2 финала":    4,
  "Кубок Гагарина": 4,
};

// ── Main export ───────────────────────────────────────────────────────────────
interface KhlBracketProps {
  rounds: KhlPlayoffRound[];
  bottomPadding?: number;
}

export function KhlBracket({ rounds, bottomPadding = 0 }: KhlBracketProps) {
  const colors = useColors();

  if (!rounds || rounds.length === 0) {
    return (
      <View style={bs.empty}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🏒</Text>
        <Text style={[bs.emptyTitle, { color: colors.foreground }]}>Сетка плей-офф</Text>
        <Text style={[bs.emptyText, { color: colors.mutedForeground }]}>
          Данные появятся когда начнётся плей-офф
        </Text>
      </View>
    );
  }

  const r0Count = rounds[0]?.series?.length ?? 1;
  const canvasH = totalH(r0Count);
  const lineColor = colors.border;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding + 24 }}
    >
      {/* ── Label row ── */}
      <View style={bs.labelRow}>
        {rounds.map((r, ri) => (
          <React.Fragment key={ri}>
            <RoundLabel name={r.name} colors={colors} />
            {ri < rounds.length - 1 && <View style={{ width: CONN_W }} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Bracket row: card columns interleaved with connector columns ── */}
      <View style={[bs.bracketRow, { height: canvasH }]}>
        {rounds.map((r, ri) => {
          const slot       = slotH(ri);
          const winsNeeded = ROUND_WINS[r.name] ?? 4;
          const firstPad   = (slot - CARD_H) / 2;
          const gap        = slot - CARD_H;

          return (
            <React.Fragment key={ri}>
              {/* Card column */}
              <View style={{ width: CARD_W, paddingTop: firstPad }}>
                {r.series.map((s, si) => (
                  <View
                    key={si}
                    style={{ height: CARD_H, marginTop: si > 0 ? gap : 0 }}
                  >
                    <SeriesCard series={s} winsNeeded={winsNeeded} />
                  </View>
                ))}
              </View>

              {/* Connector column (between this round and the next) */}
              {ri < rounds.length - 1 && (
                <ConnectorCol
                  roundIdx={ri}
                  leftCount={r.series.length}
                  lineColor={lineColor}
                  canvasH={canvasH}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  roundLabel: {
    paddingBottom: 4,
  },
  roundLabelText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textAlign: "center",
    textTransform: "uppercase",
  },
  bracketRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  card: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "space-between",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  teamName: {
    flex: 1,
    fontSize: 11,
  },
  wins: {
    fontSize: 14,
    width: 18,
    textAlign: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
});
