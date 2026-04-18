import { Match, SportType } from "@/types/sports";
import { Platform } from "react-native";

// On native, EXPO_PUBLIC_DOMAIN is set and we need an absolute URL.
// On web (Replit preview), the shared proxy routes /api → Express, so a relative path works.
function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

const FINISHED_STATUSES = new Set([
  "Match Finished",
  "FT",
  "AP",
  "AET",
  "Pen",
  "Post",
  "Full Time",
]);

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
  // injected server-side
  _sport: SportType;
  _leagueName: string;
}

export function mapEventToMatch(event: SportsDBEvent): Match {
  const sport = event._sport;
  const leagueName = event._leagueName;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(event.dateEvent);
  eventDate.setHours(0, 0, 0, 0);

  let status: Match["status"];
  if (event.strStatus && FINISHED_STATUSES.has(event.strStatus)) {
    status = "finished";
  } else if (
    event.intHomeScore !== null &&
    event.intAwayScore !== null &&
    event.intHomeScore !== "" &&
    event.intAwayScore !== ""
  ) {
    status = eventDate <= today ? "finished" : "live";
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
      shortName: abbrev(event.strHomeTeam),
      logo: "",
    },
    awayTeam: {
      id: event.strAwayTeam.toLowerCase().replace(/\s+/g, "-"),
      name: event.strAwayTeam,
      shortName: abbrev(event.strAwayTeam),
      logo: "",
    },
    homeScore:
      event.intHomeScore !== null && event.intHomeScore !== ""
        ? parseInt(event.intHomeScore)
        : null,
    awayScore:
      event.intAwayScore !== null && event.intAwayScore !== ""
        ? parseInt(event.intAwayScore)
        : null,
    startTime: timeStr,
    date: dateStr,
    league: leagueName,
    venue: event.strVenue || undefined,
  };
}

function abbrev(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const norm = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd.getTime();
  };

  const normDate = norm(date);
  if (normDate === norm(today)) return "Сегодня";
  if (normDate === norm(yesterday)) return "Вчера";
  if (normDate === norm(tomorrow)) return "Завтра";

  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export async function fetchAllMatches(): Promise<Match[]> {
  const base = getApiBase();
  const url = `${base}/api/sports/all-matches`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data: { events: SportsDBEvent[] } = await res.json();

  const events = data.events || [];

  // Sort: most recent first for finished, soonest first for upcoming
  const finished = events
    .filter((e) => {
      const m = mapEventToMatch(e);
      return m.status === "finished";
    })
    .sort(
      (a, b) => new Date(b.dateEvent).getTime() - new Date(a.dateEvent).getTime()
    );

  const live = events.filter((e) => {
    const m = mapEventToMatch(e);
    return m.status === "live";
  });

  const upcoming = events
    .filter((e) => {
      const m = mapEventToMatch(e);
      return m.status === "upcoming";
    })
    .sort(
      (a, b) => new Date(a.dateEvent).getTime() - new Date(b.dateEvent).getTime()
    );

  return [...live, ...finished, ...upcoming].map(mapEventToMatch);
}
