import crypto from "node:crypto";

// Stateless session auth using an HMAC-signed cookie. No database or external
// JWT library needed — the token is `base64url(payload).base64url(hmac)` and is
// verified against AUTH_SECRET on each request.
export const COOKIE_NAME = "ca_session";
const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

// Constant-time string compare (avoids password/token timing leaks).
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signToken(secret, ttlSeconds = DEFAULT_TTL) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64url(JSON.stringify({ exp }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// `Secure` is only sent on Vercel (HTTPS); omitted on local `vercel dev` (HTTP)
// so the cookie is still accepted during local development.
function cookieFlags() {
  const secure = process.env.VERCEL ? " Secure;" : "";
  return ` HttpOnly;${secure} SameSite=Lax; Path=/;`;
}

export function sessionCookie(token, ttlSeconds = DEFAULT_TTL) {
  return `${COOKIE_NAME}=${token};${cookieFlags()} Max-Age=${ttlSeconds}`;
}

export function clearedCookie() {
  return `${COOKIE_NAME}=;${cookieFlags()} Max-Age=0`;
}

// Login is only enforced once BOTH env vars are set. Before that the app runs
// open (matching the pre-login behavior), so deploying without configuring auth
// never locks anyone out.
export function loginConfigured() {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}

export function isAuthed(req) {
  if (!loginConfigured()) return true; // open mode until configured
  return verifyToken(process.env.AUTH_SECRET, parseCookies(req)[COOKIE_NAME]);
}
