import { signToken, sessionCookie, safeEqual, loginConfigured } from "../lib/auth.js";

// POST /api/login  { password } -> sets the session cookie on success.
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!loginConfigured()) {
    return res.status(500).json({ error: "Login is not configured. Set APP_PASSWORD and AUTH_SECRET." });
  }

  const { password } = req.body || {};
  if (!password || !safeEqual(password, process.env.APP_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  const token = signToken(process.env.AUTH_SECRET);
  res.setHeader("Set-Cookie", sessionCookie(token));
  return res.status(200).json({ ok: true });
}
