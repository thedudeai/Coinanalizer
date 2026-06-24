import { clearedCookie } from "../lib/auth.js";

// POST /api/logout -> clears the session cookie.
export default function handler(_req, res) {
  res.setHeader("Set-Cookie", clearedCookie());
  return res.status(200).json({ ok: true });
}
