import { Redis } from "@upstash/redis";

// Server-side persistence for the (single, shared) coin collection. Backed by
// Upstash Redis — provision a Redis/KV store in the Vercel dashboard and the
// connection env vars are injected automatically. If no store is configured,
// getCollection() returns null and the frontend falls back to localStorage.
const KEY = "coin-collection";

let cached; // undefined = not initialized, null = not configured, else client
function getRedis() {
  if (cached !== undefined) return cached;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}

export function storeConfigured() {
  return getRedis() !== null;
}

export async function getCollection() {
  const redis = getRedis();
  if (!redis) return null;
  const data = await redis.get(KEY); // @upstash/redis auto-deserializes JSON
  return Array.isArray(data) ? data : [];
}

export async function saveCollection(items) {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(KEY, items);
  return true;
}
