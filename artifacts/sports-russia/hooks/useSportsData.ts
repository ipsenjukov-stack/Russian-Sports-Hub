import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchAllMatches, fetchSeasonMatches } from "@/services/sportsdb";
import { Match, SportType } from "@/types/sports";
import { Platform } from "react-native";
import {
  LIGA_A_PHASE2_GOLD,
  LIGA_A_PHASE2_SILVER,
} from "@/data/ligaAStandings";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

export interface StandingEntry {
  rank: number; team: string; badge: string;
  gp: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number;
}

export interface KhlStandingRow {
  rank: number; team: string; badge: string;
  gp: number; w: number; otw: number; otl: number; l: number;
  gf: number; ga: number; pts: number;
}

export interface KhlConference {
  name: string;
  rows: KhlStandingRow[];
}

export interface KhlPlayoffSeries {
  round: string;
  homeTeam: string; homeBadge: string; homeWins: number;
  awayTeam: string; awayBadge: string; awayWins: number;
  seriesLength: number;
  bracketPos: number;
  isDone: boolean;
  winnerTeam?: string;
}

export interface KhlPlayoffRound {
  name: string;
  series: KhlPlayoffSeries[];
}

export interface StandingsData {
  league: string | null; season: string | null;
  entries: StandingEntry[];
  conferences?: KhlConference[];
  playoffs?: KhlPlayoffRound[];
  message?: string;
}

function absUrl(url: string | undefined | null, base: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return url;
}

