import { Match, SportType } from "@/types/sports";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

export const LEAGUES: { id: string; sport: SportType; name: string; seasons: string[] }[] = [
  { id: "4355", sport: "football", name: "Российская Премьер-лига", seasons: ["2025-2026", "2024-2025"] },
  { id: "4920", sport: "hockey",   name: "КХЛ",                     seasons: ["2025-2026", "2024-2025"] },
  { id: "4476", sport: "basketball", name: "Единая лига ВТБ",       seasons: ["2024-2025", "2023-2024"] },
  { id: "4545", sport: "volleyball", name: "Суперлига Волейбол",    seasons: ["2024-2025", "2023-2024"] },
];

export interface SportsDBEvent {
  idEvent: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strTime: string | null;
  strStatus: string | null;
  strVenue: string | null;
  strSport: string;
  strSeason: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
}

const FINISHED_STATUSES = new Set(["Match Finished", "FT", "AP", "AET", "Pen", "Post", "Full Time"]);

export function mapEventToMatch(event: SportsDBEvent, sport: SportType, leagueName: string): Match {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(event.dateEvent);
  eventDate.setHours(0, 0, 0, 0);

  let status: Match["status"];
  if (event.strStatus && FINISHED_STATUSES.has(event.strStatus)) {
    status = "finished";
  } else if (event.intHomeScore !== null && event.intAwayScore !== null) {
    if (eventDate <= today) {
      status = "finished";
    } else {
      status = "live";
    }
  } else if (eventDate.getTime() === today.getTime()) {
    status = "live";
  } else if (eventDate < today) {
    status = "finished";
  } else {
    status = "upcoming";
  }

  const timeStr = event.strTime ? event.strTime.slice(0, 5) : "—";
  const dateStr = formatDateRu(event.dateEvent);

  return {
    id: event.idEvent,
    sport,
    status,
    homeTeam: {
      id: event.strHomeTeam.toLowerCase().replace(/\s+/g, "-"),
      name: event.strHomeTeam,
      shortName: event.strHomeTeam.slice(0, 3).toUpperCase(),
      logo: "",
    },
    awayTeam: {
      id: event.strAwayTeam.toLowerCase().replace(/\s+/g, "-"),
      name: event.strAwayTeam,
      shortName: event.strAwayTeam.slice(0, 3).toUpperCase(),
      logo: "",
    },
    homeScore: event.intHomeScore !== null ? parseInt(event.intHomeScore) : null,
    awayScore: event.intAwayScore !== null ? parseInt(event.intAwayScore) : null,
    startTime: timeStr,
    date: dateStr,
    league: leagueName,
    venue: event.strVenue || undefined,
  };
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const normalize = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd.getTime();
  };
  const norm = normalize(date);

  if (norm === normalize(today)) return "Сегодня";
  if (norm === normalize(yesterday)) return "Вчера";
  if (norm === normalize(tomorrow)) return "Завтра";

  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

async function fetchSeasonEvents(leagueId: string, season: string): Promise<SportsDBEvent[]> {
  try {
    const url = `${BASE_URL}/eventsseason.php?id=${leagueId}&s=${encodeURIComponent(season)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

export async function fetchLeagueMatches(
  leagueId: string,
  sport: SportType,
  leagueName: string,
  seasons: string[]
): Promise<Match[]> {
  const allEvents: SportsDBEvent[] = [];
  for (const season of seasons) {
    const events = await fetchSeasonEvents(leagueId, season);
    allEvents.push(...events);
  }
  // Deduplicate by idEvent
  const seen = new Set<string>();
  const unique = allEvents.filter((e) => {
    if (seen.has(e.idEvent)) return false;
    seen.add(e.idEvent);
    return true;
  });
  // Sort by date desc (most recent first)
  unique.sort((a, b) => new Date(b.dateEvent).getTime() - new Date(a.dateEvent).getTime());
  return unique.map((e) => mapEventToMatch(e, sport, leagueName));
}

export async function fetchAllMatches(): Promise<Match[]> {
  const results = await Promise.all(
    LEAGUES.map((l) => fetchLeagueMatches(l.id, l.sport, l.name, l.seasons))
  );
  return results.flat();
}
