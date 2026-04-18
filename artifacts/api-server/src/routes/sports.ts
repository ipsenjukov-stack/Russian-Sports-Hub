import { Router } from "express";
import { translateTeam, translateVenue } from "./sportsTranslations";

const router = Router();

const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache(url: string): Promise<unknown> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, fetchedAt: now });
  return data;
}

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

// GET /api/sports/season-events?leagueId=4355&season=2025-2026
router.get("/sports/season-events", async (req, res) => {
  const { leagueId, season } = req.query as { leagueId?: string; season?: string };
  if (!leagueId || !season) {
    res.status(400).json({ error: "leagueId and season are required" });
    return;
  }
  try {
    const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(season)}`;
    const data = (await fetchWithCache(url)) as { events?: RawEvent[] };
    const events = (data?.events || []).map(localizeEvent);
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch season events");
    res.status(502).json({ error: "Failed to fetch data" });
  }
});

// GET /api/sports/all-matches — fetches all Russian leagues, merges and returns matches
const LEAGUES = [
  { id: "4355", sport: "football",   name: "Российская Премьер-лига", seasons: ["2025-2026", "2024-2025"] },
  { id: "4920", sport: "hockey",     name: "КХЛ",                     seasons: ["2025-2026", "2024-2025"] },
  { id: "4476", sport: "basketball", name: "Единая лига ВТБ",         seasons: ["2024-2025", "2023-2024"] },
  { id: "4545", sport: "volleyball", name: "Суперлига Волейбол",      seasons: ["2024-2025", "2023-2024"] },
];

router.get("/sports/all-matches", async (req, res) => {
  try {
    const allEvents: unknown[] = [];

    await Promise.all(
      LEAGUES.flatMap((league) =>
        league.seasons.map(async (season) => {
          try {
            const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${encodeURIComponent(league.id)}&s=${encodeURIComponent(season)}`;
            const data = (await fetchWithCache(url)) as { events?: RawEvent[] };
            const events = (data?.events || []).map((e) => ({
              ...localizeEvent(e),
              _sport: league.sport,
              _leagueName: league.name,
            }));
            allEvents.push(...events);
          } catch {
            // Skip failed leagues silently
          }
        })
      )
    );

    // Deduplicate by idEvent
    const seen = new Set<string>();
    const unique = allEvents.filter((e) => {
      const id = (e as RawEvent).idEvent;
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

export default router;
