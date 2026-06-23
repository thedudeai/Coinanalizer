import Anthropic from "@anthropic-ai/sdk";

// Vercel serverless function: POST /api/analyze
// Identifies a coin from a base64 image and returns a structured JSON report.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: "No image provided" });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: "Server is not configured with an API key" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: image },
            },
            {
              type: "text",
              text: `You are an expert numismatist. Analyze this coin photo and return ONLY a JSON object with no markdown, no explanation, just raw JSON.

{
  "name": "Full coin name (e.g. 1921 Morgan Silver Dollar)",
  "country": "Country of origin",
  "year": "Year or era",
  "denomination": "Face value",
  "composition": "Metal composition",
  "diameter_mm": number or null,
  "weight_g": number or null,
  "mint_mark": "Mint mark or null",
  "series": "Coin series name",
  "ebay_search_query": "Optimized eBay search string for this exact coin (e.g. '1921 Morgan Silver Dollar MS63')",
  "estimated_value": { "low": number, "high": number, "currency": "USD" },
  "confidence": "High | Medium | Low",
  "grade_estimate": "e.g. VF-30 or AU-55",
  "checklist": [
    { "item": "What to inspect", "impact": "High | Medium | Low", "detail": "Why it matters for this coin" }
  ],
  "red_flags": ["List of things that would hurt value"],
  "pro_tips": ["Expert tips specific to this coin type"],
  "grading_recommendation": "Should this be sent to PCGS/NGC? Why?",
  "error_varieties": ["Known error varieties to check for on this coin type"]
}

Identify it and give me the complete value checklist.`,
            },
          ],
        },
      ],
    });

    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: "Model did not return valid JSON. Please try again." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({ error: "Failed to analyze coin. Please try again with a clearer photo." });
  }
}
