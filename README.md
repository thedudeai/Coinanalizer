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

> Photos are downscaled in the browser before upload (to ~1280px JPEG) so requests stay well
> under Vercel's serverless body limit and image-token costs stay low.

## Project structure

```
coin-analyzer/
├── api/                  ← Vercel serverless functions
│   ├── analyze.js        ← POST /api/analyze  (Claude coin identification)
│   ├── ebay/sold.js      ← GET  /api/ebay/sold (eBay sold-listings scraper)
│   └── health.js         ← GET  /api/health   (liveness / config check)
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

| Variable            | Where                          | Purpose                                  |
| ------------------- | ------------------------------ | ---------------------------------------- |
| `ANTHROPIC_API_KEY` | Vercel env vars / `.env.local` | Authenticates the coin-identification call |

## Notes & troubleshooting

- **"Server is not configured with an API key"** — set `ANTHROPIC_API_KEY` in your Vercel
  project (or `.env.local` for `vercel dev`) and redeploy.
- **eBay returns 0 results** — broaden the search (e.g. just coin name + year, drop the grade).
- **eBay fetch fails** — eBay occasionally rate-limits/blocks scraping from cloud IPs; wait a
  minute and retry, or edit the query.
- The collection log lives in browser memory for the session (no database) — export to CSV to keep it.
