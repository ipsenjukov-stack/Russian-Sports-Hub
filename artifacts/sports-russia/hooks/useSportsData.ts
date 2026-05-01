import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchAllMatches, fetchSeasonMatches } from "@/services/sportsdb";
import { Match, SportType } from "@/types/sports";
import { Platform } from "react-native";

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

export function useLigaAPhase2Standings() {
  const { data: matches, isLoading, isError } = useSeasonMatches();

  const { gold, silver } = useMemo(() => {
    function computeGroup(leagueName: string): StandingEntry[] {
      if (!matches) return [];

      const groupMatches = matches.filter(
        (m) =>
          m.league === leagueName &&
          m.status === "finished" &&
          m.homeScore !== null &&
          m.awayScore !== null
      );

      const table: Record<
        string,
        { M: number; W: number; D: number; L: number; GF: number; GA: number; Pts: number; badge: string }
      > = {};

      for (const m of groupMatches) {
        const h = m.homeTeam.name;
        const a = m.awayTeam.name;
        const hs = m.homeScore as number;
        const as_ = m.awayScore as number;

        if (!table[h]) table[h] = { M: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, badge: m.homeTeam.logo };
        if (!table[a]) table[a] = { M: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, badge: m.awayTeam.logo };

        table[h].M++; table[h].GF += hs; table[h].GA += as_;
        table[a].M++; table[a].GF += as_; table[a].GA += hs;

        if (hs > as_) { table[h].W++; table[h].Pts += 3; table[a].L++; }
        else if (hs < as_) { table[a].W++; table[a].Pts += 3; table[h].L++; }
        else { table[h].D++; table[h].Pts++; table[a].D++; table[a].Pts++; }
      }

      return Object.entries(table)
        .map(([name, s]) => ({
          rank: 0,
          team: name,
          badge: s.badge,
          gp: s.M, w: s.W, d: s.D, l: s.L,
          gf: s.GF, ga: s.GA, gd: s.GF - s.GA,
          pts: s.Pts,
        }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    }

    return {
      gold:   computeGroup("Вторая Лига А. Группа Золото"),
      silver: computeGroup("Вторая Лига А. Группа Серебро"),
    };
  }, [matches]);

  return { gold, silver, isLoading, isError };
}
