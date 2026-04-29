import { Router } from "express";
import path from "path";
import fs from "fs";
import { translateTeam, translateVenue } from "./sportsTranslations";
import { PLAYER_RU_NAMES, PLAYER_SLUG_TO_ID } from "./playerNames";

const router = Router();

const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/rus.1/scoreboard";
const ESPN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── sstats.net API (primary football source) ──────────────────────────────────
const SSTATS_BASE = "https://api.sstats.net";
const SSTATS_RPL_LEAGUE_ID = 235;        // Russian Premier League numeric ID
const SSTATS_RPL_LS_ID    = "YacqHHdS"; // Flashscore string league ID

// All Russian football leagues to fetch
const RUSSIAN_FOOTBALL_LEAGUES = [
  { id: 235, name: "Российская Премьер-лига",       year: 2025 },
  { id: 236, name: "Лига PARI",                      year: 2025 },
  { id: 651, name: "Вторая Лига Б. Группа 1",        year: 2025 },
  { id: 652, name: "Вторая Лига Б. Группа 2",        year: 2025 },
  { id: 650, name: "Вторая Лига Б. Группа 3",        year: 2025 },
  { id: 653, name: "Вторая Лига Б. Группа 4",        year: 2025 },
  { id: 1025, name: "Вторая Лига А. Группа Золото",  year: 2025 },
  { id: 1026, name: "Вторая Лига А. Группа Серебро", year: 2025 },
  { id: 1121, name: "Вторая Лига А. Плей-офф",           year: 2025 },
  { id: 1061, name: "Вторая Лига А. Весна Золото",        year: 2025 },
  { id: 1064, name: "Вторая Лига А. Весна Серебро",       year: 2025 },
  { id: 237, name: "FONBET Кубок России",            year: 2025 },
  { id: 663, name: "OLIMPBET Суперкубок России",     year: 2025 },
  { id: 649, name: "Высший дивизион. Женщины",       year: 2025 },
  { id: 238, name: "Первенство молодёжных команд",   year: 2025 },
] as const;
const SSTATS_LOGO_BASE    = "https://media.api-sports.io/football/teams";
// Statuses: 1,2 = Not started; 3-7,11,19 = Live; 7 = HT; 8-10,17,18 = Finished
const SSTATS_LIVE_STATUSES     = new Set([3, 4, 5, 6, 7, 11, 19]);
const SSTATS_HT_STATUS         = 7;
const SSTATS_FINISHED_STATUSES = new Set([8, 9, 10, 17, 18]);
const SSTATS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const SSTATS_HEADERS = { "User-Agent": SSTATS_UA, "Accept": "application/json" };
const SSTATS_KEY = process.env.SSTATS_KEY ?? "";
// Append apikey to query string when key is available
function sstatsQs(params: string): string {
  return SSTATS_KEY ? `${params}&apikey=${SSTATS_KEY}` : params;
}

const SOFASCORE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const SOFASCORE_HEADERS: Record<string, string> = {
  "User-Agent": SOFASCORE_UA,
  "Accept": "application/json",
  "Referer": "https://www.sofascore.com/",
};
const KHL_TOURNAMENT_IDS = new Set<number>([268]);
const SOFASCORE_KHL_BADGE = "https://api.sofascore.app/api/v1/unique-tournament/268/image/dark";

// Sofascore tournament IDs for other leagues
const VTB_TOURNAMENT_ID = 1438;      // Единая лига ВТБ (basketball)
const VOLLEY_TOURNAMENT_ID = 1009;   // Pari Суперлига (volleyball men)

// Sofascore season IDs: real IDs first, then wide fallback range
const VTB_FALLBACK_SEASONS    = [80491, 75000, 73000, 71000, 69000, 67000, 65000, 63000, 61000, 59000];
const VOLLEY_FALLBACK_SEASONS = [80000, 78000, 76000, 74000, 72000, 70000, 68000, 66000, 64000, 62000];

// ── api-sports.ru / api-sports.io volleyball API ──────────────────────────────
// Primary URL: api-sport.ru (Russian endpoint), fallback: api-sports.io
const APISPORTS_VOLLEY_BASES = [
  "https://api.api-sport.ru/volleyball",
  "https://v1.volleyball.api-sports.io",
];
const APISPORTS_KEY = process.env.APISPORTS_KEY ?? "";
// Current season year (api-sports uses start year, e.g. 2025 for 2025/26)
const APISPORTS_VOLLEY_SEASON = 2025;
// League ID cache: discovered once per server run
let apiSportsVolleyLeagueId: number | null = null;

// ── Cache ────────────────────────────────────────────────────────────────────
interface CacheEntry { data: unknown; fetchedAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS       = 3  * 60 * 1000; // 3 minutes (live/today data)
const CACHE_TTL_HIST_MS  = 12 * 60 * 60 * 1000; // 12 hours (past date data)

async function fetchWithCache(
  url: string,
  headers?: Record<string, string>,
  ttlMs = CACHE_TTL_MS,
): Promise<unknown> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.fetchedAt < ttlMs) return cached.data;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch error ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(url, { data, fetchedAt: now });
  return data;
}

// Run tasks with limited concurrency to avoid rate-limiting
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
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
    if (comp.status.type.shortDetail?.toLowerCase() === "ht") periodLabel = "Перерыв";
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

// ── sstats.net football helpers ───────────────────────────────────────────────
// Explicit ID→Russian name for RPL teams (avoids cross-sport name conflicts,
// e.g. "Lokomotiv" = hockey Yaroslavl in generic table, but football Moscow here)
const SSTATS_RPL_TEAM_NAMES: Record<number, string> = {
  555:  "ЦСКА",
  558:  "Спартак",
  596:  "Зенит",
  597:  "Локомотив",
  621:  "Краснодар",
  779:  "Ростов",
  1079: "Крылья Советов",
  1080: "Оренбург",
  1083: "Рубин",
  1085: "Ахмат",
  1088: "Динамо",
  2006: "Балтика",
  2011: "Пари НН",
  2012: "Сочи",
  6786: "Акрон",
  6813: "Динамо Махачкала",
};

interface SstatsTeam {
  id: number;
  name: string;
  flashId?: string;
}
interface SstatsMatch {
  id: number;
  flashId?: string;
  date: string;
  dateUtc: number;
  status: number;
  statusName: string;
  elapsed?: number;
  homeResult: number | null;
  awayResult: number | null;
  homeHTResult?: number | null;
  awayHTResult?: number | null;
  homeTeam: SstatsTeam;
  awayTeam: SstatsTeam;
  roundName?: string;
}

function sstatsTeamLogo(teamId: number): string {
  return proxyImg(`${SSTATS_LOGO_BASE}/${teamId}.png`);
}

function translateSstatsTeam(team: SstatsTeam): string {
  return SSTATS_RPL_TEAM_NAMES[team.id] ?? translateTeam(team.name);
}

function translateRoundName(round: string | null | undefined): string | null {
  if (!round) return null;
  // Already translated / Russian — return as-is
  if (/[а-яёА-ЯЁ]/.test(round)) return round;
  // Cup stage names
  if (/^final$/i.test(round)) return "Финал";
  if (/^semi.?finals?$/i.test(round)) return "Полуфиналы";
  if (/^quarter.?finals?$/i.test(round)) return "Четвертьфиналы";
  if (/^round of 16$/i.test(round)) return "1/8 финала";
  if (/^round of 32$/i.test(round)) return "1/16 финала";
  if (/^3rd place/i.test(round)) return "Матч за 3-е место";
  // "Regions Path - Nth Round" / "Regions Path - Semi-finals"
  const regionsMatch = round.match(/^Regions Path\s*-\s*(.+)$/i);
  if (regionsMatch) {
    const stage = regionsMatch[1].trim();
    if (/semi.?finals?/i.test(stage)) return "Региональный этап — Полуфиналы";
    if (/(\d+)(?:st|nd|rd|th) round/i.test(stage)) {
      const n = stage.match(/(\d+)/);
      return `Региональный этап — ${n?.[1]}-й тур`;
    }
    return `Региональный этап — ${stage}`;
  }
  // "Promotion Round - Group N - M" → "Стыковые матчи — Тур M"
  const promoMatch = round.match(/^Promotion Round\s*-\s*.+\s*-\s*(\d+)$/i);
  if (promoMatch) return `Стыковые матчи — Тур ${promoMatch[1]}`;
  // "Relegation Round - Group N - M" → "Переходные матчи — Тур M"
  const relegMatch = round.match(/^Relegation Round\s*-\s*.+\s*-\s*(\d+)$/i);
  if (relegMatch) return `Переходные матчи — Тур ${relegMatch[1]}`;
  // "Group N - M" / "Division B - Group N - M" → "Тур M"
  const groupMatch = round.match(/Group\s+\d+\s*-\s*(\d+)$/i);
  if (groupMatch) return `Тур ${groupMatch[1]}`;
  // "Spring Season Gold - N" / "Spring Season Silver - N" → "Тур N"
  const springMatch = round.match(/^Spring Season\s+\w+\s*-\s*(\d+)$/i);
  if (springMatch) return `Тур ${springMatch[1]}`;
  // "Fall Season Silver - N" / "Fall Season Gold - N" → "Тур N"
  const fallMatch = round.match(/^Fall Season\s+\w+\s*-\s*(\d+)$/i);
  if (fallMatch) return `Тур ${fallMatch[1]}`;
  // "Regular Season - N" → "Тур N"
  const regularMatch = round.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (regularMatch) return `Тур ${regularMatch[1]}`;
  // Generic "* - N" fallback → "Тур N"
  const genericMatch = round.match(/\s*-\s*(\d+)$/);
  if (genericMatch) return `Тур ${genericMatch[1]}`;
  return round;
}

function mapSstatsMatch(m: SstatsMatch, leagueName: string, leagueBadge: string): Record<string, unknown> {
  const homeName = translateSstatsTeam(m.homeTeam);
  const awayName = translateSstatsTeam(m.awayTeam);

  let strStatus: string;
  let periodLabel: string | undefined;
  if (SSTATS_FINISHED_STATUSES.has(m.status)) {
    strStatus = "finished";
  } else if (SSTATS_LIVE_STATUSES.has(m.status)) {
    strStatus = "live";
    if (m.status === SSTATS_HT_STATUS) {
      periodLabel = "Перерыв";
    } else if (m.elapsed) {
      periodLabel = `${m.elapsed}'`;
    }
  } else {
    strStatus = "upcoming";
  }

  const dt = new Date(m.date);
  const dateEvent = dt.toISOString().slice(0, 10);
  const strTime   = dt.toISOString().slice(11, 16);

  return {
    idEvent: `sstats_${m.id}`,
    strHomeTeam: homeName,
    strAwayTeam: awayName,
    strHomeTeamBadge: sstatsTeamLogo(m.homeTeam.id),
    strAwayTeamBadge: sstatsTeamLogo(m.awayTeam.id),
    intHomeScore: m.homeResult !== null ? String(m.homeResult) : null,
    intAwayScore: m.awayResult !== null ? String(m.awayResult) : null,
    dateEvent,
    strTime,
    strStatus,
    strVenue: null,
    _sport: "football",
    _leagueName: leagueName,
    _leagueBadge: leagueBadge,
    _espnState: strStatus === "live" ? "in" : strStatus === "finished" ? "post" : "pre",
    _periodLabel: periodLabel,
    _source: "sstats",
    _roundName: translateRoundName(m.roundName),
    _flashId: m.flashId ?? null,
    _homeTeamId: m.homeTeam.id,
    _awayTeamId: m.awayTeam.id,
  };
}

