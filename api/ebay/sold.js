import { isAuthed } from "../../lib/auth.js";

// Vercel serverless function: GET /api/ebay/sold?q=<query>
// Fetches eBay SOLD listings for a coin query and returns parsed price data.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter q" });

  try {
    const encoded = encodeURIComponent(q);
    // eBay completed/sold listings URL (publicly accessible)
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encoded}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    const response = await fetch(url, {
      headers: {
        // A realistic browser User-Agent — eBay returns an empty/blocked page to
        // obvious bots, which is the usual cause of "0 results".
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) throw new Error(`eBay returned ${response.status}`);

    const html = await response.text();

    // Detect bot challenge / blocked responses so we can report something useful
    // instead of a misleading "no results".
    if (/Pardon Our Interruption|Checking your browser|captcha|unusual traffic/i.test(html)) {
      return res.status(200).json({
        query: q,
        count: 0,
        prices: [],
        avg: null, low: null, high: null, median: null,
        recent_sales: [],
        ebay_url: url,
        message: "eBay temporarily blocked the lookup (bot check). Open the eBay link below, or try again shortly.",
      });
    }

    // Parse sold prices + titles from eBay HTML. Tolerant patterns: skip
    // intervening tags up to the first dollar amount in each price cell.
    const prices = [];
    const titles = [];

    const priceRegex = /s-item__price[^$]*\$([\d,]+(?:\.\d{2})?)/g;
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
      const price = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(price) && price > 0) prices.push(price);
    }

    const titleRegex = /s-item__title["'][^>]*>(?:\s*<span[^>]*>)?\s*([^<]{3,}?)\s*</g;
    while ((match = titleRegex.exec(html)) !== null) {
      const title = match[1].trim();
      if (title && !/^shop on ebay$/i.test(title)) titles.push(title);
    }

    if (prices.length === 0) {
      return res.status(200).json({
        query: q,
        count: 0,
        prices: [],
        avg: null,
        low: null,
        high: null,
        median: null,
        recent_sales: [],
        ebay_url: url,
        message: "No sold listings found. Try a broader search term.",
      });
    }

    const sorted = [...prices].sort((a, b) => a - b);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    // Pair titles with prices for recent sales display
    const recent_sales = titles
      .slice(0, 8)
      .map((title, i) => ({ title, price: prices[i] ?? null }))
      .filter((s) => s.price !== null);

    return res.status(200).json({
      query: q,
      count: prices.length,
      prices: sorted,
      avg: Math.round(avg * 100) / 100,
      low: sorted[0],
      high: sorted[sorted.length - 1],
      median: Math.round(median * 100) / 100,
      recent_sales,
      ebay_url: url,
    });
  } catch (err) {
    console.error("eBay fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch eBay data. eBay may be temporarily unavailable." });
  }
}
