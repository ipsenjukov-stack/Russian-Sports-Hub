import { Router } from "express";
import { registerToken, unregisterToken } from "../lib/notificationStore";

const router = Router();

router.post("/notifications/register", (req, res) => {
  const { token, favorites } = req.body as { token?: string; favorites?: string[] };
  if (!token || !Array.isArray(favorites)) {
    res.status(400).json({ error: "token and favorites required" });
    return;
  }
  registerToken({ token, favorites });
  res.json({ ok: true });
});

router.post("/notifications/unregister", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  unregisterToken(token);
  res.json({ ok: true });
});

export default router;