async function fetchSstatsLeagueEvents(
  leagueId: number, leagueName: string, leagueBadge: string, year = 2025,
): Promise<unknown[]> {
  const qs = (extra: string) =>
    `${SSTATS_BASE}/Games/list?${sstatsQs(`LeagueId=${leagueId}&TimeZone=3&${extra}`)}`;

  const [endedRes, upcomingRes, liveRes] = await Promise.all([
    fetch(qs(`Ended=true&Year=${year}&Limit=250&Order=-1`), { headers: SSTATS_HEADERS }),
    fetch(qs("Upcoming=true&Limit=15"),                     { headers: SSTATS_HEADERS }),
    fetch(qs("Live=true"),                                  { headers: SSTATS_HEADERS }),
  ]);

  if (!endedRes.ok && !upcomingRes.ok) throw new Error(`sstats fetch failed for league ${leagueId}`);

  const parse = async (r: Response) => {
    try {
      if (!r.ok) return [];
      const j = await r.json() as { data?: SstatsMatch[] };
      return j.data ?? [];
    } catch { return []; }
  };

  const [ended, upcoming, live] = await Promise.all([parse(endedRes), parse(upcomingRes), parse(liveRes)]);

  const seen = new Set<number>();
  const all: SstatsMatch[] = [];
  for (const m of [...live, ...upcoming, ...ended]) {
    if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
  }

  return all.map((m) => mapSstatsMatch(m, leagueName, leagueBadge));
}

async function fetchSstatsFootballEvents(rplBadge: string): Promise<unknown[]> {
  const results = await Promise.allSettled(
    RUSSIAN_FOOTBALL_LEAGUES.map((lg) =>
      fetchSstatsLeagueEvents(lg.id, lg.name, lg.id === 235 ? rplBadge : "", lg.year)
    )
  );
  return results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
}

// Full-season variant: higher limits, separate cache
async function fetchSstatsLeagueSeasonEvents(
  leagueId: number, leagueName: string, leagueBadge: string, year = 2025,
): Promise<unknown[]> {
  const qs = (extra: string) =>
    `${SSTATS_BASE}/Games/list?${sstatsQs(`LeagueId=${leagueId}&TimeZone=3&${extra}`)}`;

  const [endedRes, upcomingRes, liveRes] = await Promise.all([
    fetch(qs(`Ended=true&Year=${year}&Limit=1000&Order=-1`), { headers: SSTATS_HEADERS }),
    fetch(qs("Upcoming=true&Limit=1000"),                    { headers: SSTATS_HEADERS }),
    fetch(qs("Live=true"),                                   { headers: SSTATS_HEADERS }),
  ]);

  const parse = async (r: Response) => {
    try {
      if (!r.ok) return [];
      const j = await r.json() as { data?: SstatsMatch[] };
      return j.data ?? [];
    } catch { return []; }
  };

  const [ended, upcoming, live] = await Promise.all([parse(endedRes), parse(upcomingRes), parse(liveRes)]);
  const seen = new Set<number>();
  const all: SstatsMatch[] = [];
  for (const m of [...live, ...upcoming, ...ended]) {
    if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
  }
  return all.map((m) => mapSstatsMatch(m, leagueName, leagueBadge));
}

let footballSeasonCache: { data: unknown[]; fetchedAt: number } | null = null;
const FOOTBALL_SEASON_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchSstatsFootballSeasonEvents(rplBadge: string): Promise<unknown[]> {
  const now = Date.now();
  if (footballSeasonCache && now - footballSeasonCache.fetchedAt < FOOTBALL_SEASON_CACHE_TTL_MS) {
    return footballSeasonCache.data;
  }
  const results = await Promise.allSettled(
    RUSSIAN_FOOTBALL_LEAGUES.map((lg) =>
      fetchSstatsLeagueSeasonEvents(lg.id, lg.name, lg.id === 235 ? rplBadge : "", lg.year)
    )
  );
  const data = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  footballSeasonCache = { data, fetchedAt: now };
  return data;
}

async function fetchSstatsLeagueStandings(leagueId: number, leagueName: string): Promise<{ league: string; season: string; entries: unknown[] }> {
  const url = `${SSTATS_BASE}/Games/season-table?${sstatsQs(`league=${leagueId}&year=2025&format=csv`)}`;
  const r = await fetch(url, { headers: { "User-Agent": SSTATS_UA, "Accept": "text/csv" } });
  if (!r.ok) throw new Error(`sstats standings error ${r.status}`);
  const csv = await r.text();

  const lines = csv.trim().split("\n");
  if (lines.length < 2) throw new Error("Empty standings CSV");

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));

  const iName   = idx("Team name");
  const iId     = idx("Team Id");
  const iGp     = idx("Total games");
  const iW      = idx("Wins");
  const iD      = idx("Draws");
  const iL      = idx("Loss");
  const iGf     = idx("Goals scored");
  const iGa     = idx("Goals conceded");
  const iPts    = idx("Points");

  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const teamId = parseInt(vals[iId] ?? "0", 10);
    const pts    = parseInt(vals[iPts] ?? "0", 10);
    const gf     = parseInt(vals[iGf] ?? "0", 10);
    const ga     = parseInt(vals[iGa] ?? "0", 10);
    const teamName = SSTATS_RPL_TEAM_NAMES[teamId] ?? translateTeam(vals[iName] ?? "");
    return {
      _teamId: teamId,
      _pts: pts,
      _gf: gf,
      team: teamName,
      badge: sstatsTeamLogo(teamId),
      gp:  parseInt(vals[iGp] ?? "0", 10),
      w:   parseInt(vals[iW]  ?? "0", 10),
      d:   parseInt(vals[iD]  ?? "0", 10),
      l:   parseInt(vals[iL]  ?? "0", 10),
      gf,
      ga,
      gd: gf - ga,
      pts,
    };
  }).filter((r) => r.gp > 0);

  // Sort by pts desc, then gd desc, then gf desc
  rows.sort((a, b) => b._pts - a._pts || (b._gf - b.ga) - (a._gf - a.ga) || b._gf - a._gf);

  const entries = rows.map((r, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _teamId, _pts, _gf, ...clean } = r;
    return { rank: i + 1, ...clean };
  });

  return { league: leagueName, season: "2025-2026", entries };
}

async function fetchSstatsFootballStandings(): Promise<{ league: string; season: string; entries: unknown[] }> {
  return fetchSstatsLeagueStandings(SSTATS_RPL_LEAGUE_ID, "Российская Премьер-лига");
}

// ── Sofascore КХЛ helpers ─────────────────────────────────────────────────────
interface SofascoreTeam { id: number; name: string; shortName?: string }
interface SofascoreScore { current?: number }
interface SofascoreStatus { code: number; description: string; type: string }
interface SofascoreEvent {
  id: number;
  status: SofascoreStatus;
  homeTeam: SofascoreTeam;
  awayTeam: SofascoreTeam;
  homeScore: SofascoreScore;
  awayScore: SofascoreScore;
  startTimestamp: number;
  tournament: { name: string; uniqueTournament?: { id: number } };
  season?: { id: number; year: string };
  roundInfo?: { round?: number; name?: string; cupRoundType?: number };
}

// ── KHL Persistent file cache ─────────────────────────────────────────────────
const KHL_CACHE_FILE = "/tmp/khl_standings_cache.json";

type KhlPersistentCache = {
  seasonId: number;
  seasonYear: string;
  savedAt: number;
  conferences: KhlConference[];
};

function loadKhlPersistentCache(): KhlPersistentCache | null {
  try {
    if (!fs.existsSync(KHL_CACHE_FILE)) return null;
    const raw = fs.readFileSync(KHL_CACHE_FILE, "utf-8");
    const data = JSON.parse(raw) as KhlPersistentCache;
    // Standings cache valid for 7 days (regular season is final for months)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - data.savedAt > maxAge) return null;
    // Re-apply translations in case the table was updated since the cache was saved
    data.conferences = data.conferences.map((conf) => ({
      ...conf,
      rows: conf.rows.map((row) => ({ ...row, team: translateTeam(row.team) })),
    }));
    return data;
  } catch { return null; }
}

function saveKhlPersistentCache(seasonId: number, seasonYear: string, conferences: KhlConference[]): void {
  try {
    const data: KhlPersistentCache = { seasonId, seasonYear, savedAt: Date.now(), conferences };
    fs.writeFileSync(KHL_CACHE_FILE, JSON.stringify(data), "utf-8");
  } catch { /* ignore write errors */ }
}

// Module-level cache for current KHL season ID — persists in memory across requests
// Cleared only on server restart; populated lazily on first successful event fetch
let khlSeasonIdCache: { id: number; year: string; fetchedAt: number } | null = null;

// Candidate season IDs to try when events aren't available (most recent first)
// KHL 2025-26 regular season expected around 63000-66000; 2024-25 playoffs = 61390
const KHL_FALLBACK_SEASON_IDS = [
  { id: 65000, year: "25/26" },
  { id: 64000, year: "25/26" },
  { id: 63500, year: "25/26" },
  { id: 63000, year: "25/26" },
  { id: 62500, year: "25/26" },
  { id: 61390, year: "24/25" },
];

async function tryKhlSeasonId(id: number, year: string): Promise<boolean> {
  const url = `https://api.sofascore.app/api/v1/unique-tournament/268/season/${id}/standings/total`;
  try {
    const data = await fetchWithCache(url, SOFASCORE_HEADERS, CACHE_TTL_HIST_MS) as { standings?: unknown[] };
    return Array.isArray(data.standings) && data.standings.length > 0;
  } catch { return false; }
}

async function getKhlCurrentSeasonId(): Promise<{ id: number; year: string } | null> {
  if (khlSeasonIdCache) {
    return { id: khlSeasonIdCache.id, year: khlSeasonIdCache.year };
  }
  // Try to extract season ID from recent cached scheduled-events first
  const now = new Date();
  for (let i = -3; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const url = `https://api.sofascore.app/api/v1/sport/ice-hockey/scheduled-events/${date}`;
    const ttl = i < 0 ? CACHE_TTL_HIST_MS : CACHE_TTL_MS;
    try {
      const data = await fetchWithCache(url, SOFASCORE_HEADERS, ttl) as { events?: SofascoreEvent[] };
      const khlEvent = (data.events ?? []).find(
        (e) => KHL_TOURNAMENT_IDS.has(e.tournament?.uniqueTournament?.id ?? -1) || e.tournament?.name === "KHL",
      );
      if (khlEvent?.season?.id) {
        khlSeasonIdCache = { id: khlEvent.season.id, year: khlEvent.season.year, fetchedAt: Date.now() };
        return { id: khlEvent.season.id, year: khlEvent.season.year };
      }
    } catch { /* skip */ }
  }
  // Fallback: probe known candidate season IDs
  for (const candidate of KHL_FALLBACK_SEASON_IDS) {
    const valid = await tryKhlSeasonId(candidate.id, candidate.year);
    if (valid) {
      khlSeasonIdCache = { id: candidate.id, year: candidate.year, fetchedAt: Date.now() };
      return { id: candidate.id, year: candidate.year };
    }
  }
  // Last resort: use the persistent file cache season ID (might be from a previous run)
  const fileCached = loadKhlPersistentCache();
  if (fileCached && fileCached.seasonId > 0) {
    khlSeasonIdCache = { id: fileCached.seasonId, year: fileCached.seasonYear, fetchedAt: Date.now() };
    return { id: fileCached.seasonId, year: fileCached.seasonYear };
  }
  return null;
}

