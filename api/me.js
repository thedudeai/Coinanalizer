import { isAuthed, loginConfigured } from "../lib/auth.js";

// GET /api/me -> reports auth state so the frontend can decide whether to show
// the login screen. `loginConfigured` is false until APP_PASSWORD + AUTH_SECRET
// are set, in which case the app runs open.
export default function handler(req, res) {
  return res.status(200).json({
    authed: isAuthed(req),
    loginConfigured: loginConfigured(),
  });
}
