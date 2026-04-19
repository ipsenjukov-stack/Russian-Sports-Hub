import { Router } from "express";
import { translateTeam, translateVenue } from "./sportsTranslations";

const router = Router();

const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/rus.1/scoreboard";
const ESPN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Cache ────────────────────────────────────────────────────────────────────
interface CacheEntry { data: unknown; fetchedAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

async function fetchWithCache(url: string, headers?: Record<string, string>): Promise<unknown> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch error ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(url, { data, fetchedAt: now });
  return data;
}

// ── ESPN football helpers ─────────────────────────────────────────────────────
type EspnState = "pre" | "in" | "post";

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: { id: string; name: string; displayName: string; abbreviation: string };
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: Array<{
    status: { type: { state: EspnState; shortDetail: string; detail: string; completed: boolean }; displayClock: string; period: number };
    competitors: EspnCompetitor[];
    venue?: { fullName: string; address?: { city: string } };
  }>;
}

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function mapEspnEvent(e: EspnEvent): Record<string, unknown> {
  const comp = e.competitions[0];
  if (!comp) return {};
  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  const state: EspnState = comp.status.type.state;
  const statusMap: Record<EspnState, string> = { pre: "upcoming", in: "live", post: "finished" };
  const clock = comp.status.displayClock ?? "";
  const period = comp.status.period ?? 0;
  let periodLabel: string | undefined;
  if (state === "in") {
    if (comp.status.type.shortDetail?.toLowerCase() === "ht") periodLabel = "ПТ";
    else if (period === 1) periodLabel = clock ? `${clock}` : "1-й тайм";
    else if (period === 2) periodLabel = clock ? `${clock}` : "2-й тайм";
    else if (period > 2) periodLabel = "ДОП";
  }

  const d = new Date(e.date);
  const homeName = translateTeam(home?.team?.displayName ?? "");
  const awayName = translateTeam(away?.team?.displayName ?? "");
  const venue = comp.venue?.fullName ? translateVenue(comp.venue.fullName) : null;

  return {
    idEvent: `espn_${e.id}`,
    strHomeTeam: homeName,
    strAwayTeam: awayName,
    intHomeScore: home?.score ?? null,
    intAwayScore: away?.score ?? null,
    dateEvent: d.toISOString().slice(0, 10),
    strTime: d.toISOString().slice(11, 16),
    strStatus: statusMap[state],
    strVenue: venue,
    _sport: "football",
    _leagueName: "Российская Премьер-лига",
    _espnState: state,
    _periodLabel: periodLabel,
    _source: "espn",
  };
}

async function fetchEspnFootball(): Promise<unknown[]> {
  const start = dateStr(-90); // 90 days back
  const end = dateStr(60);    // 60 days ahead
  const url = `${ESPN_BASE}?dates=${start}-${end}&limit=300`;
  const data = (await fetchWithCache(url, { "User-Agent": ESPN_UA })) as { events?: EspnEvent[] };
  return (data.events ?? []).map(mapEspnEvent);
}

// ── TheSportsDB helpers ───────────────────────────────────────────────────────
type RawEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strVenue?: string | null;
  [key: string]: unknown;
};

function localizeEvent(e: RawEvent): RawEvent {
  return {
    ...e,
    strHomeTeam: translateTeam(e.strHomeTeam),
    strAwayTeam: translateTeam(e.strAwayTeam),
    strVenue: translateVenue(e.strVenue) ?? e.strVenue,
  };
}

const SPORTSDB_LEAGUES = [
  { id: "4920", sport: "hockey",     name: "КХЛ",                 seasons: ["2025-2026", "2024-2025"] },
  { id: "4476", sport: "basketball", name: "Единая лига ВТБ",     seasons: ["2024-2025", "2023-2024"] },
  { id: "4545", sport: "volleyball", name: "Суперлига Волейбол",  seasons: ["2024-2025", "2023-2024"] },
];

async function fetchSportsDBEvents(): Promise<unknown[]> {
  const allEvents: unknown[] = [];
  await Promise.all(
    SPORTSDB_LEAGUES.flatMap((league) =>
      league.seasons.map(async (season) => {
        try {
          const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${encodeURIComponent(league.id)}&s=${encodeURIComponent(season)}`;
          const data = (await fetchWithCache(url)) as { events?: RawEvent[] };
          const events = (data?.events ?? []).map((e) => ({
            ...localizeEvent(e),
            _sport: league.sport,
            _leagueName: league.name,
            _source: "sportsdb",
          }));
          allEvents.push(...events);
        } catch {
          // Skip failed leagues silently
        }
      })
    )
  );
  return allEvents;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/sports/all-matches
router.get("/sports/all-matches", async (req, res) => {
  try {
    const [espnEvents, sportsdbEvents] = await Promise.all([
      fetchEspnFootball().catch(() => [] as unknown[]),
      fetchSportsDBEvents(),
    ]);

    const allEvents = [...espnEvents, ...sportsdbEvents];

    // Deduplicate by idEvent
    const seen = new Set<string>();
    const unique = allEvents.filter((e) => {
      const id = (e as { idEvent: string }).idEvent;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json({ events: unique });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch all matches");
    res.status(502).json({ error: "Failed to fetch data" });
  }
});

// GET /api/sports/season-events?leagueId=4355&season=2025-2026 (legacy)
router.get("/sports/season-events", async (req, res) => {
  const { leagueId, season } = req.query as { leagueId?: string; season?: string };
  if (!leagueId || !season) {
    res.status(400).json({ error: "leagueId and season are required" });
    return;
  }
  try {
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(season)}`;
    const data = (await fetchWithCache(url)) as { events?: RawEvent[] };
    const events = (data?.events ?? []).map(localizeEvent);
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch season events");
    res.status(502).json({ error: "Failed to fetch data" });
  }
});

export default router;
