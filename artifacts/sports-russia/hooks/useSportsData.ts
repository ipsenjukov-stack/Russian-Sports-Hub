import { useQuery } from "@tanstack/react-query";
import { fetchAllMatches } from "@/services/sportsdb";
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

export function useAllMatches() {
  return useQuery<Match[]>({
    queryKey: ["allMatches"],
    queryFn: fetchAllMatches,
    staleTime: 5 * 60 * 1000,
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
