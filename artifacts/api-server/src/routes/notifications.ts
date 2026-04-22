import { Router } from "express";
import { registerToken, unregisterToken, getAllRegistrations, DEFAULT_NOTIF_PREFS, NotifPrefs } from "../lib/notificationStore";

const router = Router();

router.post("/notifications/register", (req, res) => {
  const { token, favorites, notifPrefs } = req.body as {
    token?: string;
    favorites?: string[];
    notifPrefs?: Partial<NotifPrefs>;
  };
  if (!token || !Array.isArray(favorites)) {
    res.status(400).json({ error: "token and favorites required" });
    return;
  }
  const prefs: NotifPrefs = {
    ...DEFAULT_NOTIF_PREFS,
    ...(notifPrefs ?? {}),
    hoursBefore: Math.min(6, Math.max(1, Number(notifPrefs?.hoursBefore ?? DEFAULT_NOTIF_PREFS.hoursBefore))),
  };
  registerToken({ token, favorites, notifPrefs: prefs });
  res.json({ ok: true });
});

router.post("/notifications/unregister", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  unregisterToken(token);
  res.json({ ok: true });
});

router.get("/notifications/registrations", (_req, res) => {
  const regs = getAllRegistrations();
  res.json({
    count: regs.length,
    tokens: regs.map((r) => ({ token: r.token.slice(0, 20) + "…", favorites: r.favorites, registeredAt: r.registeredAt })),
  });
});

const KHL_TEST_PAIRS = [
  { home: "ЦСКА", away: "Динамо Москва", homeScore: 2, awayScore: 1 },
  { home: "СКА", away: "Авангард", homeScore: 1, awayScore: 1 },
  { home: "Металлург Магнитогорск", away: "Ак Барс", homeScore: 3, awayScore: 2 },
  { home: "Локомотив", away: "Торпедо Н. Новгород", homeScore: 0, awayScore: 1 },
  { home: "Динамо Москва", away: "Барыс", homeScore: 4, awayScore: 2 },
];

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

router.post("/notifications/test-goal", async (req, res) => {
  const { token: manualToken } = req.body as { token?: string };

  // Collect target tokens
  const regs = getAllRegistrations();
  const allTokens: string[] = regs.map((r) => r.token);
  if (manualToken) allTokens.push(manualToken);
  const uniqueTokens = [...new Set(allTokens)];

  if (!uniqueTokens.length) {
    res.status(400).json({ error: "Нет зарегистрированных токенов. Включите уведомления в приложении." });
    return;
  }

  // Pick random match
  const match = KHL_TEST_PAIRS[Math.floor(Math.random() * KHL_TEST_PAIRS.length)];
  const scorer = Math.random() < 0.5 ? match.home : match.away;
  const title = `🏒 Гол! ${scorer}`;
  const body = `${match.home} ${match.homeScore}:${match.awayScore} ${match.away} · КХЛ · Тест`;

  const messages = uniqueTokens.map((to) => ({ to, sound: "default", title, body }));

  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const data = await resp.json();
    res.json({ ok: true, sent: uniqueTokens.length, title, body, expo: data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
