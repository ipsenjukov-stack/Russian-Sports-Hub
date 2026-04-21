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
const WIKI_UA = "SportRussiaApp/1.0 (https://github.com/sports-russia; educational)";

router.get("/sports/proxy-image", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).end(); return; }
  try {
    const ua = url.includes("wikimedia.org") || url.includes("wikipedia.org") ? WIKI_UA : ESPN_UA;
    const imgRes = await fetch(url, { headers: { "User-Agent": ua } });
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
