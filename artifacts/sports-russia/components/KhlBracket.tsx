import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { KhlPlayoffRound, KhlPlayoffSeries } from "@/hooks/useSportsData";

// ── Layout constants ────────────────────────────────────────────────────────
const CARD_W = 148;
const CARD_H = 66;
const ARM_W = 20;       // horizontal arm connecting card to bracket fork
const LINE_PX = 1.5;    // connector line thickness
const BASE_SLOT = 78;   // vertical space per series in round 0

function slotH(roundIdx: number): number {
  return BASE_SLOT * Math.pow(2, roundIdx);
}
function cardTopY(roundIdx: number, seriesIdx: number): number {
  const sh = slotH(roundIdx);
  return seriesIdx * sh + (sh - CARD_H) / 2;
}
function cardMidY(roundIdx: number, seriesIdx: number): number {
  return cardTopY(roundIdx, seriesIdx) + CARD_H / 2;
}
function colX(roundIdx: number): number {
  return roundIdx * (CARD_W + ARM_W * 2 + LINE_PX);
}
function totalWidth(numRounds: number): number {
  if (numRounds <= 0) return CARD_W;
  return numRounds * (CARD_W + ARM_W * 2 + LINE_PX) - ARM_W * 2 - LINE_PX;
}
function totalHeight(r0Count: number): number {
  return Math.max(r0Count * BASE_SLOT, CARD_H + 20);
}

