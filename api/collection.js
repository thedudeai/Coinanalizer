import { isAuthed } from "../lib/auth.js";
import { getCollection, saveCollection } from "../lib/store.js";

// GET  /api/collection -> { items, persisted }   (items=null when no store configured)
// PUT  /api/collection  { items } -> { ok, persisted }
export default async function handler(req, res) {
  if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    try {
      const items = await getCollection();
      if (items === null) return res.status(200).json({ items: null, persisted: false });
      return res.status(200).json({ items, persisted: true });
    } catch (err) {
      console.error("collection GET error:", err);
      return res.status(200).json({ items: null, persisted: false });
    }
  }

  if (req.method === "PUT") {
    const { items } = req.body || {};
    if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array" });
    try {
      const ok = await saveCollection(items);
      return res.status(200).json({ ok, persisted: ok });
    } catch (err) {
      console.error("collection PUT error:", err);
      return res.status(500).json({ error: "Failed to save collection." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
