# Coin Collection Analyzer

AI-powered coin identification + live eBay sold price data + collection management.
Built as a **Vite + React** single-page app with **Vercel serverless functions** for the
backend — one-click deployable to Vercel.

## Features

- **Analyze** — upload or snap a coin photo; an AI numismatist (Claude) identifies it and
  returns composition, mint mark, grade estimate, a value range, an inspection checklist,
  red flags, pro tips, error varieties to check, and a grading recommendation.
- **Live eBay prices** — pull real *sold* listings for the identified coin (median, average,
  low/high, a price-distribution histogram, and recent sold titles). The AI-generated eBay
  search query is editable before fetching.
- **Collection Log** — save coins, track status (Unchecked → Checked → Sent for Grading → Sold),
  edit notes, export to CSV, and print.
- **Summary** — collection stats, status breakdown, top coins by value, and grading flags.
- **Optional password login** — gate the whole app behind a shared password (set two
  env vars to enable it). The login also protects the `/api/*` endpoints so nobody can
  use your Anthropic API key by calling them directly.
- **Optional server-side collection** — persist the saved coins to a Redis/KV store so
  they survive across devices and sessions (falls back to per-browser localStorage when
  no store is configured).

> Photos are downscaled in the browser before upload (to ~1280px JPEG) so requests stay well
> under Vercel's serverless body limit and image-token costs stay low.

## Project structure

```
coin-analyzer/
├── api/                  ← Vercel serverless functions
│   ├── analyze.js        ← POST /api/analyze     (Claude coin identification)
│   ├── ebay/sold.js      ← GET  /api/ebay/sold   (eBay sold-listings scraper)
│   ├── login.js          ← POST /api/login       (password -> session cookie)
│   ├── logout.js         ← POST /api/logout
│   ├── me.js             ← GET  /api/me          (auth state)
│   ├── collection.js     ← GET/PUT /api/collection (server-side saved coins)
│   └── health.js         ← GET  /api/health      (liveness / config check)
├── lib/                  ← shared helpers used by the functions (not bundled into the SPA)
│   ├── auth.js           ← HMAC-signed session cookie
│   └── store.js          ← Upstash Redis collection store
├── src/
│   ├── App.jsx           ← Full UI (Analyze / Log / Summary tabs)
│   └── main.jsx
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Deploy to Vercel

### Option A — Vercel dashboard (recommended)

1. Push this repo to GitHub.
2. In Vercel, **Add New… → Project** and import the repo. Vercel auto-detects Vite — the
   build settings in `vercel.json` are already correct (build `vite build`, output `dist`).
3. Under **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key (get one at https://console.anthropic.com).
4. Click **Deploy**. The frontend and the `/api/*` serverless functions deploy together on
   one domain.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel            # first run links/creates the project
vercel env add ANTHROPIC_API_KEY   # paste your key
vercel --prod     # production deploy
```

## Local development

The frontend calls `/api/*`, which are serverless functions. Use the Vercel CLI so both the
Vite dev server and the functions run together on one port:

```bash
npm install
cp .env.example .env.local      # then edit .env.local and set ANTHROPIC_API_KEY
vercel dev                      # serves app + /api on http://localhost:3000
```

> Plain `npm run dev` runs only the Vite frontend — the `/api/*` routes won't be available,
> so `vercel dev` is the way to exercise the full app locally.

## Configuration

| Variable                                  | Required | Purpose                                                            |
| ----------------------------------------- | -------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                       | Yes      | Authenticates the coin-identification call                        |
| `APP_PASSWORD`                            | No       | Shared login password. Set with `AUTH_SECRET` to enable the gate. |
| `AUTH_SECRET`                             | No       | Secret that signs the session cookie (`openssl rand -hex 32`).    |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN`   | No       | Redis/KV store for server-side collection persistence. The Vercel |
| (or `UPSTASH_REDIS_REST_URL` / `_TOKEN`)  |          | Redis/Upstash integration injects these automatically.            |

### Enabling login

1. Pick a password and generate a signing secret: `openssl rand -hex 32`.
2. In Vercel → **Settings → Environment Variables**, add `APP_PASSWORD` and `AUTH_SECRET`
   (Production + Preview + Development).
3. Redeploy. The app now shows a login screen and the `/api/*` endpoints require the session.

> Set **both** vars or neither. With neither set, the app runs open (no login) — so it never
> locks you out before you've configured it.

### Enabling cross-device collection persistence

1. In Vercel → **Storage**, create a **Redis** (Upstash) store and connect it to the project.
   The connection env vars are injected automatically.
2. Redeploy. Saved coins now persist server-side; until then they live in the browser's
   localStorage.

## Notes & troubleshooting

- **"Server is not configured with an API key"** — set `ANTHROPIC_API_KEY` in your Vercel
  project (or `.env.local` for `vercel dev`) and redeploy.
- **eBay returns 0 results** — broaden the search (e.g. just coin name + year, drop the grade).
- **eBay fetch fails** — eBay occasionally rate-limits/blocks scraping from cloud IPs; wait a
  minute and retry, or edit the query.
- **Photos are analyzed, then forgotten.** The full-resolution image is sent to the model for
  identification only and dropped from memory as soon as the result comes back. Coins are logged
  by their data and a stable **Coin ID** — no image is ever stored in the log — so the collection
  stays small and won't run a phone's browser out of memory no matter how many coins you scan.
- The collection log lives in browser memory for the session (persisted to localStorage, or
  server-side Redis when configured) — export to CSV to keep a permanent copy.
