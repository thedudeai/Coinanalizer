import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to serverless functions under /api. In production on
// Vercel those are served from the same origin, so no proxy is needed. For
// local development run `vercel dev` (which serves both the Vite app and the
// /api functions on one port) — see README.
export default defineConfig({
  plugins: [react()],
});
