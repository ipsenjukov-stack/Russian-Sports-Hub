import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  KhlConference,
  KhlStandingRow,
  KhlPlayoffRound,
  KhlPlayoffSeries,
} from "@/hooks/useSportsData";
import { KhlBracket } from "./KhlBracket";

// ── TeamBadge ─────────────────────────────────────────────────────────────────
function TeamBadge({ uri, name, size = 24 }: { uri: string; name: string; size?: number }) {
  const colors = useColors();
  const [err, setErr] = useState(false);
  if (!uri || err) {
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    return (
      <View
        style={[
          khlStyles.badgeFallback,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted },
        ]}
      >
        <Text style={[khlStyles.badgeInitials, { fontSize: size * 0.33, color: colors.foreground }]}>
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

// ── KHL Conference Table ──────────────────────────────────────────────────────
const HOCKEY_COLS = ["И", "В", "П", "ЗГ", "ПГ", "О"];
const HOCKEY_COL_KEYS: (keyof KhlStandingRow)[] = ["gp", "w", "l", "gf", "ga", "pts"];

function ConferenceTable({ conf }: { conf: KhlConference }) {
  const colors = useColors();
  return (
    <View style={khlStyles.table}>
      <View style={[khlStyles.tableHeader, { borderBottomColor: colors.border }]}>
        <Text style={[khlStyles.headerRank, { color: colors.mutedForeground }]}>#</Text>
        <Text style={[khlStyles.headerTeam, { color: colors.mutedForeground }]}>Команда</Text>
        {HOCKEY_COLS.map((c) => (
          <Text
            key={c}
            style={[
              khlStyles.headerStat,
              { color: c === "О" ? colors.primary : colors.mutedForeground },
            ]}
          >
            {c}
          </Text>
        ))}
      </View>
      {conf.rows.map((row, idx) => {
        const isEven = idx % 2 === 0;
        const isPlayoffZone = row.rank <= 8;
        return (
          <View
            key={row.team + idx}
            style={[
              khlStyles.tableRow,
              {
                backgroundColor: isEven ? "transparent" : colors.muted + "40",
                borderBottomColor: colors.border,
                borderLeftWidth: isPlayoffZone ? 3 : 0,
                borderLeftColor: isPlayoffZone ? colors.primary + "80" : "transparent",
              },
            ]}
          >
            <Text
              style={[
                khlStyles.rankText,
                { color: row.rank <= 3 ? colors.primary : colors.foreground },
              ]}
            >
              {row.rank}
            </Text>
            <View style={khlStyles.teamCell}>
              <TeamBadge uri={row.badge} name={row.team} size={20} />
              <Text style={[khlStyles.teamName, { color: colors.foreground }]} numberOfLines={1}>
                {row.team}
              </Text>
            </View>
            {HOCKEY_COL_KEYS.map((key, ki) => {
              const val = row[key] as number;
              const isPoints = key === "pts";
              return (
                <Text
                  key={ki}
                  style={[
                    khlStyles.statCell,
                    {
                      color: isPoints
                        ? colors.foreground
                        : colors.mutedForeground,
                      fontFamily: isPoints ? "Inter_700Bold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {val}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
interface KhlStandingsViewProps {
  conferences: KhlConference[];
  playoffs: KhlPlayoffRound[];
  bottomPadding: number;
}

const KHL_TABS = ["Запад", "Восток", "Плей-офф"] as const;
type KhlTab = (typeof KHL_TABS)[number];

export function KhlStandingsView({ conferences, playoffs, bottomPadding }: KhlStandingsViewProps) {
  const colors = useColors();

  const westConf = conferences.find((c) => c.name === "Запад") ?? conferences[0];
  const eastConf = conferences.find((c) => c.name === "Восток") ?? conferences[1];

  const defaultTab: KhlTab = westConf ? "Запад" : "Плей-офф";
  const [activeTab, setActiveTab] = useState<KhlTab>(defaultTab);

  const hasStandings = conferences.length > 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Inner tabs */}
      <View style={[khlStyles.tabBar, { borderBottomColor: colors.border }]}>
        {KHL_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                khlStyles.tab,
                isActive && { borderBottomWidth: 2, borderBottomColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  khlStyles.tabText,
                  {
                    color: isActive ? colors.primary : colors.mutedForeground,
                    fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Playoff bracket — rendered outside the vertical ScrollView to avoid nested-scroll width issues */}
      {activeTab === "Плей-офф" && (
        <KhlBracket rounds={playoffs} bottomPadding={bottomPadding} />
      )}

      {/* Standings (Запад / Восток) */}
      {activeTab !== "Плей-офф" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          {!hasStandings ? (
            <View style={khlStyles.emptyBracket}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🏒</Text>
              <Text style={[khlStyles.emptyTitle, { color: colors.foreground }]}>
                Таблица загружается
              </Text>
              <Text style={[khlStyles.emptyText, { color: colors.mutedForeground }]}>
                Данные Sofascore временно недоступны
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
                {/* Conference header */}
                <View style={[khlStyles.confHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[khlStyles.confName, { color: colors.foreground }]}>
                    {activeTab === "Запад"
                      ? westConf?.name ?? "Запад"
                      : eastConf?.name ?? "Восток"}
                  </Text>
                  <Text style={[khlStyles.confSubtitle, { color: colors.mutedForeground }]}>
                    Регулярный сезон КХЛ
                  </Text>
                </View>
                <ConferenceTable
                  conf={
                    activeTab === "Запад"
                      ? (westConf ?? { name: "Запад", rows: [] })
                      : (eastConf ?? { name: "Восток", rows: [] })
                  }
                />
                {/* Legend */}
                <View style={[khlStyles.legend, { borderTopColor: colors.border }]}>
                  <Text style={[khlStyles.legendText, { color: colors.mutedForeground }]}>
                    И — матчи · В — победы · П — поражения · ЗГ — забито · ПГ — пропущено · О — очки
                  </Text>
                  <Text style={[khlStyles.legendText, { color: colors.mutedForeground, marginTop: 3 }]}>
                    Синяя черта слева — зона плей-офф (топ-8 конференции)
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const khlStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabText: {
    fontSize: 14,
  },
  table: { width: "100%" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRank: {
    width: 24,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  headerTeam: {
    width: 170,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    paddingLeft: 4,
  },
  headerStat: {
    width: 30,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankText: {
    width: 24,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  teamCell: {
    width: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 4,
    overflow: "hidden",
  },
  teamName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  statCell: {
    width: 30,
    fontSize: 12,
    textAlign: "center",
  },
  badgeFallback: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeInitials: {
    fontFamily: "Inter_700Bold",
  },
  confHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  confName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  confSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  legend: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  legendText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  roundBlock: {
    marginBottom: 4,
  },
  roundHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roundName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  seriesGrid: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  seriesCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    width: 180,
    minWidth: 160,
  },
  seriesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  seriesTeam: {
    fontSize: 12,
  },
  seriesWins: {
    fontSize: 16,
    width: 22,
    textAlign: "center",
  },
  seriesDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  emptyBracket: {
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
