import { useQuery } from "@tanstack/react-query";
import { fetchAllMatches } from "@/services/sportsdb";
import { Match, SportType } from "@/types/sports";

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
