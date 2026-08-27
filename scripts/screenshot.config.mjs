// ─── screenshot.config.js ────────────────────────────────────────────────────
// Config for screenshot.js (screenshot-ui skill)
// Copy this file into your project's scripts/ directory and edit as needed.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // ── Targets ──────────────────────────────────────────────────────────────
  // Define one or more base URLs to screenshot.
  targets: {
    localhost: "http://localhost:4904",       // platform supervisor / Next.js
    // localhost: "http://localhost:5173",    // Vite/React default
    // localhost: "http://localhost:8000",    // FastAPI SPA default
    // vercel: "https://your-app.vercel.app", // deployed version
  },

  // Which target(s) to run by default: "localhost" | "vercel" | "both"
  run: "localhost",

  // ── Output ───────────────────────────────────────────────────────────────
  // Where to save screenshots (relative to project root)
  outputDir: "screenshots",

  // ── Viewport ─────────────────────────────────────────────────────────────
  viewport: { width: 1440, height: 900 },

  // ── Timing ───────────────────────────────────────────────────────────────
  // Extra wait after each page load (ms) — increase for slow apps or heavy JS
  extraDelayMs: 2000,

  // Set > 0 to open a browser window for manual login before screenshots begin
  loginDelaySeconds: 0,

  // ── Route discovery ───────────────────────────────────────────────────────
  // CSS selectors used to find nav links via DOM crawl.
  // Usually you don't need to change this.
  // Homepage only — companion cards would otherwise be crawled as chat routes.
  navSelectors: [],

  // ── Manual routes (fallback) ──────────────────────────────────────────────
  // Used when DOM discovery finds < 2 routes.
  // Can be a flat array (shared across all targets) or an object keyed by target name.
  //
  // Flat array example:
  // manualRoutes: [
  //   { path: "/",          name: "Home" },
  //   { path: "/dashboard", name: "Dashboard" },
  //   { path: "/settings",  name: "Settings" },
  // ],
  //
  // Per-target object example:
  // manualRoutes: {
  //   localhost: [
  //     { path: "/", name: "Home" },
  //     { path: "/about", name: "About" },
  //   ],
  //   vercel: [
  //     { path: "/", name: "Home" },
  //   ],
  // },
  manualRoutes: [
    { path: "/", name: "Home" },
  ],
};