async function fetchStandings(sport: string, league?: string): Promise<StandingsData> {
  const base = getApiBase();
  const url = league
    ? `${base}/api/sports/standings?league=${encodeURIComponent(league)}`
    : `${base}/api/sports/standings?sport=${sport}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("standings fetch failed");
  const data = await res.json() as StandingsData;

  // On native, Image requires absolute URLs — prefix all relative badge paths
  if (base) {
    data.entries?.forEach(e => { e.badge = absUrl(e.badge, base); });
    data.conferences?.forEach(c => c.rows?.forEach(r => { r.badge = absUrl(r.badge, base); }));
    data.playoffs?.forEach(round =>
      round.series?.forEach(s => {
        s.homeBadge = absUrl(s.homeBadge, base);
        s.awayBadge = absUrl(s.awayBadge, base);
      })
    );
  }

  return data;
}

export function useStandings(sport: string, league?: string) {
  return useQuery<StandingsData>({
    queryKey: ["standings", league ?? sport],
    queryFn: () => fetchStandings(sport, league),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function useLigaAStandings(leagues: readonly string[]) {
  const results = useQueries({
    queries: leagues.map((lg) => ({
      queryKey: ["standings", lg],
      queryFn: () => fetchStandings("football", lg),
      staleTime: 30 * 60 * 1000,
      retry: 1,
    })),
  });
  return {
    data: results.map((r) => r.data ?? null),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    refetch: () => results.forEach((r) => r.refetch()),
  };
}

export function useAllMatches() {
  return useQuery<Match[]>({
    queryKey: ["allMatches"],
    queryFn: fetchAllMatches,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useSeasonMatches() {
  return useQuery<Match[]>({
    queryKey: ["seasonMatches"],
    queryFn: fetchSeasonMatches,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useLiveMatches(sport?: SportType) {
  const { data, ...rest } = useAllMatches();
  return {
    ...rest,
    data: (data || []).filter(
      (m) => m.status === "live" && (!sport || m.sport === sport)
    ),
  };
}

export function useFinishedMatches(sport?: SportType) {
  const { data, ...rest } = useAllMatches();
  return {
    ...rest,
    data: (data || []).filter(
      (m) => m.status === "finished" && (!sport || m.sport === sport)
    ),
  };
}

export function useUpcomingMatches(sport?: SportType) {
  const { data, ...rest } = useAllMatches();
  return {
    ...rest,
    data: (data || []).filter(
      (m) => m.status === "upcoming" && (!sport || m.sport === sport)
    ),
  };
}

// Matches played on or before this date are already captured in the static Phase 2 tables.
// Only matches AFTER this date are applied on top of the static data.
const PHASE2_CUTOFF = "2025-09-21";

// Maps API (ESPN) team name → static table team name for Phase 2 Gold
const GOLD_API_TO_STATIC: Record<string, string> = {
  "Ленинградец":        "Ленинградец",
  "Велес Москва":       "Велес Москва",
  "Новосибирск":        "Сибирь",
  "Текстильщик":        "Текстильщик",
  "Машук-КМВ":          "Машук-КМВ",
  "Калуга":             "Калуга",
  "Родина-2 Москва":    "Родина-2",
  "Торпедо Миасс":      "Торпедо Миасс",
  "Волгарь Астрахань":  "Волгарь",
  "Иртыш Омск":         "Иртыш Омск",
};

// Maps API (ESPN) team name → static table team name for Phase 2 Silver
const SILVER_API_TO_STATIC: Record<string, string> = {
  "Алания Владикавказ":       "Алания",
  "Амкар Пермь":              "Амкар",
  "Динамо Брянск":            "Динамо Брянск",
  "Динамо Киров":             "Динамо Киров",
  "Динамо-2 Москва":          "Динамо Москва 2",
  "Динамо Владивосток":       "Динамо Владивосток",
  "Тюмень":                   "Тюмень",
  "Зенит-2 Санкт-Петербург":  "Зенит 2",
  "Кубань Краснодар":         "Кубань Краснодар",
  "Динамо Ставрополь":        "Динамо Ставрополь",
};

export function useLigaAPhase2Standings() {
  const { data: matches, isLoading, isError } = useSeasonMatches();

  const { gold, silver } = useMemo(() => {
    function applyNewMatches(
      staticEntries: StandingEntry[],
      leagueName: string,
      apiToStatic: Record<string, string>,
      badgesByStaticName: Record<string, string>,
    ): StandingEntry[] {
      // Build mutable table indexed by static team name
      const table: Record<string, {
        gp: number; w: number; d: number; l: number;
        gf: number; ga: number; pts: number; badge: string;
      }> = {};

      for (const e of staticEntries) {
        table[e.team] = {
          gp: e.gp, w: e.w, d: e.d, l: e.l,
          gf: e.gf, ga: e.ga, pts: e.pts,
          badge: badgesByStaticName[e.team] ?? e.badge,
        };
      }

      if (matches) {
        const newMatches = matches.filter(
          (m) =>
            m.league === leagueName &&
            m.status === "finished" &&
            m.homeScore !== null &&
            m.awayScore !== null &&
            (m.sortKey ?? "") > PHASE2_CUTOFF,
        );

        for (const m of newMatches) {
          const hStatic = apiToStatic[m.homeTeam.name];
          const aStatic = apiToStatic[m.awayTeam.name];
          // At least one team must be in the static table
          if (!hStatic && !aStatic) continue;

          const hs = m.homeScore as number;
          const as_ = m.awayScore as number;

          // Apply home team stats if tracked
          if (hStatic && table[hStatic]) {
            table[hStatic].gp++; table[hStatic].gf += hs; table[hStatic].ga += as_;
            if (hs > as_) { table[hStatic].w++; table[hStatic].pts += 3; }
            else if (hs < as_) { table[hStatic].l++; }
            else { table[hStatic].d++; table[hStatic].pts++; }
          }

          // Apply away team stats if tracked
          if (aStatic && table[aStatic]) {
            table[aStatic].gp++; table[aStatic].gf += as_; table[aStatic].ga += hs;
            if (as_ > hs) { table[aStatic].w++; table[aStatic].pts += 3; }
            else if (as_ < hs) { table[aStatic].l++; }
            else { table[aStatic].d++; table[aStatic].pts++; }
          }
        }
      }

      return Object.entries(table)
        .map(([name, s]) => ({
          rank: 0,
          team: name,
          badge: s.badge,
          gp: s.gp, w: s.w, d: s.d, l: s.l,
          gf: s.gf, ga: s.ga, gd: s.gf - s.ga,
          pts: s.pts,
        }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    }

    // Build badge lookup from match data (API provides logos by API name)
    const badgesGold: Record<string, string> = {};
    const badgesSilver: Record<string, string> = {};
    if (matches) {
      for (const m of matches) {
        if (m.league === "Вторая Лига А. Группа Золото") {
          const hs = GOLD_API_TO_STATIC[m.homeTeam.name];
          const as_ = GOLD_API_TO_STATIC[m.awayTeam.name];
          if (hs) badgesGold[hs] = m.homeTeam.logo;
          if (as_) badgesGold[as_] = m.awayTeam.logo;
        } else if (m.league === "Вторая Лига А. Группа Серебро") {
          const hs = SILVER_API_TO_STATIC[m.homeTeam.name];
          const as_ = SILVER_API_TO_STATIC[m.awayTeam.name];
          if (hs) badgesSilver[hs] = m.homeTeam.logo;
          if (as_) badgesSilver[as_] = m.awayTeam.logo;
        }
      }
    }

    return {
      gold:   applyNewMatches(LIGA_A_PHASE2_GOLD,   "Вторая Лига А. Группа Золото", GOLD_API_TO_STATIC,   badgesGold),
      silver: applyNewMatches(LIGA_A_PHASE2_SILVER, "Вторая Лига А. Группа Серебро", SILVER_API_TO_STATIC, badgesSilver),
    };
  }, [matches]);

  return { gold, silver, isLoading, isError };
}
