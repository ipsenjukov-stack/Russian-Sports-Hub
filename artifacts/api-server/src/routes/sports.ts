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

// ── Image proxy helper ────────────────────────────────────────────────────────
function proxyImg(url: string | null | undefined): string {
  if (!url) return "";
  return `/api/sports/proxy-image?url=${encodeURIComponent(url)}`;
}

// ── League badge fetching ─────────────────────────────────────────────────────
async function fetchLeagueBadge(leagueId: string): Promise<string> {
  try {
    const url = `${THESPORTSDB_BASE}/lookupleague.php?id=${leagueId}`;
    const data = (await fetchWithCache(url)) as { leagues?: Array<{ strBadge?: string }> };
    return data.leagues?.[0]?.strBadge ?? "";
  } catch {
    return "";
  }
}

// ── ESPN football helpers ─────────────────────────────────────────────────────
type EspnState = "pre" | "in" | "post";

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: {
    id: string;
    name: string;
    displayName: string;
    abbreviation: string;
    logo?: string;
  };
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

async function mapEspnEvent(e: EspnEvent, leagueBadge: string): Promise<Record<string, unknown>> {
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
    strHomeTeamBadge: home?.team?.logo ?? null,
    strAwayTeamBadge: away?.team?.logo ?? null,
    intHomeScore: home?.score ?? null,
    intAwayScore: away?.score ?? null,
    dateEvent: d.toISOString().slice(0, 10),
    strTime: d.toISOString().slice(11, 16),
    strStatus: statusMap[state],
    strVenue: venue,
    _sport: "football",
    _leagueName: "Российская Премьер-лига",
    _leagueBadge: leagueBadge,
    _espnState: state,
    _periodLabel: periodLabel,
    _source: "espn",
  };
}

async function fetchEspnFootball(leagueBadge: string): Promise<unknown[]> {
  const start = dateStr(-90); // 90 days back
  const end = dateStr(60);    // 60 days ahead
  const url = `${ESPN_BASE}?dates=${start}-${end}&limit=300`;
  const data = (await fetchWithCache(url, { "User-Agent": ESPN_UA })) as { events?: EspnEvent[] };
  return await Promise.all((data.events ?? []).map((e) => mapEspnEvent(e, leagueBadge)));
}

// ── TheSportsDB helpers ───────────────────────────────────────────────────────
type RawEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  strVenue?: string | null;
  [key: string]: unknown;
};

// Badge overrides for teams whose TheSportsDB season badge is broken/transparent.
// Key = raw TheSportsDB team name, value = correct badge URL.
const TEAM_BADGE_OVERRIDES: Record<string, string> = {
  "Dynamo Leningrad":    "https://r2.thesportsdb.com/images/media/team/badge/ltbf4f1573327146.png",
  "VC Dynamo Leningrad": "https://r2.thesportsdb.com/images/media/team/badge/ltbf4f1573327146.png",
};

function resolveBadge(rawName: string, badge: string | null | undefined): string | null {
  return TEAM_BADGE_OVERRIDES[rawName] ?? badge ?? null;
}

function localizeEvent(e: RawEvent): RawEvent {
  return {
    ...e,
    strHomeTeam: translateTeam(e.strHomeTeam),
    strAwayTeam: translateTeam(e.strAwayTeam),
    strVenue: translateVenue(e.strVenue) ?? e.strVenue,
    strHomeTeamBadge: resolveBadge(e.strHomeTeam, e.strHomeTeamBadge),
    strAwayTeamBadge: resolveBadge(e.strAwayTeam, e.strAwayTeamBadge),
  };
}

const SPORTSDB_LEAGUES = [
  { id: "4920", sport: "hockey",     name: "КХЛ",                seasons: ["2025-2026", "2024-2025"] },
  { id: "4476", sport: "basketball", name: "Единая лига ВТБ",    seasons: ["2024-2025", "2023-2024"] },
  { id: "4545", sport: "volleyball", name: "Суперлига Волейбол", seasons: ["2024-2025", "2023-2024"] },
];

// TheSportsDB league ID for Russian Premier League (for badge only) — ID 4355
const RPL_SPORTSDB_ID = "4355";

async function fetchSportsDBEvents(): Promise<unknown[]> {
  const allEvents: unknown[] = [];
  await Promise.all(
    SPORTSDB_LEAGUES.flatMap((league) =>
      league.seasons.map(async (season) => {
        try {
          const [events, badge] = await Promise.all([
            (async () => {
              const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${encodeURIComponent(league.id)}&s=${encodeURIComponent(season)}`;
              const data = (await fetchWithCache(url)) as { events?: RawEvent[] };
              return data?.events ?? [];
            })(),
            fetchLeagueBadge(league.id),
          ]);
          const mapped = events.map((e) => ({
            ...localizeEvent(e),
            _sport: league.sport,
            _leagueName: league.name,
            _leagueBadge: badge,
            _source: "sportsdb",
          }));
          allEvents.push(...mapped);
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
    const [rplBadge, sportsdbEvents] = await Promise.all([
      fetchLeagueBadge(RPL_SPORTSDB_ID),
      fetchSportsDBEvents(),
    ]);

    const espnEvents = await fetchEspnFootball(rplBadge).catch(() => [] as unknown[]);

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

// GET /api/sports/proxy-image?url=...
router.get("/sports/proxy-image", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).end(); return; }
  try {
    const imgRes = await fetch(url, { headers: { "User-Agent": ESPN_UA } });
    if (!imgRes.ok) { res.status(502).end(); return; }
    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buf = await imgRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

export default router;