// ── Sofascore KHL Standings ───────────────────────────────────────────────────
interface SofascoreStandingsRow {
  team: SofascoreTeam;
  position: number;
  matches?: number;
  wins?: number;
  losses?: number;
  winsInProlongation?: number;
  winsInPenalties?: number;
  lossesInProlongation?: number;
  lossesInPenalties?: number;
  points?: number;
  scoresFor?: number;
  scoresAgainst?: number;
}

type SofascoreStandingsGroup = {
  name: string;
  type: string;
  rows: SofascoreStandingsRow[];
};

// Translate Sofascore conference group name to Russian
function confName(raw: string): string {
  const lo = raw.toLowerCase();
  if (lo.includes("eastern") || lo.includes("east conf")) return "Восток";
  if (lo.includes("western") || lo.includes("west conf")) return "Запад";
  if (lo.includes("east")) return "Восток";
  if (lo.includes("west")) return "Запад";
  if (lo === "total") return "Общая";
  return raw;
}

// Only keep the two main conference groups (not division sub-groups)
function isMainConferenceGroup(name: string): boolean {
  const lo = name.toLowerCase();
  return (
    (lo.includes("eastern") || lo.includes("western")) &&
    lo.includes("conference")
  );
}

type KhlStandingRow = {
  rank: number; team: string; badge: string;
  gp: number; w: number; otw: number; otl: number; l: number;
  gf: number; ga: number; pts: number;
};

type KhlConference = { name: string; rows: KhlStandingRow[] };

async function fetchKhlConferenceStandings(): Promise<{ conferences: KhlConference[]; season: string } | null> {
  const season = await getKhlCurrentSeasonId();
  if (!season) return null;

  const url = `https://api.sofascore.app/api/v1/unique-tournament/268/season/${season.id}/standings/total`;
  try {
    const data = await fetchWithCache(url, SOFASCORE_HEADERS) as { standings?: SofascoreStandingsGroup[] };
    const groups = data.standings ?? [];
    const mainGroups = groups.filter((g) => isMainConferenceGroup(g.name) && g.rows?.length > 0);
    // Fallback: if no groups matched the filter, try all groups with >8 rows
    const filtered = mainGroups.length > 0 ? mainGroups : groups.filter((g) => (g.rows?.length ?? 0) >= 8);
    const conferences: KhlConference[] = filtered
      .map((g) => ({
        name: confName(g.name),
        rows: g.rows.map((r) => ({
          rank: r.position,
          team: translateTeam(r.team.name),
          badge: proxyImg(`https://api.sofascore.app/api/v1/team/${r.team.id}/image`),
          gp: r.matches ?? 0,
          w: r.wins ?? 0,
          otw: (r.winsInProlongation ?? 0) + (r.winsInPenalties ?? 0),
          otl: (r.lossesInProlongation ?? 0) + (r.lossesInPenalties ?? 0),
          l: r.losses ?? 0,
          gf: r.scoresFor ?? 0,
          ga: r.scoresAgainst ?? 0,
          pts: r.points ?? 0,
        })),
      }));
    return { conferences, season: season.year };
  } catch {
    return null;
  }
}

// ── Sofascore KHL Playoffs (CupTrees) ────────────────────────────────────────
interface SofascoreCupParticipant {
  team?: SofascoreTeam;
  wins?: number;
}
interface SofascoreCupBlock {
  participants?: SofascoreCupParticipant[];
}
interface SofascoreCupRound {
  name?: string;
  blocks?: SofascoreCupBlock[];
}
interface SofascoreCupTree {
  name?: string;
  rounds?: SofascoreCupRound[];
}

type KhlPlayoffSeries = {
  round: string;
  homeTeam: string;
  homeBadge: string;
  homeWins: number;
  awayTeam: string;
  awayBadge: string;
  awayWins: number;
  seriesLength: number;
  bracketPos: number;
  isDone: boolean;
  winnerTeam?: string;
};

async function fetchKhlPlayoffsFromEvents(): Promise<{ rounds: { name: string; series: KhlPlayoffSeries[] }[]; season: string } | null> {
  const season = await getKhlCurrentSeasonId();
  if (!season) return null;

  // ── Strategy: use season-paginated endpoints (fast, covers full playoff) ─────
  // /events/last/0 returns most recent 30 events; /events/next/0 returns upcoming
  // This is much more reliable than scanning 77 daily date endpoints
  const allEvents: SofascoreEvent[] = [];

  const [lastData, nextData] = await Promise.all([
    fetchWithCache(
      `https://api.sofascore.app/api/v1/unique-tournament/268/season/${season.id}/events/last/0`,
      SOFASCORE_HEADERS, CACHE_TTL_MS,
    ).catch(() => ({} as Record<string, unknown>)),
    fetchWithCache(
      `https://api.sofascore.app/api/v1/unique-tournament/268/season/${season.id}/events/next/0`,
      SOFASCORE_HEADERS, CACHE_TTL_MS,
    ).catch(() => ({} as Record<string, unknown>)),
  ]);

  const lastEvts = ((lastData as { events?: SofascoreEvent[] }).events ?? []);
  const nextEvts = ((nextData as { events?: SofascoreEvent[] }).events ?? []);
  allEvents.push(...lastEvts, ...nextEvts);

  if (allEvents.length === 0) return null;

  // ── Map Sofascore round names → Russian ────────────────────────────────────
  function sofascoreRoundToRussian(name: string): string {
    const n = (name ?? "").toLowerCase();
    if (n.includes("round 1") || n.includes("first round") || n.includes("1/8")) return "1/8 финала";
    if (n.includes("quarter")) return "1/4 финала";
    if (n.includes("semi")) return "1/2 финала";
    if (n.includes("final") || n.includes("cup") || n.includes("gagarin")) return "Кубок Гагарина";
    return name;
  }

  // ── Build per-series data keyed by stable team-pair ───────────────────────
  type SeriesData = {
    team1: SofascoreTeam; team2: SofascoreTeam;
    team1Wins: number; team2Wins: number;
    firstTimestamp: number; lastTimestamp: number;
    gameCount: number;
    roundName: string;
    roundOrder: number; // lower = earlier round
  };

  const roundOrder = (name: string): number => {
    if (name === "1/8 финала") return 0;
    if (name === "1/4 финала") return 1;
    if (name === "1/2 финала") return 2;
    if (name === "Кубок Гагарина") return 3;
    return 99;
  };

  const seriesMap = new Map<string, SeriesData>();

  for (const ev of allEvents) {
    const t1 = ev.homeTeam;
    const t2 = ev.awayTeam;
    const [a, b] = t1.id < t2.id ? [t1, t2] : [t2, t1];
    const key = `${a.id}|${b.id}`;
    const rName = sofascoreRoundToRussian(ev.roundInfo?.name ?? "");

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        team1: a, team2: b,
        team1Wins: 0, team2Wins: 0,
        firstTimestamp: Infinity, lastTimestamp: 0,
        gameCount: 0,
        roundName: rName,
        roundOrder: roundOrder(rName),
      });
    }
    const s = seriesMap.get(key)!;
    s.gameCount++;
    if (ev.startTimestamp > s.lastTimestamp) s.lastTimestamp = ev.startTimestamp;
    if (ev.startTimestamp < s.firstTimestamp) s.firstTimestamp = ev.startTimestamp;
    // Update roundName if we see a more specific one
    if (rName !== s.roundName && roundOrder(rName) !== 99) s.roundName = rName;

    const finished = ev.status?.type === "finished" || ev.status?.type === "ended";
    if (finished) {
      const hScore = ev.homeScore?.current ?? 0;
      const aScore = ev.awayScore?.current ?? 0;
      if (hScore !== aScore) {
        const winnerTeam = hScore > aScore ? t1 : t2;
        if (winnerTeam.id === a.id) s.team1Wins++; else s.team2Wins++;
      }
    }
  }

  const allSeries = Array.from(seriesMap.values()).filter(s => s.gameCount > 0);

  // ── Infer winners for series where we have incomplete data ────────────────
  // A team that appears in a later round must have won its earlier series
  const teamsByRound = new Map<number, Set<number>>();
  for (const s of allSeries) {
    if (!teamsByRound.has(s.roundOrder)) teamsByRound.set(s.roundOrder, new Set());
    teamsByRound.get(s.roundOrder)!.add(s.team1.id);
    teamsByRound.get(s.roundOrder)!.add(s.team2.id);
  }

  for (const s of allSeries) {
    const WINS_NEEDED = s.roundOrder >= 2 ? 4 : 3; // SF/Final: BO7 (4 wins), R1/QF: BO5 (3 wins)
    if (s.team1Wins >= WINS_NEEDED || s.team2Wins >= WINS_NEEDED) continue; // already determined

    const nextRound = teamsByRound.get(s.roundOrder + 1);
    if (!nextRound) continue; // no next round data yet
    const t1InNext = nextRound.has(s.team1.id);
    const t2InNext = nextRound.has(s.team2.id);
    if (t1InNext && !t2InNext) {
      // team1 won — set to minimum winning score (3 or 4)
      s.team1Wins = WINS_NEEDED;
      s.team2Wins = Math.min(s.team2Wins, WINS_NEEDED - 1);
    } else if (t2InNext && !t1InNext) {
      s.team2Wins = WINS_NEEDED;
      s.team1Wins = Math.min(s.team1Wins, WINS_NEEDED - 1);
    }
  }

  // ── Group into rounds and sort ────────────────────────────────────────────
  const roundMap = new Map<string, SeriesData[]>();
  for (const s of allSeries) {
    if (!roundMap.has(s.roundName)) roundMap.set(s.roundName, []);
    roundMap.get(s.roundName)!.push(s);
  }

  const rounds = Array.from(roundMap.entries())
    .sort(([, a], [, b]) => (a[0]?.roundOrder ?? 99) - (b[0]?.roundOrder ?? 99))
    .map(([name, group]) => {
      const WINS_NEEDED = (group[0]?.roundOrder ?? 99) >= 2 ? 4 : 3;
      group.sort((a, b) => a.firstTimestamp - b.firstTimestamp);
      const series: KhlPlayoffSeries[] = group.map((s, si) => {
        const isDone = s.team1Wins >= WINS_NEEDED || s.team2Wins >= WINS_NEEDED;
        const winnerTeam = isDone
          ? (s.team1Wins >= WINS_NEEDED ? translateTeam(s.team1.name) : translateTeam(s.team2.name))
          : undefined;
        return {
          round: name,
          homeTeam: translateTeam(s.team1.name),
          homeBadge: proxyImg(`https://api.sofascore.app/api/v1/team/${s.team1.id}/image`),
          homeWins: s.team1Wins,
          awayTeam: translateTeam(s.team2.name),
          awayBadge: proxyImg(`https://api.sofascore.app/api/v1/team/${s.team2.id}/image`),
          awayWins: s.team2Wins,
          seriesLength: s.team1Wins + s.team2Wins,
          bracketPos: si,
          isDone,
          winnerTeam,
        };
      });
      return { name, series };
    });

  if (rounds.length === 0) return null;
  return { rounds, season: season.year };
}

