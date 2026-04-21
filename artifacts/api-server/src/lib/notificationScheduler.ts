import { getRegistrationsForTeams, TokenRegistration } from "./notificationStore";
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
  notifiedReminderTokens: Set<string>;
  notifiedKickoffTokens: Set<string>;
  notifiedEndTokens: Set<string>;
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

function goalScoreLabel(
  homeScore: number,
  awayScore: number,
  prevHome: number,
  prevAway: number
): string {
  const homeScored = homeScore > prevHome;
  const homeStr = homeScored ? `🟢${homeScore}` : `${homeScore}`;
  const awayStr = !homeScored ? `🟢${awayScore}` : `${awayScore}`;
  return `${homeStr}:${awayStr}`;
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

      const regs = getRegistrationsForTeams([homeTeam, awayTeam]);
      if (!regs.length) continue;

      const prev = snapshots.get(id);

      const next: MatchSnapshot = {
        id, homeTeam, awayTeam, sport, homeScore, awayScore, period, status,
        startTimestamp: ts,
        notifiedReminderTokens: new Set(prev?.notifiedReminderTokens ?? []),
        notifiedKickoffTokens: new Set(prev?.notifiedKickoffTokens ?? []),
        notifiedEndTokens: new Set(prev?.notifiedEndTokens ?? []),
      };

      if (!prev) {
        snapshots.set(id, next);
        continue;
      }

      // ── Pre-match reminder (per user's hoursBefore setting) ──────────────
      if (ts > 0 && status === "upcoming") {
        const reminderTokens: string[] = [];
        for (const reg of regs) {
          if (next.notifiedReminderTokens.has(reg.token)) continue;
          const windowMs = reg.notifPrefs.hoursBefore * 60 * 60 * 1000;
          const windowStart = windowMs + 15 * 60 * 1000;
          const windowEnd = windowMs - 15 * 60 * 1000;
          const msUntil = ts - now;
          if (msUntil <= windowStart && msUntil > windowEnd) {
            reminderTokens.push(reg.token);
            next.notifiedReminderTokens.add(reg.token);
          }
        }
        if (reminderTokens.length) {
          const h = regs.find(r => reminderTokens.includes(r.token))?.notifPrefs.hoursBefore ?? 3;
          const hLabel = h === 1 ? "1 час" : h < 5 ? `${h} часа` : `${h} часов`;
          await sendPush(reminderTokens, `Матч через ${hLabel} ⏰`, `${homeTeam} — ${awayTeam}`);
        }
      }

      // ── Kickoff (onMatchStart) ────────────────────────────────────────────
      if (prev.status === "upcoming" && status === "live") {
        const kickoffTokens = regs
          .filter((r) => r.notifPrefs.onMatchStart && !next.notifiedKickoffTokens.has(r.token))
          .map((r) => r.token);
        if (kickoffTokens.length) {
          await sendPush(kickoffTokens, "Матч начался! 🏁", `${homeTeam} — ${awayTeam}`);
          kickoffTokens.forEach((t) => next.notifiedKickoffTokens.add(t));
        }
      }

      // ── Score change / in-match events (onMatchEvent) ────────────────────
      if (status === "live") {
        const eventTokens = regs.filter((r) => r.notifPrefs.onMatchEvent).map((r) => r.token);

        if (eventTokens.length && (sport === "football" || sport === "hockey")) {
          const prevTotal = (prev.homeScore ?? 0) + (prev.awayScore ?? 0);
          const currTotal = (homeScore ?? 0) + (awayScore ?? 0);
          if (currTotal > prevTotal && homeScore !== null && awayScore !== null) {
            const scorer = homeScore > (prev.homeScore ?? 0) ? homeTeam : awayTeam;
            const emoji = sport === "football" ? "⚽" : "🏒";
            const score = goalScoreLabel(homeScore, awayScore, prev.homeScore ?? 0, prev.awayScore ?? 0);
            await sendPush(eventTokens,
              `${emoji} Гол! ${scorer}`,
              `${homeTeam} ${score} ${awayTeam}`
            );
          }
        }

        if (eventTokens.length && (sport === "volleyball" || sport === "basketball")) {
          if (prev.period && period && prev.period !== period && prev.homeScore !== null && prev.awayScore !== null) {
            const label = sport === "volleyball" ? "🏐 Партия завершена" : "🏀 Четверть завершена";
            await sendPush(eventTokens,
              label,
              `${homeTeam} ${scoreLabel(prev.homeScore, prev.awayScore)} ${awayTeam} | ${prev.period}`
            );
          }
        }
      }

      // ── Match finished (onMatchEnd) ───────────────────────────────────────
      if (prev.status === "live" && status === "finished") {
        const endTokens = regs
          .filter((r) => r.notifPrefs.onMatchEnd && !next.notifiedEndTokens.has(r.token))
          .map((r) => r.token);
        if (endTokens.length && homeScore !== null && awayScore !== null) {
          const sportEmoji = sport === "football" ? "⚽" : sport === "hockey" ? "🏒" : sport === "basketball" ? "🏀" : "🏐";
          await sendPush(endTokens,
            `${sportEmoji} Матч завершён`,
            `${homeTeam} ${scoreLabel(homeScore, awayScore)} ${awayTeam}`
          );
          endTokens.forEach((t) => next.notifiedEndTokens.add(t));
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