// ── SmallBadge ──────────────────────────────────────────────────────────────
function SmallBadge({ uri, name, size = 18 }: { uri: string; name: string; size?: number }) {
  const colors = useColors();
  const [err, setErr] = useState(false);
  if (!uri || err) {
    const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
    return (
      <View style={[bStyles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }]}>
        <Text style={{ fontSize: size * 0.42, fontFamily: "Inter_700Bold", color: colors.foreground }}>{initials}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" onError={() => setErr(true)} />;
}

// ── SeriesCard ───────────────────────────────────────────────────────────────
function SeriesCard({ series, winsNeeded }: { series: KhlPlayoffSeries; winsNeeded: number }) {
  const colors = useColors();
  const homeWon = series.homeWins >= winsNeeded;
  const awayWon = series.awayWins >= winsNeeded;
  const homeLeads = series.homeWins > series.awayWins;
  const awayLeads = series.awayWins > series.homeWins;

  const homeColor = homeWon
    ? colors.primary
    : homeLeads && !series.isDone
    ? colors.foreground
    : colors.mutedForeground;
  const awayColor = awayWon
    ? colors.primary
    : awayLeads && !series.isDone
    ? colors.foreground
    : colors.mutedForeground;

  return (
    <View style={[bStyles.card, {
      backgroundColor: colors.card,
      borderColor: series.isDone ? colors.border : colors.primary + "30",
      borderWidth: series.isDone ? StyleSheet.hairlineWidth : 1,
    }]}>
      {/* Home row */}
      <View style={bStyles.teamRow}>
        <SmallBadge uri={series.homeBadge} name={series.homeTeam} />
        <Text
          numberOfLines={1}
          style={[bStyles.teamName, { color: homeColor, fontFamily: homeLeads || homeWon ? "Inter_600SemiBold" : "Inter_400Regular" }]}
        >
          {series.homeTeam}
        </Text>
        <Text style={[bStyles.wins, { color: homeColor, fontFamily: homeWon ? "Inter_700Bold" : "Inter_500Medium" }]}>
          {series.homeWins}
        </Text>
      </View>

      <View style={[bStyles.divider, { backgroundColor: colors.border }]} />

      {/* Away row */}
      <View style={bStyles.teamRow}>
        <SmallBadge uri={series.awayBadge} name={series.awayTeam} />
        <Text
          numberOfLines={1}
          style={[bStyles.teamName, { color: awayColor, fontFamily: awayLeads || awayWon ? "Inter_600SemiBold" : "Inter_400Regular" }]}
        >
          {series.awayTeam}
        </Text>
        <Text style={[bStyles.wins, { color: awayColor, fontFamily: awayWon ? "Inter_700Bold" : "Inter_500Medium" }]}>
          {series.awayWins}
        </Text>
      </View>
    </View>
  );
}

// ── TBD Card ─────────────────────────────────────────────────────────────────
function TbdCard() {
  const colors = useColors();
  return (
    <View style={[bStyles.card, { backgroundColor: colors.muted + "60", borderColor: colors.border }]}>
      <View style={bStyles.tbdInner}>
        <Text style={[bStyles.tbdText, { color: colors.mutedForeground }]}>ТБД</Text>
      </View>
    </View>
  );
}

// ── Round label ───────────────────────────────────────────────────────────────
function RoundLabel({ name, x }: { name: string; x: number }) {
  const colors = useColors();
  return (
    <View style={[bStyles.roundLabel, { left: x, width: CARD_W }]}>
      <Text style={[bStyles.roundLabelText, { color: colors.mutedForeground }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

// ── Connector lines between two rounds ────────────────────────────────────────
const CANVAS_PAD = 16; // must match card `left: CANVAS_PAD + colX(ri)`

function Connectors({
  roundIdx, leftSeriesCount, rightSeriesCount, lineColor,
}: {
  roundIdx: number;
  leftSeriesCount: number;
  rightSeriesCount: number;
  lineColor: string;
}) {
  const lines: React.ReactNode[] = [];
  const forkX = CANVAS_PAD + colX(roundIdx) + CARD_W;
  const midX = forkX + ARM_W;

  for (let si = 0; si < leftSeriesCount; si += 2) {
    const top = cardMidY(roundIdx, si);
    const bot = cardMidY(roundIdx, si + 1);
    const midY = (top + bot) / 2;
    const nextIdx = Math.floor(si / 2);
    const nextMid = cardMidY(roundIdx + 1, nextIdx);

    // top arm
    lines.push(
      <View key={`ta${si}`} style={[bStyles.hLine, { left: forkX, top: top - LINE_PX / 2, width: ARM_W, height: LINE_PX, backgroundColor: lineColor }]} />,
    );
    // bottom arm
    lines.push(
      <View key={`ba${si}`} style={[bStyles.hLine, { left: forkX, top: bot - LINE_PX / 2, width: ARM_W, height: LINE_PX, backgroundColor: lineColor }]} />,
    );
    // vertical join
    lines.push(
      <View key={`vj${si}`} style={[bStyles.vLine, { left: midX - LINE_PX / 2, top: Math.min(top, bot), width: LINE_PX, height: Math.abs(bot - top), backgroundColor: lineColor }]} />,
    );
    // output arm
    lines.push(
      <View key={`oa${si}`} style={[bStyles.hLine, { left: midX, top: nextMid - LINE_PX / 2, width: ARM_W, height: LINE_PX, backgroundColor: lineColor }]} />,
    );
  }
  return <>{lines}</>;
}

// ── Main KhlBracket component ─────────────────────────────────────────────────
interface KhlBracketProps {
  rounds: KhlPlayoffRound[];
  bottomPadding?: number;
}

const ROUND_WINS: Record<string, number> = {
  "1/8 финала": 3,
  "1/4 финала": 3,
  "1/2 финала": 4,
  "Кубок Гагарина": 4,
};
const LABEL_H = 28;

export function KhlBracket({ rounds, bottomPadding = 0 }: KhlBracketProps) {
  const colors = useColors();
  const { width: screenW } = useWindowDimensions();

  if (!rounds || rounds.length === 0) {
    return (
      <View style={bStyles.empty}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🏒</Text>
        <Text style={[bStyles.emptyTitle, { color: colors.foreground }]}>Сетка плей-офф</Text>
        <Text style={[bStyles.emptyText, { color: colors.mutedForeground }]}>
          Данные появятся когда начнётся плей-офф
        </Text>
      </View>
    );
  }

  const numRounds = rounds.length;
  const r0Count = rounds[0]?.series?.length ?? 1;
  const bHeight = totalHeight(r0Count);
  const bWidth = totalWidth(numRounds);
  const lineColor = colors.border;

  const contentW = Math.max(bWidth + 32, screenW);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ width: contentW, paddingBottom: bottomPadding + 24 }}
    >
      {/* Round labels row */}
      <View style={[bStyles.labelsRow, { width: contentW }]}>
        {rounds.map((r, ri) => (
          <RoundLabel key={ri} name={r.name} x={CANVAS_PAD + colX(ri)} />
        ))}
      </View>

      {/* Bracket canvas */}
      <View style={[bStyles.canvas, { width: contentW, height: bHeight }]}>

        {/* Connector lines between rounds */}
        {rounds.map((r, ri) => {
          if (ri >= numRounds - 1) return null;
          return (
            <Connectors
              key={ri}
              roundIdx={ri}
              leftSeriesCount={r.series.length}
              rightSeriesCount={rounds[ri + 1]?.series?.length ?? 1}
              lineColor={lineColor}
            />
          );
        })}

        {/* Series cards */}
        {rounds.map((r, ri) => {
          const winsNeeded = ROUND_WINS[r.name] ?? 4;
          return r.series.map((s, si) => (
            <View
              key={`${ri}-${si}`}
              style={[bStyles.cardWrapper, {
                left: CANVAS_PAD + colX(ri),
                top: cardTopY(ri, si),
                width: CARD_W,
                height: CARD_H,
              }]}
            >
              <SeriesCard series={s} winsNeeded={winsNeeded} />
            </View>
          ));
        })}

      </View>
    </ScrollView>
  );
}

const bStyles = StyleSheet.create({
  labelsRow: {
    height: LABEL_H + 8,
    position: "relative",
  },
  canvas: {
    position: "relative",
  },
  cardWrapper: {
    position: "absolute",
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
  tbdInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tbdText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hLine: {
    position: "absolute",
  },
  vLine: {
    position: "absolute",
  },
  roundLabel: {
    position: "absolute",
    top: 4,
    height: LABEL_H,
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  roundLabelText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textAlign: "center",
    textTransform: "uppercase",
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
