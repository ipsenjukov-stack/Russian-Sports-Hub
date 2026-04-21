import { getTokensForTeams } from "./notificationStore";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface MatchSnapshot {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  status: string;
  startTimestamp: number;
  notifiedThreeHours: boolean;
  notifiedKickoff: boolean;
}

const snapshots = new Map<string, MatchSnapshot>();

async function sendPush(tokens: string[], title: string, body: string, data?: object) {
  if (!tokens.length) return;
  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data: data ?? {},
  }));
  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    logger.warn({ err }, "Push send failed");
  }
}

function scoreLabel(home: number | null, away: number | null) {
  return `${home ?? 0}:${away ?? 0}`;
}

async function pollOnce(apiBase: string) {
  try {
    const res = await fetch(`${apiBase}/api/sports/all-matches`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return;
    const body = (await res.json()) as { events?: Record<string, unknown>[] };
    const events = body.events ?? [];
    const now = Date.now();

    for (const ev of events) {
      const id = String(ev.idEvent ?? ev.id ?? "");
      const homeTeam = String(ev.strHomeTeam ?? "");
      const awayTeam = String(ev.strAwayTeam ?? "");
      const sport = String(ev._sport ?? "");
      const statusRaw = String(ev._espnState ?? ev.strStatus ?? "").toLowerCase();
      const status =
        statusRaw === "in" || statusRaw.includes("live") || statusRaw.includes("progress") || statusRaw.includes("halftime")
          ? "live"
          : statusRaw === "post" || statusRaw.includes("finished") || statusRaw.includes("complete")
          ? "finished"
          : statusRaw === "pre" || statusRaw.includes("not started") || statusRaw.includes("upcoming")
          ? "upcoming"
          : statusRaw;
      const homeScore = ev.intHomeScore != null && ev.intHomeScore !== "" ? parseInt(String(ev.intHomeScore)) : null;
      const awayScore = ev.intAwayScore != null && ev.intAwayScore !== "" ? parseInt(String(ev.intAwayScore)) : null;
      const period = String(ev._periodLabel ?? ev.strProgress ?? "").trim() || null;

      const dateStr = String(ev.dateEvent ?? "");
      const timeStr = String(ev.strTime ?? "00:00");
      const ts = dateStr ? new Date(`${dateStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}Z`).getTime() : 0;

      if (!id || !homeTeam || !awayTeam) continue;

      const teams = [homeTeam, awayTeam];
      const tokens = getTokensForTeams(teams);
      if (!tokens.length) continue;

      const prev = snapshots.get(id);

      const next: MatchSnapshot = {
        id, homeTeam, awayTeam, sport, homeScore, awayScore, period, status,
        startTimestamp: ts,
        notifiedThreeHours: prev?.notifiedThreeHours ?? false,
        notifiedKickoff: prev?.notifiedKickoff ?? false,
      };

      if (!prev) {
        snapshots.set(id, next);
        continue;
      }

      // ── 3-hour reminder ───────────────────────────────────────────────────
      if (!prev.notifiedThreeHours && ts > 0 && status === "upcoming") {
        const minsUntil = (ts - now) / 60_000;
        if (minsUntil <= 180 && minsUntil > 150) {
          await sendPush(tokens,
            "Матч через 3 часа",
            `${homeTeam} — ${awayTeam}`
          );
          next.notifiedThreeHours = true;
        }
      }

      // ── Kickoff ───────────────────────────────────────────────────────────
      if (!prev.notifiedKickoff && prev.status === "upcoming" && status === "live") {
        await sendPush(tokens,
          "Матч начался! 🏁",
          `${homeTeam} — ${awayTeam}`
        );
        next.notifiedKickoff = true;
      }

      // ── Score change (football / hockey) ─────────────────────────────────
      if (status === "live" && (sport === "football" || sport === "hockey")) {
        const prevTotal = (prev.homeScore ?? 0) + (prev.awayScore ?? 0);
        const currTotal = (homeScore ?? 0) + (awayScore ?? 0);
        if (currTotal > prevTotal && homeScore !== null && awayScore !== null) {
          const scorer = homeScore > (prev.homeScore ?? 0) ? homeTeam : awayTeam;
          const emoji = sport === "football" ? "⚽" : "🏒";
          await sendPush(tokens,
            `${emoji} Гол! ${scorer}`,
            `${homeTeam} ${scoreLabel(homeScore, awayScore)} ${awayTeam}`
          );
        }
      }

      // ── Period/set change (volleyball / basketball) ───────────────────────
      if (status === "live" && (sport === "volleyball" || sport === "basketball")) {
        if (prev.period && period && prev.period !== period && prev.homeScore !== null && prev.awayScore !== null) {
          const label = sport === "volleyball" ? "🏐 Партия завершена" : "🏀 Четверть завершена";
          const prevPeriod = prev.period;
          await sendPush(tokens,
            label,
            `${homeTeam} ${scoreLabel(prev.homeScore, prev.awayScore)} ${awayTeam} | ${prevPeriod}`
          );
        }
      }

      snapshots.set(id, next);
    }
  } catch (err) {
    logger.warn({ err }, "Notification scheduler poll error");
  }
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(apiBase: string) {
  if (interval) return;
  logger.info("Notification scheduler started");
  interval = setInterval(() => pollOnce(apiBase), 60_000);
  setTimeout(() => pollOnce(apiBase), 5_000);
}

export function stopScheduler() {
  if (interval) { clearInterval(interval); interval = null; }
}
