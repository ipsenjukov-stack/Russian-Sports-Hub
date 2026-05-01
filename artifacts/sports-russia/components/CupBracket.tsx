import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { CupRound, CupMatch, CupBracketData } from "@/hooks/useSportsData";

// ── bracket geometry ──────────────────────────────────────────────────────────
const CARD_W  = 152;
const CARD_H  = 66;
const ARM_W   = 18;
const LINE_PX = 1.5;
const BASE_SLOT = 80;
const CONN_W  = ARM_W * 2 + LINE_PX;
const LABEL_H = 22;

function slotH(ri: number) { return BASE_SLOT * Math.pow(2, ri); }
function cardTopY(ri: number, si: number) { const sh = slotH(ri); return LABEL_H + si * sh + (sh - CARD_H) / 2; }
function cardMidY(ri: number, si: number) { return cardTopY(ri, si) + CARD_H / 2; }
function totalH(n: number) { return LABEL_H + Math.max(n * BASE_SLOT, CARD_H + 20); }

// ── shared helpers ────────────────────────────────────────────────────────────
function SmallBadge({ uri, name, size = 18 }: { uri?: string; name: string; size?: number }) {
  const colors = useColors();
  const [err, setErr] = useState(false);
  if (!uri || err) {
    const initials = name.split(" ").filter(Boolean).slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? "").join("");
    return (
      <View style={[cs.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted }]}>
        <Text style={{ fontSize: size * 0.42, fontFamily: "Inter_700Bold", color: colors.foreground }}>{initials}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" onError={() => setErr(true)} />;
}

function formatDate(date: string, time?: string): string {
  try {
    const d = time ? new Date(`${date}T${time}Z`) : new Date(date);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
  } catch { return date; }
}

// ── match card (used in both bracket + list) ──────────────────────────────────
function MatchCard({ match, compact = false }: { match: CupMatch; compact?: boolean }) {
  const colors = useColors();
  const finished = match.status === "finished";
  const live     = match.status === "live";
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const homeWon  = finished && hasScore && match.homeScore! > match.awayScore!;
  const awayWon  = finished && hasScore && match.awayScore! > match.homeScore!;

  const rowStyle = (won: boolean) => [
    cs.teamRow,
    { opacity: finished && !won && hasScore ? 0.55 : 1 },
  ];

  return (
    <View style={[cs.card, {
      backgroundColor: colors.card,
      borderColor: live ? colors.primary + "60" : colors.border,
      borderWidth: live ? 1 : StyleSheet.hairlineWidth,
      paddingHorizontal: compact ? 6 : 8,
      paddingVertical: compact ? 4 : 6,
    }]}>
      <View style={rowStyle(homeWon)}>
        <SmallBadge uri={match.homeBadge} name={match.homeTeam} size={compact ? 14 : 18} />
        <Text numberOfLines={1} style={[cs.teamName, { color: colors.foreground, fontFamily: homeWon ? "Inter_700Bold" : "Inter_500Medium", fontSize: compact ? 10 : 11 }]}>
          {match.homeTeam}
        </Text>
        {hasScore
          ? <Text style={[cs.score, { color: homeWon ? colors.primary : colors.foreground, fontFamily: homeWon ? "Inter_700Bold" : "Inter_500Medium" }]}>{match.homeScore}</Text>
          : <Text style={[cs.scoreDash, { color: colors.mutedForeground }]}>–</Text>}
      </View>
      <View style={[cs.divider, { backgroundColor: colors.border }]} />
      <View style={rowStyle(awayWon)}>
        <SmallBadge uri={match.awayBadge} name={match.awayTeam} size={compact ? 14 : 18} />
        <Text numberOfLines={1} style={[cs.teamName, { color: colors.foreground, fontFamily: awayWon ? "Inter_700Bold" : "Inter_500Medium", fontSize: compact ? 10 : 11 }]}>
          {match.awayTeam}
        </Text>
        {hasScore
          ? <Text style={[cs.score, { color: awayWon ? colors.primary : colors.foreground, fontFamily: awayWon ? "Inter_700Bold" : "Inter_500Medium" }]}>{match.awayScore}</Text>
          : <Text style={[cs.scoreDash, { color: colors.mutedForeground }]}>{formatDate(match.date, match.time)}</Text>}
      </View>
      {live && (
        <View style={[cs.livePill, { backgroundColor: colors.primary }]}>
          <Text style={cs.livePillText}>LIVE</Text>
        </View>
      )}
    </View>
  );
}

// ── bracket connector lines ───────────────────────────────────────────────────
function ConnectorCol({ roundIdx, leftCount, lineColor, canvasH }: {
  roundIdx: number; leftCount: number; lineColor: string; canvasH: number;
}) {
  const lines: React.ReactNode[] = [];
  for (let si = 0; si < leftCount; si += 2) {
    const top  = cardMidY(roundIdx, si);
    const bot  = cardMidY(roundIdx, si + 1);
    const outY = cardMidY(roundIdx + 1, Math.floor(si / 2));
    lines.push(
      <View key={`ta${si}`} style={{ position: "absolute", left: 0, top: top - LINE_PX / 2, width: ARM_W, height: LINE_PX, backgroundColor: lineColor }} />,
      <View key={`ba${si}`} style={{ position: "absolute", left: 0, top: bot - LINE_PX / 2, width: ARM_W, height: LINE_PX, backgroundColor: lineColor }} />,
      <View key={`vj${si}`} style={{ position: "absolute", left: ARM_W - LINE_PX / 2, top: Math.min(top, bot), width: LINE_PX, height: Math.abs(bot - top) + LINE_PX, backgroundColor: lineColor }} />,
      <View key={`oa${si}`} style={{ position: "absolute", left: ARM_W, top: outY - LINE_PX / 2, width: ARM_W + LINE_PX, height: LINE_PX, backgroundColor: lineColor }} />,
    );
  }
  return <View style={{ width: CONN_W, height: canvasH }}>{lines}</View>;
}

