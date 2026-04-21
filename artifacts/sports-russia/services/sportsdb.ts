import { Match, SportType } from "@/types/sports";
import { Platform } from "react-native";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

const FINISHED_STATUSES = new Set([
  "Match Finished", "FT", "AP", "AET", "Pen", "Post", "Full Time", "finished",
]);

const LIVE_STATUSES = new Set(["live"]);
const UPCOMING_STATUSES = new Set(["upcoming"]);

export interface SportsDBEvent {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strTime: string | null;
  strStatus: string | null;
  strVenue: string | null;
  _sport: SportType;
  _leagueName: string;
  _leagueBadge?: string | null;
  // ESPN extras
  _espnState?: "pre" | "in" | "post";
  _periodLabel?: string;
  _source?: "espn" | "sportsdb";
}

export function mapEventToMatch(event: SportsDBEvent): Match {
  const sport = event._sport;

  let status: Match["status"];

  if (event._espnState) {
    // ESPN event — status is explicit
    status = event._espnState === "in" ? "live"
      : event._espnState === "post" ? "finished"
      : "upcoming";
  } else if (event.strStatus && FINISHED_STATUSES.has(event.strStatus)) {
    status = "finished";
  } else if (event.strStatus && LIVE_STATUSES.has(event.strStatus)) {
    status = "live";
  } else if (event.strStatus && UPCOMING_STATUSES.has(event.strStatus)) {
    status = "upcoming";
  } else {
    // Infer from date + scores
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.dateEvent);
    eventDate.setHours(0, 0, 0, 0);

    if (
      event.intHomeScore !== null && event.intHomeScore !== "" &&
      event.intAwayScore !== null && event.intAwayScore !== ""
    ) {
      status = eventDate <= today ? "finished" : "live";
    } else if (eventDate.getTime() === today.getTime()) {
      status = "live";
    } else if (eventDate < today) {
      status = "finished";
    } else {
      status = "upcoming";
    }
  }

  const timeStr = event.strTime ? event.strTime.slice(0, 5) : "—";
  const dateStr = formatDateRu(event.dateEvent);

  const homeScore =
    event.intHomeScore !== null && event.intHomeScore !== ""
      ? parseInt(event.intHomeScore)
      : null;
  const awayScore =
    event.intAwayScore !== null && event.intAwayScore !== ""
      ? parseInt(event.intAwayScore)
      : null;

  const base = getApiBase();

  function toProxied(url: string | null | undefined): string {
    if (!url) return "";
    // ESPN logos and Wikimedia/Wikipedia images load fine directly (public CDN)
    if (url.startsWith("https://a.espncdn.com")) return url;
    if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) return url;
    return `${base}/api/sports/proxy-image?url=${encodeURIComponent(url)}`;
  }

  return {
    id: event.idEvent,
    sport,
    status,
    homeTeam: {
      id: event.strHomeTeam.toLowerCase().replace(/\s+/g, "-"),
      name: event.strHomeTeam,
      shortName: abbrev(event.strHomeTeam),
      logo: toProxied(event.strHomeTeamBadge),
    },
    awayTeam: {
      id: event.strAwayTeam.toLowerCase().replace(/\s+/g, "-"),
      name: event.strAwayTeam,
      shortName: abbrev(event.strAwayTeam),
      logo: toProxied(event.strAwayTeamBadge),
    },
    homeScore,
    awayScore,
    startTime: timeStr,
    date: dateStr,
    league: event._leagueName,
    leagueLogo: toProxied(event._leagueBadge),
    venue: event.strVenue || undefined,
    period: event._periodLabel,
  };
}

function abbrev(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
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

  const events = data.events ?? [];
  return events.map(mapEventToMatch);
}