// ── Generic Sofascore league standings (basketball / volleyball) ──────────────
type SimpleStandingRow = {
  rank: number; team: string; badge: string;
  gp: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number;
};

async function probeSofascoreSeasonId(tournamentId: number, candidates: number[]): Promise<{ id: number } | null> {
  for (const seasonId of candidates) {
    const url = `https://api.sofascore.app/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`;
    try {
      const data = await fetchWithCache(url, SOFASCORE_HEADERS, CACHE_TTL_HIST_MS) as { standings?: unknown[] };
      if (Array.isArray(data.standings) && data.standings.length > 0) {
        return { id: seasonId };
      }
    } catch { /* try next */ }
  }
  return null;
}

async function fetchSofascoreLeagueStandings(
  tournamentId: number,
  seasonCandidates: number[],
  leagueName: string,
): Promise<{ entries: SimpleStandingRow[]; season: string; league: string } | null> {
  const season = await probeSofascoreSeasonId(tournamentId, seasonCandidates);
  if (!season) return null;
  const url = `https://api.sofascore.app/api/v1/unique-tournament/${tournamentId}/season/${season.id}/standings/total`;
  try {
    const data = await fetchWithCache(url, SOFASCORE_HEADERS) as { standings?: SofascoreStandingsGroup[] };
    // Pick the largest group (the main regular-season table)
    const groups = data.standings ?? [];
    const mainGroup = groups.reduce<SofascoreStandingsGroup | null>(
      (best, g) => (!best || (g.rows?.length ?? 0) > (best.rows?.length ?? 0) ? g : best),
      null,
    );
    if (!mainGroup || !mainGroup.rows?.length) return null;
    const entries: SimpleStandingRow[] = mainGroup.rows.map((r) => ({
      rank: r.position,
      team: translateTeam(r.team.name),
      badge: proxyImg(`https://api.sofascore.app/api/v1/team/${r.team.id}/image`),
      gp: r.matches ?? 0,
      w: r.wins ?? 0,
      d: 0,
      l: r.losses ?? 0,
      gf: r.scoresFor ?? 0,
      ga: r.scoresAgainst ?? 0,
      gd: (r.scoresFor ?? 0) - (r.scoresAgainst ?? 0),
      pts: r.points ?? 0,
    }));
    return { entries, season: String(season.id), league: leagueName };
  } catch { return null; }
}

function khlPeriodLabel(code: number, description: string): string | undefined {
  if (code === 6)  return "1-й период";
  if (code === 7 || code === 41) return "Перерыв";
  if (code === 8)  return "2-й период";
  if (code === 9)  return "Перерыв";
  if (code === 10) return "3-й период";
  if (code === 11) return "ОТ";
  if (code === 12) return "Б/У";
  const d = (description ?? "").toLowerCase();
  if (d.includes("1st period")) return "1-й период";
  if (d.includes("2nd period")) return "2-й период";
  if (d.includes("3rd period")) return "3-й период";
  if (d.includes("overtime") || d.includes(" ot")) return "ОТ";
  if (d.includes("penalt") || d.includes("shootout")) return "Б/У";
  if (d.includes("pause") || d.includes("break")) return "Перерыв";
  return undefined;
}

function mapSofascoreHockeyEvent(e: SofascoreEvent, leagueBadge: string): Record<string, unknown> {
  const statusType = (e.status?.type ?? "notstarted").toLowerCase();
  const statusMap: Record<string, string> = {
    notstarted: "upcoming",
    inprogress: "live",
    finished: "finished",
    ended: "finished",
    canceled: "finished",
    postponed: "finished",
  };
  const mappedStatus = statusMap[statusType] ?? "upcoming";
  const d = new Date(e.startTimestamp * 1000);
  const homeName = translateTeam(e.homeTeam.name);
  const awayName = translateTeam(e.awayTeam.name);

  const isStarted = mappedStatus !== "upcoming";
  const homeScoreStr = isStarted ? String(e.homeScore?.current ?? 0) : null;
  const awayScoreStr = isStarted ? String(e.awayScore?.current ?? 0) : null;

  const periodLabel = mappedStatus === "live"
    ? khlPeriodLabel(e.status.code, e.status.description)
    : undefined;

  return {
    idEvent: `sofascore_${e.id}`,
    strHomeTeam: homeName,
    strAwayTeam: awayName,
    strHomeTeamBadge: `https://api.sofascore.app/api/v1/team/${e.homeTeam.id}/image`,
    strAwayTeamBadge: `https://api.sofascore.app/api/v1/team/${e.awayTeam.id}/image`,
    intHomeScore: homeScoreStr,
    intAwayScore: awayScoreStr,
    dateEvent: d.toISOString().slice(0, 10),
    strTime: d.toISOString().slice(11, 16),
    strStatus: mappedStatus,
    strVenue: null,
    _sport: "hockey",
    _leagueName: "КХЛ",
    _leagueBadge: leagueBadge,
    _periodLabel: periodLabel,
    _source: "sofascore",
  };
}

