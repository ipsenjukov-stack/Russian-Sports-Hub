import React, { useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Image,
  Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { CupRound, CupMatch, CupBracketData, useSeasonMatches } from "@/hooks/useSportsData";
import { CUP_RPL_GROUPS, CUP_RPL_ZONES, type GroupEntry } from "@/data/cupRplStandings";

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

// ── group standings table (Путь РПЛ) ─────────────────────────────────────────
function zoneColor(rank: number): string | null {
  const z = CUP_RPL_ZONES.find(r => rank >= r.from && rank <= r.to);
  return z?.color ?? null;
}

function GroupTable({ entries, badgeMap }: { entries: GroupEntry[]; badgeMap: Record<string, string> }) {
  const colors = useColors();
  const COLS = ["М", "ЗГ", "ПГ", "РМ", "О"] as const;
  return (
    <View style={cs.groupTable}>
      {/* Header */}
      <View style={[cs.groupHeader, { borderBottomColor: colors.border }]}>
        <Text style={[cs.ghRank, { color: colors.mutedForeground }]}>#</Text>
        <Text style={[cs.ghTeam, { color: colors.mutedForeground }]}>Команда</Text>
        {COLS.map((c) => (
          <Text key={c} style={[cs.ghStat, { color: c === "О" ? colors.primary : colors.mutedForeground }]}>{c}</Text>
        ))}
      </View>
      {/* Rows */}
      {entries.map((e, idx) => {
        const stripe = zoneColor(e.rank);
        const badgeUri = badgeMap[e.team] ?? e.badge ?? "";
        return (
          <View key={e.team} style={[
            cs.groupRow,
            { backgroundColor: idx % 2 === 0 ? "transparent" : colors.muted + "50",
              borderBottomColor: colors.border,
              borderLeftWidth: 4,
              borderLeftColor: stripe ?? "transparent",
            },
          ]}>
            <Text style={[cs.grRank, { color: colors.foreground }]}>{e.rank}</Text>
            <View style={cs.grTeam}>
              <SmallBadge uri={badgeUri} name={e.team} size={20} />
              <Text style={[cs.grTeamName, { color: colors.foreground }]} numberOfLines={1}>{e.team}</Text>
            </View>
            <Text style={[cs.grStat, { color: colors.foreground }]}>{e.gp}</Text>
            <Text style={[cs.grStat, { color: colors.foreground }]}>{e.gf}</Text>
            <Text style={[cs.grStat, { color: colors.foreground }]}>{e.ga}</Text>
            <Text style={[cs.grStat, { color: e.gd > 0 ? "#22c55e" : e.gd < 0 ? "#e53e3e" : colors.foreground }]}>
              {e.gd > 0 ? `+${e.gd}` : e.gd}
            </Text>
            <Text style={[cs.grStat, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{e.pts}</Text>
          </View>
        );
      })}
    </View>
  );
}

function GroupStandingsView({ data, bottomPadding }: { data: CupBracketData; bottomPadding: number }) {
  const { data: seasonMatches } = useSeasonMatches();

  const badgeMap = useMemo(() => {
    const map: Record<string, string> = {};
    // 1. Season matches cover all RPL teams (including those eliminated in group stage)
    for (const m of seasonMatches ?? []) {
      if (m.homeTeam?.name && m.homeTeam?.logo) map[m.homeTeam.name] = m.homeTeam.logo;
      if (m.awayTeam?.name && m.awayTeam?.logo) map[m.awayTeam.name] = m.awayTeam.logo;
    }
    // 2. Cup match data — may override with more specific cup logos
    for (const path of [data.rpl, data.regions, data.playoff]) {
      for (const round of path?.rounds ?? []) {
        for (const m of round.matches) {
          if (m.homeTeam && m.homeBadge) map[m.homeTeam] = m.homeBadge;
          if (m.awayTeam && m.awayBadge) map[m.awayTeam] = m.awayBadge;
        }
      }
    }
    return map;
  }, [data, seasonMatches]);

  const colors = useColors();
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomPadding + 24 }}>
      {CUP_RPL_GROUPS.map((group) => (
        <View key={group.name} style={{ marginBottom: 20 }}>
          <Text style={[cs.roundHeader, { color: colors.mutedForeground, marginBottom: 6 }]}>{group.name}</Text>
          <GroupTable entries={group.entries} badgeMap={badgeMap} />
        </View>
      ))}
      {/* Zone legend */}
      <View style={[cs.zoneLegend, { borderTopColor: colors.border }]}>
        {CUP_RPL_ZONES.map((z) => (
          <View key={z.label} style={cs.zoneLegendRow}>
            <View style={[cs.zoneDot, { backgroundColor: z.color }]} />
            <Text style={[cs.zoneLegendText, { color: colors.mutedForeground }]}>{z.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── regions view — list for rounds 1‑3, bracket for rounds 4+ ────────────────
type RegionsTab = "early" | "playoff";
const REGIONS_TABS: { key: RegionsTab; label: string }[] = [
  { key: "early",   label: "Туры 1–3"   },
  { key: "playoff", label: "Плей-офф"   },
];

function RegionsView({ rounds, bottomPadding }: { rounds: CupRound[]; bottomPadding: number }) {
  const colors   = useColors();
  const [sub, setSub] = useState<RegionsTab>("playoff");

  const earlyRounds   = rounds.filter((_, i) => i < 3);
  const playoffRounds = rounds.filter((_, i) => i >= 3);

  return (
    <View style={{ flex: 1 }}>
      {/* sub-tab bar */}
      <View style={[cs.subTabBar, { borderBottomColor: colors.border }]}>
        {REGIONS_TABS.map(({ key, label }) => {
          const active = sub === key;
          return (
            <Pressable key={key} onPress={() => setSub(key)} style={cs.tabBtn}>
              <Text style={[cs.subTabText, {
                color:      active ? colors.primary : colors.mutedForeground,
                fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
              }]}>{label}</Text>
              {active && <View style={[cs.tabIndicator, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      {sub === "early" && <ListView rounds={earlyRounds} bottomPadding={bottomPadding} />}
      {sub === "playoff" && (
        playoffRounds.length
          ? <BracketView rounds={playoffRounds} bottomPadding={bottomPadding} />
          : <EmptyState text="Плей-офф ещё не начался" />
      )}
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
      {tab === "playoff" && <PlayoffView        rounds={data.playoff?.rounds ?? []} bottomPadding={bottomPadding} />}
      {tab === "rpl"     && <GroupStandingsView data={data} bottomPadding={bottomPadding} />}
      {tab === "regions" && <RegionsView         rounds={data.regions?.rounds ?? []} bottomPadding={bottomPadding} />}
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

  subTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 2,
  },
  subTabText: { fontSize: 11.5 },

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

  groupTable: { borderRadius: 10, overflow: "hidden" },
  groupHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  ghRank: { width: 20, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  ghTeam: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", paddingLeft: 6 },
  ghStat: { width: 30, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  groupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  grRank: { width: 20, fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  grTeam: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 6 },
  grTeamName: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  grStat: { width: 30, fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },

  zoneLegend: { marginTop: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  zoneLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneLegendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