// ── playoff view — bracket if ≤8 QF matches and power-of-2 structure, else list ──
function PlayoffView({ rounds, bottomPadding }: { rounds: CupRound[]; bottomPadding: number }) {
  if (!rounds.length) return <EmptyState text="Плей-офф ещё не начался" />;
  // Use bracket only if first round has ≤8 single-leg matches (clean structure)
  const firstCount = rounds[0]?.matches?.length ?? 0;
  const isPowerOf2 = firstCount > 0 && (firstCount & (firstCount - 1)) === 0;
  if (isPowerOf2 && firstCount <= 8) {
    return <BracketView rounds={rounds} bottomPadding={bottomPadding} />;
  }
  return <ListView rounds={rounds} bottomPadding={bottomPadding} />;
}

// ── bracket view (Плей-офф) ───────────────────────────────────────────────────
function BracketView({ rounds, bottomPadding }: { rounds: CupRound[]; bottomPadding: number }) {
  const colors = useColors();

  if (!rounds.length) return <EmptyState text="Плей-офф ещё не начался" />;

  const r0Count = rounds[0]?.matches?.length ?? 1;
  const canvasH = totalH(r0Count);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        <View style={[cs.bracketRow, { height: canvasH }]}>
          {rounds.map((r, ri) => {
            const slot     = slotH(ri);
            const firstPad = (slot - CARD_H) / 2;
            const gap      = slot - CARD_H;
            return (
              <React.Fragment key={ri}>
                <View style={{ width: CARD_W }}>
                  <View style={{ height: LABEL_H, justifyContent: "flex-end", paddingBottom: 3 }}>
                    <Text numberOfLines={1} style={[cs.roundLabel, { color: colors.mutedForeground }]}>{r.name}</Text>
                  </View>
                  <View style={{ paddingTop: firstPad }}>
                    {r.matches.map((m, mi) => (
                      <View key={mi} style={{ height: CARD_H, marginTop: mi > 0 ? gap : 0 }}>
                        <MatchCard match={m} />
                      </View>
                    ))}
                  </View>
                </View>
                {ri < rounds.length - 1 && r.matches.length > 1 && (
                  <ConnectorCol roundIdx={ri} leftCount={r.matches.length} lineColor={colors.border} canvasH={canvasH} />
                )}
                {ri < rounds.length - 1 && r.matches.length <= 1 && (
                  <View style={{ width: CONN_W }} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

// ── list view (Путь РПЛ / Путь Регионов) ─────────────────────────────────────
function ListView({ rounds, bottomPadding }: { rounds: CupRound[]; bottomPadding: number }) {
  const colors = useColors();

  if (!rounds.length) return <EmptyState text="Матчи не найдены" />;

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding + 24, paddingTop: 8 }}>
      {rounds.map((r) => (
        <View key={r.name} style={{ marginBottom: 20 }}>
          <Text style={[cs.roundHeader, { color: colors.mutedForeground }]}>{r.name}</Text>
          <View style={{ gap: 8 }}>
            {r.matches.map((m, mi) => (
              <MatchCard key={mi} match={m} compact={false} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={cs.empty}>
      <Text style={{ fontSize: 34, marginBottom: 10 }}>🏆</Text>
      <Text style={[cs.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

// ── tab bar ───────────────────────────────────────────────────────────────────
type TabKey = "rpl" | "regions" | "playoff";
const TABS: { key: TabKey; label: string }[] = [
  { key: "rpl",     label: "Путь РПЛ"      },
  { key: "regions", label: "Путь Регионов" },
  { key: "playoff", label: "Плей-офф"      },
];

// ── main export ───────────────────────────────────────────────────────────────
interface CupBracketProps {
  data: CupBracketData;
  bottomPadding?: number;
}

export function CupBracket({ data, bottomPadding = 0 }: CupBracketProps) {
  const colors = useColors();
  const [tab, setTab] = useState<TabKey>("playoff");

  return (
    <View style={{ flex: 1 }}>
      {/* Tab bar */}
      <View style={[cs.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={cs.tabBtn}>
              <Text style={[cs.tabText, {
                color: active ? colors.primary : colors.mutedForeground,
                fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
              }]}>
                {label}
              </Text>
              {active && <View style={[cs.tabIndicator, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {tab === "playoff" && <PlayoffView  rounds={data.playoff?.rounds ?? []} bottomPadding={bottomPadding} />}
      {tab === "rpl"     && <ListView     rounds={data.rpl?.rounds     ?? []} bottomPadding={bottomPadding} />}
      {tab === "regions" && <ListView     rounds={data.regions?.rounds  ?? []} bottomPadding={bottomPadding} />}
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    position: "relative",
  },
  tabText: { fontSize: 12.5 },
  tabIndicator: { position: "absolute", bottom: 0, left: 4, right: 4, height: 2, borderRadius: 1 },

  bracketRow: { flexDirection: "row", alignItems: "flex-start" },
  roundLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textAlign: "center", textTransform: "uppercase" },
  roundHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },

  card: { flex: 1, borderRadius: 8, justifyContent: "space-between", overflow: "hidden" },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  teamName: { flex: 1 },
  score: { fontSize: 14, width: 18, textAlign: "center" },
  scoreDash: { fontSize: 11, textAlign: "right" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  badge: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  livePill: { position: "absolute", top: 2, right: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  livePillText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#fff" },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
