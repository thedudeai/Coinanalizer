// Vercel serverless function: GET /api/health
// Lightweight liveness check. Reports whether the API key is configured
// (without revealing it) so deploys can be sanity-checked.
export default function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
