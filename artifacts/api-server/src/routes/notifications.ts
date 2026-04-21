import { Router } from "express";
import { registerToken, unregisterToken, DEFAULT_NOTIF_PREFS, NotifPrefs } from "../lib/notificationStore";

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

export default router;
