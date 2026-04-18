import { useQuery } from "@tanstack/react-query";
import { fetchAllMatches, fetchLeagueMatches, LEAGUES } from "@/services/sportsdb";
import { Match, SportType } from "@/types/sports";

export function useAllMatches() {
  return useQuery<Match[]>({
    queryKey: ["allMatches"],
    queryFn: fetchAllMatches,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 2,
  });
}

export function useSportMatches(sport: SportType) {
  const league = LEAGUES.find((l) => l.sport === sport)!;
  return useQuery<Match[]>({
    queryKey: ["matches", sport],
    queryFn: () =>
      fetchLeagueMatches(league.id, league.sport, league.name, league.seasons),
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
