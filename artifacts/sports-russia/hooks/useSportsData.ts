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

export interface StandingsData {
  league: string | null; season: string | null;
  entries: StandingEntry[];
}

async function fetchStandings(sport: string): Promise<StandingsData> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/sports/standings?sport=${sport}`);
  if (!res.ok) throw new Error("standings fetch failed");
  return res.json() as Promise<StandingsData>;
}

export function useStandings(sport: string) {
  return useQuery<StandingsData>({
    queryKey: ["standings", sport],
    queryFn: () => fetchStandings(sport),
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