async function fetchSofascoreHockey(): Promise<unknown[]> {
  const events: unknown[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const dates: { date: string; isPast: boolean }[] = [];

  for (let i = -7; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    dates.push({ date: dateStr, isPast: dateStr < todayStr });
  }

  const tasks = dates.map(({ date, isPast }) => async () => {
    try {
      const url = `https://api.sofascore.app/api/v1/sport/ice-hockey/scheduled-events/${date}`;
      const ttl = isPast ? CACHE_TTL_HIST_MS : CACHE_TTL_MS;
      const data = await fetchWithCache(url, SOFASCORE_HEADERS, ttl) as { events?: SofascoreEvent[] };
      const khlEvents = (data.events ?? []).filter(
        (e) =>
          KHL_TOURNAMENT_IDS.has(e.tournament?.uniqueTournament?.id ?? -1) ||
          e.tournament?.name === "KHL",
      );
      events.push(...khlEvents.map((e) => mapSofascoreHockeyEvent(e, SOFASCORE_KHL_BADGE)));
    } catch {
      // skip failed dates
    }
  });

  // Max 3 concurrent Sofascore requests to avoid rate-limiting
  await pLimit(tasks, 3);

  return events;
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

// Badge fixes: TheSportsDB serves mostly-transparent PNGs for many teams.
// Map the unique filename stem (extracted from the badge URL) → correct badge URL.
// Wikipedia/Wikimedia Commons is used as the replacement source.
const W = "https://upload.wikimedia.org/wikipedia";
const BADGE_FIXES: Record<string, string> = {
  // ── Volleyball Dynamo Leningrad (94.8% transparent in 2024-2025) ──────────
  "txq9nd1742330139": `${W}/commons/thumb/e/e5/OHK_Dynamo_logo.svg/200px-OHK_Dynamo_logo.svg.png`,

  // ── КХЛ: all event-level badges are ~97-99% transparent ──────────────────
  // Dynamo Moscow (hockey)
  "27hsew1615576097": `${W}/commons/thumb/e/e5/OHK_Dynamo_logo.svg/200px-OHK_Dynamo_logo.svg.png`,
  // CSKA Moscow
  "55x2vg1615576080": `${W}/commons/thumb/3/3d/CSKA_Moscow_logo.svg/200px-CSKA_Moscow_logo.svg.png`,
  // Spartak Moscow
  "hrh9w61615576296": `${W}/en/thumb/e/ea/HC_Spartak_Moscow_logo.svg/200px-HC_Spartak_Moscow_logo.svg.png`,
  // SKA Saint Petersburg
  "6k17p41771447068": `${W}/commons/thumb/d/d8/SKA_Saint_Petersburg.svg/200px-SKA_Saint_Petersburg.svg.png`,
  // Ak Bars Kazan
  "fcugks1693637120": `${W}/en/thumb/1/11/Ak_Bars_Kazan_logo.svg/200px-Ak_Bars_Kazan_logo.svg.png`,
  // Lokomotiv Yaroslavl
  "u5l89y1615576119": `${W}/en/thumb/1/14/Lokomotiv_Yaroslavl_Logo.svg/200px-Lokomotiv_Yaroslavl_Logo.svg.png`,
  // Traktor Chelyabinsk
  "rz5xo11615576307": `${W}/en/thumb/5/5a/Traktor_Chelyabinsk_logo.svg/200px-Traktor_Chelyabinsk_logo.svg.png`,
  // Metallurg Magnitogorsk
  "v9a5tu1615576125": `${W}/en/thumb/9/98/HC_Metallurg_Magnitogorsk.png/200px-HC_Metallurg_Magnitogorsk.png`,
  // Torpedo Nizhny Novgorod
  "zdb4w01771447143": `${W}/en/6/6c/TorpedoNovgorodlogo.png`,
  // Salavat Yulaev Ufa
  "0ujble1615576276": `${W}/en/thumb/9/9c/Salavat_Yulaev_Ufa_logo.svg/200px-Salavat_Yulaev_Ufa_logo.svg.png`,
  // Shanghai Dragons
  "dkzbm81756458793": `${W}/en/f/ff/Shanghai_Dragons_Official_Logo.png`,
  // Sibir Novosibirsk
  "55s9q31615576286": `${W}/en/e/ee/HC_Sibir_Novosibirsk_logo.png`,
  // Amur Khabarovsk
  "0mvysq1615575890": `${W}/en/0/03/Amur_Khabarovsk_Logo.png`,
  // Barys Nur-Sultan
  "je395l1693637111": `${W}/en/thumb/1/1d/Barys_Astana_official_logo.png/200px-Barys_Astana_official_logo.png`,
  // Neftekhimik Nizhnekamsk
  "cttja61615576508": `${W}/en/thumb/8/89/HC_Neftekhimik_Nizhnekamsk_logo.svg/200px-HC_Neftekhimik_Nizhnekamsk_logo.svg.png`,
  // Severstal Cherepovets
  "ur1mau1615576281": `${W}/en/thumb/0/00/Severstal_Cherepovets_logo.svg/200px-Severstal_Cherepovets_logo.svg.png`,
  // HC Sochi
  "8vc3yx1734508572": `${W}/en/e/e6/HC_Sochi_Logo_2024.png`,
  // Avangard Omsk
  "usqllb1615575894": `${W}/en/thumb/f/f1/Avangard_Omsk_logo.svg/200px-Avangard_Omsk_logo.svg.png`,
  // Lada Togliatti
  "2c63r81734508162": `${W}/en/thumb/3/39/HC_Lada_Togliatti_Logo.svg/200px-HC_Lada_Togliatti_Logo.svg.png`,
  // Avtomobilist Yekaterinburg
  "a3aeui1615576069": `${W}/en/thumb/0/0a/Avtomobilist_Yekaterinburg_Logo.png/200px-Avtomobilist_Yekaterinburg_Logo.png`,
  // Admiral Vladivostok
  "q3ukqt1641393028": `${W}/en/thumb/e/eb/Admiral_Vladivostok_logo.svg/200px-Admiral_Vladivostok_logo.svg.png`,
  // Vityaz Podolsk
  "s4onee1615576311": `${W}/en/thumb/7/76/Vityaz_Chekhov_Logo.svg/200px-Vityaz_Chekhov_Logo.svg.png`,
  // Kunlun Red Star
  "48f4ry1615576114": `${W}/en/f/f0/HC_Kunlun_Red_Star_logo.png`,
  // Dynamo Minsk
  "j99ran1615576087": `${W}/en/thumb/d/d2/HC_Dinamo_Minsk_logo.png/200px-HC_Dinamo_Minsk_logo.png`,
  // Volleyball Dynamo Moscow (99.2% transparent)
  "l2wdeo1573143851": `${W}/commons/thumb/e/e5/OHK_Dynamo_logo.svg/200px-OHK_Dynamo_logo.svg.png`,
  // Volleyball Dynamo Leningrad — old 2024-25 badge (73% transparent)
  "ltbf4f1573327146": `${W}/commons/thumb/e/e5/OHK_Dynamo_logo.svg/200px-OHK_Dynamo_logo.svg.png`,

  // ── КХЛ season 2024-2025 (different badge IDs) ───────────────────────────
  // SKA Saint Petersburg (2024-25)
  "1yq8fu1693637098": `${W}/commons/thumb/d/d8/SKA_Saint_Petersburg.svg/200px-SKA_Saint_Petersburg.svg.png`,
  // Torpedo Nizhny Novgorod (2024-25)
  "zsuez11615576302": `${W}/en/6/6c/TorpedoNovgorodlogo.png`,

  // ── Единая лига ВТБ (basketball): all ~92-99% transparent ────────────────
  // Автодор Саратов
  "e43xn11680700620": `${W}/en/e/e4/Avtodor_Saratov_logo.png`,
  // Астана
  "bndcnu1680700608": `${W}/en/8/8d/BC_Astana_2022_logo.png`,
  // Зенит Санкт-Петербург
  "6o7td41521741546": `${W}/en/thumb/2/2f/BC_Zenit_Saint_Petersburg_logo.svg/200px-BC_Zenit_Saint_Petersburg_logo.svg.png`,
  // Локомотив-Кубань
  "hakleu1680700695": `${W}/en/thumb/2/23/PBC_Lokomotiv-Kuban_logo.svg/200px-PBC_Lokomotiv-Kuban_logo.svg.png`,
  // Нижний Новгород
  "samuek1680700637": `${W}/en/thumb/e/ef/BC_Nizhny_Novgorod_logo_2022.svg/200px-BC_Nizhny_Novgorod_logo_2022.svg.png`,
  // Парма
  "sz7v4w1680700679": `${W}/en/3/3c/Parma_Basket_logo.png`,
  // Самара
  "xh61z91680700648": `${W}/en/0/00/BC_Samara_2022_logo.png`,
  // УНИКС Казань
  "7gebuz1680700663": `${W}/en/thumb/2/27/UNICS_logo_2014.png/200px-UNICS_logo_2014.png`,
  // ЦСКА Москва
  "dzmymh1680700687": `${W}/en/thumb/7/7e/PBC_CSKA_Moscow_logo.svg/200px-PBC_CSKA_Moscow_logo.svg.png`,
  // Цмоки-Минск
  "p7q8hh1680700656": `${W}/en/thumb/d/dd/BC_Minsk_2022_logo.png/200px-BC_Minsk_2022_logo.png`,

  // ── Суперлига волейбол: ~94-100% transparent ─────────────────────────────
  // Зенит Казань
  "utp0wo1742329861": `${W}/en/thumb/f/f7/Zenit_Kazan_logo.svg/200px-Zenit_Kazan_logo.svg.png`,
  // Локомотив Новосибирск
  "i5fq771742329306": `${W}/en/2/27/VC_Lokomotiv_Novosibirsk.png`,
  // Кузбасс Кемерово
  "fu9ul71573324890": `${W}/en/thumb/2/21/Kuzbass_VC_logo.svg/200px-Kuzbass_VC_logo.svg.png`,
  // Зенит Казань (older season badge ID, same logo)
  "f7auho1570313470": `${W}/en/thumb/f/f7/Zenit_Kazan_logo.svg/200px-Zenit_Kazan_logo.svg.png`,
  // Локомотив Новосибирск (older season badge ID)
  "1yifil1573144891": `${W}/en/2/27/VC_Lokomotiv_Novosibirsk.png`,
  // Зенит Санкт-Петербург (volleyball)
  "8njnyf1572170968": `${W}/en/thumb/4/41/VC_Zenit_SPb.png/200px-VC_Zenit_SPb.png`,
};

function fixBadge(badge: string | null | undefined): string | null {
  if (!badge) return null;
  const stem = badge.split("/").pop()?.replace(/\.png$/i, "") ?? "";
  return BADGE_FIXES[stem] ?? badge;
}

function localizeEvent(e: RawEvent): RawEvent {
  return {
    ...e,
    strHomeTeam: translateTeam(e.strHomeTeam),
    strAwayTeam: translateTeam(e.strAwayTeam),
    strVenue: translateVenue(e.strVenue) ?? e.strVenue,
    strHomeTeamBadge: fixBadge(e.strHomeTeamBadge),
    strAwayTeamBadge: fixBadge(e.strAwayTeamBadge),
  };
}

// TheSportsDB league ID for Russian Premier League (for badge only) — ID 4355
const RPL_SPORTSDB_ID = "4355";

// ── Sofascore basketball (ВТБ) helpers ───────────────────────────────────────
const SOFASCORE_VTB_BADGE = proxyImg(`https://api.sofascore.app/api/v1/unique-tournament/${VTB_TOURNAMENT_ID}/image/dark`);
const SOFASCORE_VOLLEY_BADGE = "/api/sports/logos/pari-superliga.png";

// ── api-sports volleyball helpers ─────────────────────────────────────────────
async function apiSportsFetch(path: string): Promise<unknown> {
  if (!APISPORTS_KEY) throw new Error("No APISPORTS_KEY");
  const headers: Record<string, string> = { "x-apisports-key": APISPORTS_KEY };
  for (const base of APISPORTS_VOLLEY_BASES) {
    const url = `${base}${path}`;
    try {
      const data = await fetchWithCache(url, headers, CACHE_TTL_MS);
      const d = data as { errors?: Record<string, unknown>; results?: number; response?: unknown[] };
      if (d.errors && Object.keys(d.errors).length > 0) continue; // try next base
      return data;
    } catch { continue; }
  }
  throw new Error("All api-sports bases failed");
}

async function getApiSportsVolleyLeagueId(): Promise<number> {
  if (apiSportsVolleyLeagueId !== null) return apiSportsVolleyLeagueId;
  const data = await apiSportsFetch(
    `/leagues?country=Russia&season=${APISPORTS_VOLLEY_SEASON}`,
  ) as { response?: Array<{ league: { id: number; name: string }; country: { name: string } }> };
  const leagues = data.response ?? [];
  // Prefer "Superleague" or "Super League" for men's (women's is usually separate)
  const superleague = leagues.find(
    (l) => /super.?league|суперлига/i.test(l.league?.name ?? ""),
  ) ?? leagues[0];
  if (!superleague) throw new Error("No Russian volleyball league found");
  apiSportsVolleyLeagueId = superleague.league.id;
  return apiSportsVolleyLeagueId;
}

// Map api-sports status to our internal status
function apiSportsStatusToInternal(short: string): "upcoming" | "live" | "finished" {
  if (["FT", "AW", "AOT", "P", "WO", "AB", "Canc", "Int"].includes(short)) return "finished";
  if (["NS", "TBD", "PST"].includes(short)) return "upcoming";
  if (/^S\d/.test(short) || short === "LIVE") return "live"; // S1, S2, S3...
  return "upcoming";
}

async function fetchApiSportsVolleyEvents(): Promise<unknown[]> {
  const leagueId = await getApiSportsVolleyLeagueId();
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 21);
  const to   = new Date(now); to.setDate(to.getDate() + 14);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr   = to.toISOString().slice(0, 10);

  const data = await apiSportsFetch(
    `/games?league=${leagueId}&season=${APISPORTS_VOLLEY_SEASON}&from=${fromStr}&to=${toStr}`,
  ) as {
    response?: Array<{
      id: number;
      date: string;
      status: { long: string; short: string; timer: string | null };
      teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
      scores: {
        home: { "set-1"?: number; "set-2"?: number; "set-3"?: number; "set-4"?: number; "set-5"?: number; total?: number | null };
        away: { "set-1"?: number; "set-2"?: number; "set-3"?: number; "set-4"?: number; "set-5"?: number; total?: number | null };
      };
    }>
  };

  return (data.response ?? []).map((g) => {
    const statusInternal = apiSportsStatusToInternal(g.status.short);
    const d = new Date(g.date);
    const homeSets = g.scores?.home?.total ?? null;
    const awaySets = g.scores?.away?.total ?? null;
    const isStarted = statusInternal !== "upcoming";

    // Determine current set label for live games
    let periodLabel: string | undefined;
    if (statusInternal === "live") {
      const setMatch = g.status.short.match(/^S(\d)/);
      if (setMatch) periodLabel = `${setMatch[1]}-я партия`;
      else if (g.status.short === "LIVE") periodLabel = "В игре";
    }

    return {
      idEvent: `apisports_volley_${g.id}`,
      strHomeTeam: translateTeam(g.teams.home.name),
      strAwayTeam: translateTeam(g.teams.away.name),
      strHomeTeamBadge: g.teams.home.logo || SOFASCORE_VOLLEY_BADGE,
      strAwayTeamBadge: g.teams.away.logo || SOFASCORE_VOLLEY_BADGE,
      intHomeScore: isStarted && homeSets !== null ? String(homeSets) : null,
      intAwayScore: isStarted && awaySets !== null ? String(awaySets) : null,
      dateEvent: d.toISOString().slice(0, 10),
      strTime: d.toISOString().slice(11, 16),
      strStatus: statusInternal,
      strVenue: null,
      _sport: "volleyball",
      _leagueName: "Pari Суперлига",
      _leagueBadge: SOFASCORE_VOLLEY_BADGE,
      _periodLabel: periodLabel,
      _source: "apisports",
    };
  });
}

type ApiSportsStandingEntry = {
  position: number;
  team: { id: number; name: string; logo: string };
  games: { played: number; win: { total: number }; lose: { total: number } };
  points: number;
};

async function fetchApiSportsVolleyStandings(): Promise<{
  entries: Array<{ rank: number; team: string; badge: string; gp: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }>;
  season: string; league: string;
} | null> {
  const leagueId = await getApiSportsVolleyLeagueId();
  const data = await apiSportsFetch(
    `/standings?league=${leagueId}&season=${APISPORTS_VOLLEY_SEASON}`,
  ) as {
    response?: Array<{
      league: {
        standings: ApiSportsStandingEntry[][];
      };
    }>
  };
  const resp = data.response ?? [];
  if (!resp.length) return null;

  // The standings come in group arrays — pick the largest (main group)
  const allGroups = resp[0]?.league?.standings ?? [];
  const mainGroup = allGroups.reduce<ApiSportsStandingEntry[] | null>(
    (best, g) => (!best || g.length > best.length ? g : best), null,
  );
  if (!mainGroup?.length) return null;

  const entries = mainGroup.map((r) => ({
    rank: r.position,
    team: translateTeam(r.team.name),
    badge: r.team.logo || SOFASCORE_VOLLEY_BADGE,
    gp:  r.games.played ?? 0,
    w:   r.games.win?.total ?? 0,
    d:   0,
    l:   r.games.lose?.total ?? 0,
    gf:  0,
    ga:  0,
    gd:  0,
    pts: r.points ?? 0,
  }));

  return { entries, season: `${APISPORTS_VOLLEY_SEASON}/${APISPORTS_VOLLEY_SEASON + 1 - 2000}`, league: "Pari Суперлига" };
}

async function fetchApiSportsVolleyPlayoffs(): Promise<{ rounds: { name: string; series: Array<{
  round: string; homeTeam: string; homeBadge: string; homeWins: number;
  awayTeam: string; awayBadge: string; awayWins: number;
  seriesLength: number; bracketPos: number; isDone: boolean; winnerTeam?: string;
}> }[] } | null> {
  const leagueId = await getApiSportsVolleyLeagueId();
  // Fetch all playoff games from the season (no date filter)
  const data = await apiSportsFetch(
    `/games?league=${leagueId}&season=${APISPORTS_VOLLEY_SEASON}&stage=Playoffs`,
  ) as { response?: Array<{
    id: number; date: string;
    status: { short: string };
    stage: string;
    teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
    scores: { home: { total?: number | null }; away: { total?: number | null } };
  }> };

  const games = data.response ?? [];
  if (!games.length) return null;

  // Build series map
  type PSeries = { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string }; homeW: number; awayW: number; stage: string; firstDate: number };
  const seriesMap = new Map<string, PSeries>();
  for (const g of games) {
    const h = g.teams.home; const a = g.teams.away;
    const [t1, t2] = h.id < a.id ? [h, a] : [a, h];
    const key = `${t1.id}|${t2.id}`;
    if (!seriesMap.has(key)) seriesMap.set(key, { home: h, away: a, homeW: 0, awayW: 0, stage: g.stage ?? "Playoff", firstDate: new Date(g.date).getTime() });
    const s = seriesMap.get(key)!;
    if (s.firstDate > new Date(g.date).getTime()) { s.firstDate = new Date(g.date).getTime(); s.home = h; s.away = a; }
    if (apiSportsStatusToInternal(g.status.short) === "finished") {
      const hSets = g.scores.home.total ?? 0;
      const aSets = g.scores.away.total ?? 0;
      if (hSets > aSets) s.homeW++; else if (aSets > hSets) s.awayW++;
    }
  }

  // Group by stage
  const stageMap = new Map<string, PSeries[]>();
  for (const s of seriesMap.values()) {
    if (!stageMap.has(s.stage)) stageMap.set(s.stage, []);
    stageMap.get(s.stage)!.push(s);
  }
  // Sort stages roughly
  const stageOrder = ["1/8", "Quarter", "Semi", "Final"];
  const rounds = Array.from(stageMap.entries())
    .sort(([a], [b]) => {
      const ai = stageOrder.findIndex(s => a.includes(s));
      const bi = stageOrder.findIndex(s => b.includes(s));
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .map(([stageName, seriesList]) => {
      seriesList.sort((a, b) => a.firstDate - b.firstDate);
      const WINS_NEEDED = /final/i.test(stageName) && !/quarter|semi|1\/4|1\/2/i.test(stageName) ? 4 : 3;
      const series = seriesList.map((s, si) => {
        const isDone = s.homeW >= WINS_NEEDED || s.awayW >= WINS_NEEDED;
        return {
          round: stageName,
          homeTeam: translateTeam(s.home.name),
          homeBadge: s.home.logo || SOFASCORE_VOLLEY_BADGE,
          homeWins: s.homeW,
          awayTeam: translateTeam(s.away.name),
          awayBadge: s.away.logo || SOFASCORE_VOLLEY_BADGE,
          awayWins: s.awayW,
          seriesLength: s.homeW + s.awayW,
          bracketPos: si,
          isDone,
          winnerTeam: isDone ? (s.homeW >= WINS_NEEDED ? translateTeam(s.home.name) : translateTeam(s.away.name)) : undefined,
        };
      });
      return { name: stageName, series };
    });

  return rounds.length ? { rounds } : null;
}

function basketballPeriodLabel(code: number, description: string): string | undefined {
  const d = (description ?? "").toLowerCase();
  if (code === 7  || d.includes("1st quarter")) return "1-я четверть";
  if (code === 27 || d.includes("2nd quarter")) return "2-я четверть";
  if (code === 8  || d.includes("halftime"))    return "Перерыв";
  if (code === 9  || d.includes("3rd quarter")) return "3-я четверть";
  if (code === 10 || d.includes("4th quarter")) return "4-я четверть";
  if (code === 11 || d.includes("overtime") || d.includes(" ot")) return "ОТ";
  if (d.includes("pause") || d.includes("break")) return "Перерыв";
  return undefined;
}

function volleyballSetLabel(code: number, description: string): string | undefined {
  const d = (description ?? "").toLowerCase();
  if (d.includes("1st set")) return "1-я партия";
  if (d.includes("2nd set")) return "2-я партия";
  if (d.includes("3rd set")) return "3-я партия";
  if (d.includes("4th set")) return "4-я партия";
  if (d.includes("5th set") || d.includes("golden set")) return "5-я партия";
  if (d.includes("pause") || d.includes("break")) return "Перерыв";
  if (code >= 6 && code <= 15) return `${code - 5}-я партия`;
  return undefined;
}

function mapSofascoreScheduledEvent(
  e: SofascoreEvent,
  sport: "basketball" | "volleyball",
  leagueName: string,
  leagueBadge: string,
  periodLabelFn: (code: number, description: string) => string | undefined,
): Record<string, unknown> {
  const statusType = (e.status?.type ?? "notstarted").toLowerCase();
  const statusMap: Record<string, string> = {
    notstarted: "upcoming",
    inprogress: "live",
    finished: "finished",
    ended: "finished",
    canceled: "finished",
    postponed: "finished",
  };
  const mappedStatus = statusMap[statusType] ?? "upcoming";
  const d = new Date(e.startTimestamp * 1000);
  const homeName = translateTeam(e.homeTeam.name);
  const awayName = translateTeam(e.awayTeam.name);

  const isStarted = mappedStatus !== "upcoming";
  const homeScoreStr = isStarted ? String(e.homeScore?.current ?? 0) : null;
  const awayScoreStr = isStarted ? String(e.awayScore?.current ?? 0) : null;

  const periodLabel = mappedStatus === "live"
    ? periodLabelFn(e.status.code, e.status.description)
    : undefined;

  return {
    idEvent: `sofascore_${e.id}`,
    strHomeTeam: homeName,
    strAwayTeam: awayName,
    strHomeTeamBadge: `https://api.sofascore.app/api/v1/team/${e.homeTeam.id}/image`,
    strAwayTeamBadge: `https://api.sofascore.app/api/v1/team/${e.awayTeam.id}/image`,
    intHomeScore: homeScoreStr,
    intAwayScore: awayScoreStr,
    dateEvent: d.toISOString().slice(0, 10),
    strTime: d.toISOString().slice(11, 16),
    strStatus: mappedStatus,
    strVenue: null,
    _sport: sport,
    _leagueName: leagueName,
    _leagueBadge: leagueBadge,
    _periodLabel: periodLabel,
    _source: "sofascore",
  };
}

async function fetchSofascoreScheduledSport(
  sportPath: string,
  tournamentId: number,
  sport: "basketball" | "volleyball",
  leagueName: string,
  leagueBadge: string,
  periodLabelFn: (code: number, description: string) => string | undefined,
): Promise<unknown[]> {
  const events: unknown[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const dates: { date: string; isPast: boolean }[] = [];

  // Wide window: 21 days back + 14 days forward to cover playoff gaps
  for (let i = -21; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    dates.push({ date: dateStr, isPast: dateStr < todayStr });
  }

  const tasks = dates.map(({ date, isPast }) => async () => {
    try {
      const url = `https://api.sofascore.app/api/v1/sport/${sportPath}/scheduled-events/${date}`;
      const ttl = isPast ? CACHE_TTL_HIST_MS : CACHE_TTL_MS;
      const data = await fetchWithCache(url, SOFASCORE_HEADERS, ttl) as { events?: SofascoreEvent[] };
      const filtered = (data.events ?? []).filter(
        (e) => e.tournament?.uniqueTournament?.id === tournamentId,
      );
      events.push(...filtered.map((e) => mapSofascoreScheduledEvent(e, sport, leagueName, leagueBadge, periodLabelFn)));
    } catch {
      // skip failed dates
    }
  });

  await pLimit(tasks, 3);
  return events;
}

const SPORTSDB_FINISHED = new Set([
  "Match Finished", "FT", "AP", "AET", "AOT", "Pen", "Post", "Full Time", "finished",
]);

// ── TheSportsDB fallback (used when Sofascore is IP-blocked) ─────────────────
async function fetchSportsDBFallback(
  leagueId: string,
  sport: "hockey" | "basketball" | "volleyball",
  leagueName: string,
  leagueBadge: string,
): Promise<unknown[]> {
  const seasons = ["2025-2026", "2024-2025", "2023-2024"];
  const allEvents: unknown[] = [];

  await Promise.all(seasons.map(async (season) => {
    try {
      const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(season)}`;
      const data = (await fetchWithCache(url, undefined, CACHE_TTL_HIST_MS)) as { events?: RawEvent[] };
      const events = data?.events ?? [];
      for (const e of events) {
        const loc = localizeEvent(e);
        const dateStr = (e.dateEvent as string) ?? "";
        const timeStr = (e.strTime as string | null) ?? null;
        const strStatus = (e.strStatus as string | null) ?? null;

        let strMappedStatus: string;
        if (strStatus && SPORTSDB_FINISHED.has(strStatus)) {
          strMappedStatus = "finished";
        } else {
          // infer from date
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const evDate = new Date(`${dateStr}T12:00:00`);
          evDate.setHours(0, 0, 0, 0);
          strMappedStatus = evDate <= today ? "finished" : "upcoming";
        }

        allEvents.push({
          ...loc,
          _sport: sport,
          _leagueName: leagueName,
          _leagueBadge: leagueBadge,
          strStatus: strMappedStatus,
          strTime: timeStr,
          _source: "sportsdb_fallback",
        });
      }
    } catch { /* skip */ }
  }));

  // Sort: upcoming first (nearest), then recent past (most recent first).
  // This prevents a future season's schedule from burying the current season.
  const now = Date.now();
  const typed = allEvents as Array<{ dateEvent: string; strTime?: string | null }>;
  const withMs = typed.map((e) => {
    const ts = new Date(`${e.dateEvent}T${e.strTime ?? "12:00:00"}`).getTime();
    return { e, ts };
  });
  const upcoming = withMs.filter(x => x.ts >= now).sort((a, b) => a.ts - b.ts);
  const past     = withMs.filter(x => x.ts <  now).sort((a, b) => b.ts - a.ts);
  return [...upcoming.slice(0, 15), ...past.slice(0, 15)].map(x => x.e);
}

// GET /api/sports/all-matches
router.get("/sports/all-matches", async (req, res) => {
  try {
    const [rplBadge, hockeyEventsRaw, basketballEventsRaw, apiSportsVolleyRaw, sofascoreVolleyRaw] = await Promise.all([
      fetchLeagueBadge(RPL_SPORTSDB_ID),
      fetchSofascoreHockey().catch(() => [] as unknown[]),
      fetchSofascoreScheduledSport(
        "basketball", VTB_TOURNAMENT_ID, "basketball", "Единая лига ВТБ",
        SOFASCORE_VTB_BADGE, basketballPeriodLabel,
      ).catch(() => [] as unknown[]),
      // api-sports volleyball (primary) — requires valid APISPORTS_KEY
      fetchApiSportsVolleyEvents().catch(() => [] as unknown[]),
      // Sofascore volleyball (secondary, for when api-sports key is missing/invalid)
      fetchSofascoreScheduledSport(
        "volleyball", VOLLEY_TOURNAMENT_ID, "volleyball", "Pari Суперлига",
        SOFASCORE_VOLLEY_BADGE, volleyballSetLabel,
      ).catch(() => [] as unknown[]),
    ]);

    // Sofascore fallbacks via TheSportsDB when Sofascore is IP-blocked (dev env)
    const [hockeyEvents, basketballEvents] = await Promise.all([
      hockeyEventsRaw.length > 0
        ? Promise.resolve(hockeyEventsRaw)
        : fetchSportsDBFallback("4920", "hockey", "КХЛ", proxyImg(SOFASCORE_KHL_BADGE)).catch(() => [] as unknown[]),
      basketballEventsRaw.length > 0
        ? Promise.resolve(basketballEventsRaw)
        : fetchSportsDBFallback("4476", "basketball", "Единая лига ВТБ", SOFASCORE_VTB_BADGE).catch(() => [] as unknown[]),
    ]);

    // Volleyball: prefer api-sports, then Sofascore, then TheSportsDB fallback
    const volleyballEvents = apiSportsVolleyRaw.length > 0
      ? apiSportsVolleyRaw
      : sofascoreVolleyRaw.length > 0
        ? sofascoreVolleyRaw
        : await fetchSportsDBFallback("4545", "volleyball", "Pari Суперлига", SOFASCORE_VOLLEY_BADGE).catch(() => [] as unknown[]);

    // Football: sstats.net primary, ESPN fallback
    let footballEvents: unknown[] = [];
    try {
      footballEvents = await fetchSstatsFootballEvents(rplBadge);
    } catch {
      footballEvents = await fetchEspnFootball(rplBadge).catch(() => [] as unknown[]);
    }
    if (footballEvents.length === 0) {
      footballEvents = await fetchEspnFootball(rplBadge).catch(() => [] as unknown[]);
    }

    const allEvents = [...footballEvents, ...hockeyEvents, ...basketballEvents, ...volleyballEvents];

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

// GET /api/sports/football-season — all football matches for the full season (high limits, 30-min cache)
router.get("/sports/football-season", async (req, res) => {
  try {
    const rplBadge = await fetchLeagueBadge(RPL_SPORTSDB_ID);
    const events = await fetchSstatsFootballSeasonEvents(rplBadge);

    // Deduplicate by idEvent
    const seen = new Set<string>();
    const unique = events.filter((e) => {
      const id = (e as { idEvent: string }).idEvent;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json({ events: unique });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch football season");
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

// Demo KHL playoff bracket used in dev when Sofascore is unreachable
function sfBadge(teamId: number) {
  return `/api/sports/proxy-image?url=${encodeURIComponent(`https://api.sofascore.app/api/v1/team/${teamId}/image`)}`;
}
const B = {
  tska:     sfBadge(3946),
  sever:    sfBadge(3943),
  avangard: sfBadge(3945),
  traktor:  sfBadge(6333),
  ska:      sfBadge(3941),
  dinamo_mn:sfBadge(24983),
  metallurg:sfBadge(3938),
  torpedo:  sfBadge(7857),
  akbars:   sfBadge(3947),
  salavat:  sfBadge(3944),
  loko:     sfBadge(3948),
  neftekhim:sfBadge(3951),
  dinamo_m: sfBadge(43854),
  amur:     sfBadge(3950),
  barys:    sfBadge(24985),
  kunlun:   sfBadge(136234),
};
const KHL_DEMO_BRACKET = [
  {
    name: "1/8 финала",
    series: [
      { homeTeam: "ЦСКА", homeBadge: B.tska, awayTeam: "Северсталь", awayBadge: B.sever, homeWins: 3, awayWins: 0, isDone: true, winnerTeam: "ЦСКА", bracketPos: 0 },
      { homeTeam: "Авангард", homeBadge: B.avangard, awayTeam: "Трактор", awayBadge: B.traktor, homeWins: 3, awayWins: 1, isDone: true, winnerTeam: "Авангард", bracketPos: 1 },
      { homeTeam: "СКА", homeBadge: B.ska, awayTeam: "Динамо Мн", awayBadge: B.dinamo_mn, homeWins: 3, awayWins: 0, isDone: true, winnerTeam: "СКА", bracketPos: 2 },
      { homeTeam: "Металлург", homeBadge: B.metallurg, awayTeam: "Торпедо", awayBadge: B.torpedo, homeWins: 3, awayWins: 2, isDone: true, winnerTeam: "Металлург", bracketPos: 3 },
      { homeTeam: "Ак Барс", homeBadge: B.akbars, awayTeam: "Салават Юл", awayBadge: B.salavat, homeWins: 3, awayWins: 1, isDone: true, winnerTeam: "Ак Барс", bracketPos: 4 },
      { homeTeam: "Локомотив", homeBadge: B.loko, awayTeam: "Нефтехимик", awayBadge: B.neftekhim, homeWins: 3, awayWins: 2, isDone: true, winnerTeam: "Локомотив", bracketPos: 5 },
      { homeTeam: "Динамо М", homeBadge: B.dinamo_m, awayTeam: "Амур", awayBadge: B.amur, homeWins: 3, awayWins: 0, isDone: true, winnerTeam: "Динамо М", bracketPos: 6 },
      { homeTeam: "Барыс", homeBadge: B.barys, awayTeam: "Куньлунь", awayBadge: B.kunlun, homeWins: 3, awayWins: 1, isDone: true, winnerTeam: "Барыс", bracketPos: 7 },
    ],
  },
  {
    name: "1/4 финала",
    series: [
      { homeTeam: "ЦСКА", homeBadge: B.tska, awayTeam: "Авангард", awayBadge: B.avangard, homeWins: 3, awayWins: 2, isDone: true, winnerTeam: "ЦСКА", bracketPos: 0 },
      { homeTeam: "СКА", homeBadge: B.ska, awayTeam: "Металлург", awayBadge: B.metallurg, homeWins: 3, awayWins: 1, isDone: true, winnerTeam: "СКА", bracketPos: 1 },
      { homeTeam: "Ак Барс", homeBadge: B.akbars, awayTeam: "Локомотив", awayBadge: B.loko, homeWins: 3, awayWins: 3, isDone: true, winnerTeam: "Ак Барс", bracketPos: 2 },
      { homeTeam: "Динамо М", homeBadge: B.dinamo_m, awayTeam: "Барыс", awayBadge: B.barys, homeWins: 4, awayWins: 1, isDone: true, winnerTeam: "Динамо М", bracketPos: 3 },
    ],
  },
  {
    name: "1/2 финала",
    series: [
      { homeTeam: "ЦСКА", homeBadge: B.tska, awayTeam: "СКА", awayBadge: B.ska, homeWins: 4, awayWins: 2, isDone: true, winnerTeam: "ЦСКА", bracketPos: 0 },
      { homeTeam: "Ак Барс", homeBadge: B.akbars, awayTeam: "Динамо М", awayBadge: B.dinamo_m, homeWins: 3, awayWins: 4, isDone: true, winnerTeam: "Динамо М", bracketPos: 1 },
    ],
  },
  {
    name: "Кубок Гагарина",
    series: [
      { homeTeam: "ЦСКА", homeBadge: B.tska, awayTeam: "Динамо М", awayBadge: B.dinamo_m, homeWins: 2, awayWins: 1, isDone: false, winnerTeam: null, bracketPos: 0 },
    ],
  },
];

// GET /api/sports/standings?sport=football
type StandingEntry = {
  rank: number; team: string; badge: string;
  gp: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number;
  form?: string; description?: string;
};

// Leagues with no table (cups / playoff stages)
const NO_STANDINGS_LEAGUES = new Set(["FONBET Кубок России", "OLIMPBET Суперкубок России", "Вторая Лига А. Плей-офф"]);

router.get("/sports/standings", async (req, res) => {
  const { sport = "football", league } = req.query as { sport?: string; league?: string };
  try {
    // ── League-specific standings (football only) ──────────────────────────
    if (league) {
      if (NO_STANDINGS_LEAGUES.has(league)) {
        return res.json({ league, season: null, entries: [], message: "Турнирная таблица недоступна для этой лиги" });
      }
      const cfg = (RUSSIAN_FOOTBALL_LEAGUES as ReadonlyArray<{ id: number; name: string }>).find((l) => l.name === league);
      if (!cfg) {
        return res.json({ league, season: null, entries: [], message: "Лига не найдена" });
      }
      const result = await fetchSstatsLeagueStandings(cfg.id, league);
      if (result.entries.length === 0) {
        return res.json({ league, season: null, entries: [], message: "Данные таблицы пока недоступны" });
      }
      return res.json(result);
    }

    if (sport === "football") {
      // Primary: sstats.net; fallback: ESPN
      try {
        const result = await fetchSstatsFootballStandings();
        if (result.entries.length > 0) return res.json(result);
      } catch { /* fall through to ESPN */ }

      const url = "https://site.api.espn.com/apis/v2/sports/soccer/rus.1/standings";
      const data = (await fetchWithCache(url, { "User-Agent": ESPN_UA })) as {
        children?: { name?: string; standings?: { entries?: Array<{
          team: { displayName: string; logos?: Array<{ href: string }> };
          stats: Array<{ name: string; value: number }>;
        }> } }[];
      };
      const child = data?.children?.[0];
      const entries: StandingEntry[] = (child?.standings?.entries ?? []).map((e) => {
        const s: Record<string, number> = {};
        e.stats.forEach((st) => { s[st.name] = st.value; });
        return {
          rank: s.rank ?? 0,
          team: translateTeam(e.team.displayName),
          badge: e.team.logos?.[0]?.href ?? "",
          gp: s.gamesPlayed ?? 0,
          w: s.wins ?? 0,
          d: s.ties ?? 0,
          l: s.losses ?? 0,
          gf: s.pointsFor ?? 0,
          ga: s.pointsAgainst ?? 0,
          gd: s.pointDifferential ?? 0,
          pts: s.points ?? 0,
        };
      });
      entries.sort((a, b) => a.rank - b.rank);
      const rawSeason = child?.name ?? "";
      const seasonMatch = rawSeason.match(/(\d{4}-\d{2,4})/);
      const season = seasonMatch ? seasonMatch[1] : rawSeason;
      return res.json({ league: "Российская Премьер-лига", season, entries });
    }
    if (sport === "hockey") {
      const [standingsResult, playoffsResult] = await Promise.allSettled([
        fetchKhlConferenceStandings(),
        fetchKhlPlayoffsFromEvents(),
      ]);
      const standings = standingsResult.status === "fulfilled" ? standingsResult.value : null;
      const playoffs = playoffsResult.status === "fulfilled" ? playoffsResult.value : null;

      // If fresh standings data came in, persist to file for future restarts
      if (standings && standings.conferences.length > 0) {
        saveKhlPersistentCache(khlSeasonIdCache?.id ?? 0, standings.season, standings.conferences);
      }

      // Fall back to file cache when Sofascore is unreachable
      let conferences = standings?.conferences ?? [];
      let season = standings?.season ?? playoffs?.season ?? null;
      if (conferences.length === 0) {
        const cached = loadKhlPersistentCache();
        if (cached) {
          conferences = cached.conferences;
          season = season ?? cached.seasonYear;
          req.log.info({ season: cached.seasonYear, teams: cached.conferences.reduce((n, c) => n + c.rows.length, 0) }, "КХЛ standings: using file cache");
        }
      }

      const livePlayoffs = playoffs?.rounds ?? [];
      // Use demo bracket in dev when Sofascore is unreachable (so bracket UI is visible)
      const playoffsOut = livePlayoffs.length > 0 ? livePlayoffs : KHL_DEMO_BRACKET;
      return res.json({
        league: "КХЛ",
        season,
        entries: [],
        conferences,
        playoffs: playoffsOut,
      });
    }
    if (sport === "basketball") {
      const result = await fetchSofascoreLeagueStandings(
        VTB_TOURNAMENT_ID, VTB_FALLBACK_SEASONS, "Единая лига ВТБ",
      );
      if (result) {
        return res.json({ league: result.league, season: result.season, entries: result.entries });
      }
      return res.json({
        league: "Единая лига ВТБ", season: "25/26", entries: [],
        message: "Идут плей-офф — турнирная таблица временно недоступна",
      });
    }
    if (sport === "volleyball") {
      // 1. Try api-sports.ru (primary — most complete data)
      try {
        const apiResult = await fetchApiSportsVolleyStandings();
        if (apiResult?.entries?.length) {
          // Also try to fetch playoff bracket
          const playoffResult = await fetchApiSportsVolleyPlayoffs().catch(() => null);
          const playoffsOut = playoffResult?.rounds ?? [];
          return res.json({
            league: apiResult.league, season: apiResult.season,
            entries: apiResult.entries, playoffs: playoffsOut,
          });
        }
      } catch { /* fall through */ }

      // 2. Try Sofascore (secondary)
      const sofascoreResult = await fetchSofascoreLeagueStandings(
        VOLLEY_TOURNAMENT_ID, VOLLEY_FALLBACK_SEASONS, "Pari Суперлига",
      );
      if (sofascoreResult) {
        return res.json({ league: sofascoreResult.league, season: sofascoreResult.season, entries: sofascoreResult.entries });
      }

      // 3. Fallback message — playoffs are on, no standings available
      return res.json({
        league: "Pari Суперлига", season: "25/26", entries: [],
        message: "Идут плей-офф — турнирная таблица временно недоступна",
      });
    }
    return res.json({ league: null, season: null, entries: [] });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch standings");
    res.status(502).json({ error: "Failed to fetch standings" });
    return;
  }
});

// GET /api/sports/match-events?flashId=xxx
router.get("/sports/match-events", async (req, res) => {
  const { flashId } = req.query as { flashId?: string };
  if (!flashId || flashId.length !== 8) { res.status(400).json({ error: "Invalid flashId" }); return; }
  try {
    const gamesUrl = `${SSTATS_BASE}/Games/${flashId}?${sstatsQs("")}`;
    const lsUrl    = `${SSTATS_BASE}/Ls/GameInfo?Id=${flashId}&${sstatsQs("")}`;

    const [gamesResp, lsResp] = await Promise.all([
      fetch(gamesUrl.replace("?&", "?").replace("&&", "&"), { headers: SSTATS_HEADERS, signal: AbortSignal.timeout(8000) }),
      fetch(lsUrl.replace("?&", "?").replace("&&", "&"),    { headers: SSTATS_HEADERS, signal: AbortSignal.timeout(8000) }),
    ]);

    if (!gamesResp.ok) { res.status(gamesResp.status).json({ error: "sstats error" }); return; }
    const j = await gamesResp.json() as {
      status: string;
      data?: {
        game?: { homeTeam?: { id: number }; awayTeam?: { id: number } };
        events?: Array<{
          id: number;
          teamId: number;
          elapsed: number;
          extra: number | null;
          type: number;
          name: string;
          player?: { id: number; name: string } | null;
          assistPlayer?: { id: number; name: string } | null;
        }>;
      };
    };
    if (j.status !== "OK" || !j.data) { res.json({ events: [] }); return; }

    // Ls action type constants
    const LS_YELLOW = 1, LS_GOAL = 3, LS_PENALTY_AWARD = 5, LS_SUB_OUT = 6,
          LS_SUB_IN = 7, LS_ASSIST = 8, LS_PENALTY_GOAL = 10, LS_PENALTY_MISS = 11;

    // Build Ls index: queues per (minute:side:lsType) → [{slug, displayName}]
    type LsPlayer = { slug: string; displayName: string };
    const lsQueues: Record<string, LsPlayer[]> = {};
    // Also track missed-penalty events for synthetic insertion
    const lsMissedPens: Array<{ minute: number; side: "home" | "away"; player: LsPlayer }> = [];

    const resolveSlug = (slug: string, abbrev: string | undefined): string => {
      const id = PLAYER_SLUG_TO_ID[slug];
      if (id && PLAYER_RU_NAMES[id]) return PLAYER_RU_NAMES[id];
      // Fallback: format slug nicely – slug is "lastname-firstname"
      if (abbrev) return abbrev; // e.g. "Morozov E."
      return slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
    };

    const homeTeamId = j.data.game?.homeTeam?.id;
    const awayTeamId = j.data.game?.awayTeam?.id;

    if (lsResp.ok) {
      const lsJ = await lsResp.json() as {
        data?: {
          events?: Array<{
            time: number;
            injuryTime?: number;
            team: number; // 1=home, 2=away
            actions?: Array<{ actionType: number; playerId?: string; playerName?: string }>;
          }>;
        };
      };

      // We need to know which team is home/away in Ls (team=1 or team=2)
      // Ls team 1 = home, team 2 = away (by convention)
      const lsSide = (team: number): "home" | "away" => team === 1 ? "home" : "away";

      for (const lsEv of lsJ.data?.events ?? []) {
        const side = lsSide(lsEv.team);
        for (const a of lsEv.actions ?? []) {
          const rawSlug = a.playerId?.split("/")?.[0] ?? "";
          if (!rawSlug) continue;
          const player: LsPlayer = { slug: rawSlug, displayName: resolveSlug(rawSlug, a.playerName) };

          if (a.actionType === LS_PENALTY_MISS) {
            lsMissedPens.push({ minute: lsEv.time, side, player });
          } else {
            // Map Ls type → Games type for queue keying
            const gameType =
              a.actionType === LS_YELLOW          ? "yellow" :
              a.actionType === LS_GOAL            ? "goal" :
              a.actionType === LS_PENALTY_GOAL    ? "penalty" :
              a.actionType === LS_SUB_IN          ? "sub_in" :
              a.actionType === LS_SUB_OUT         ? "sub_out" :
              a.actionType === LS_ASSIST          ? "assist" : null;
            if (gameType) {
              const key = `${lsEv.time}:${side}:${gameType}`;
              (lsQueues[key] ??= []).push(player);
            }
          }
        }
      }
    }

    const popLs = (minute: number, side: "home" | "away", type: string): string | null => {
      const key = `${minute}:${side}:${type}`;
      const q = lsQueues[key];
      if (q && q.length > 0) return q.shift()!.displayName;
      return null;
    };

    const ruName = (p: { id: number; name: string } | null | undefined): string | null => {
      if (!p) return null;
      return PLAYER_RU_NAMES[p.id] ?? p.name;
    };

    const TYPE_MAP: Record<number, string> = { 1: "goal", 2: "yellow", 3: "sub", 4: "red", 5: "red" };
    const GOAL_SUBTYPES: Record<string, string> = {
      "Normal Goal": "goal",
      "Penalty": "penalty",
      "Own Goal": "own",
      "Missed Penalty": "missed",
    };

    const gamesEvents = j.data.events ?? [];
    // Track which missed-penalty minutes already exist in Games
    const gamesMissedMinutes = new Set(
      gamesEvents
        .filter((e) => e.type === 1 && e.name === "Missed Penalty")
        .map((e) => e.elapsed)
    );

    const events = gamesEvents.map((e) => {
      const side = e.teamId === homeTeamId ? "home" : "away";
      const subtype = e.type === 1 ? (GOAL_SUBTYPES[e.name] ?? "goal") : undefined;

      // Resolve player name: prefer sstats ID lookup, fall back to Ls queue
      let playerName: string | null = ruName(e.player);
      if (!playerName) {
        if (e.type === 2) playerName = popLs(e.elapsed, side, "yellow");
        else if (e.type === 1 && subtype === "goal")    playerName = popLs(e.elapsed, side, "goal");
        else if (e.type === 1 && subtype === "penalty") playerName = popLs(e.elapsed, side, "penalty");
        else if (e.type === 1 && subtype === "missed")  {
          const mp = lsMissedPens.find((m) => m.minute === e.elapsed && m.side === side);
          playerName = mp?.player.displayName ?? null;
        }
        else if (e.type === 3) playerName = popLs(e.elapsed, side, "sub_in");
      }

      let assistName: string | null = null;
      let outPlayerName: string | null = null;
      if (e.type === 1 && subtype !== "missed") {
        assistName = ruName(e.assistPlayer) ?? popLs(e.elapsed, side, "assist");
      }
      if (e.type === 3) {
        outPlayerName = ruName(e.assistPlayer) ?? popLs(e.elapsed, side, "sub_out");
      }

      return {
        id: e.id,
        side,
        minute: e.elapsed,
        extra: e.extra ?? 0,
        type: TYPE_MAP[e.type] ?? "other",
        subtype,
        player: playerName,
        assist: assistName,
        outPlayer: outPlayerName,
      };
    });

    // Add synthetic missed-penalty events from Ls that are absent in Games
    let syntheticId = -1;
    for (const mp of lsMissedPens) {
      if (!gamesMissedMinutes.has(mp.minute)) {
        events.push({
          id: syntheticId--,
          side: mp.side,
          minute: mp.minute,
          extra: 0,
          type: "goal",
          subtype: "missed",
          player: mp.player.displayName,
          assist: null,
          outPlayer: null,
        });
      }
    }

    // Sort by minute
    events.sort((a, b) => a.minute - b.minute || a.extra - b.extra);

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sports/proxy-image?url=...
const WIKI_UA = "SportRussiaApp/1.0 (https://github.com/sports-russia; educational)";

router.get("/sports/proxy-image", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).end(); return; }
  try {
    const isSofascore = url.includes("api.sofascore.app");
    const isWiki = url.includes("wikimedia.org") || url.includes("wikipedia.org");
    const imgHeaders: Record<string, string> = isSofascore
      ? { "User-Agent": SOFASCORE_UA, "Referer": "https://www.sofascore.com/", "Accept": "image/png,image/*" }
      : { "User-Agent": isWiki ? WIKI_UA : ESPN_UA };
    const imgRes = await fetch(url, { headers: imgHeaders });
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

// GET /api/sports/logos/:file  — serve static league logos
router.get("/sports/logos/:file", (req, res) => {
  const file = path.basename(req.params.file);
  res.setHeader("Cache-Control", "public, max-age=604800");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(path.join(__dirname, "../public/logos", file), (err) => {
    if (err) res.status(404).end();
  });
});

export default router;
