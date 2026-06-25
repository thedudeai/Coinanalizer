import { loginConfigured } from "../lib/auth.js";
import { storeConfigured } from "../lib/store.js";

// Vercel serverless function: GET /api/health
// Liveness + config check (no secrets revealed) so deploys can be sanity-checked.
export default function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    configured: Boolean(process.env.ANTHROPIC_API_KEY), // Anthropic key present
    login: loginConfigured(),                            // password gate active
    collectionStore: storeConfigured(),                 // Redis/KV store connected
  });
}
