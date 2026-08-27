#!/usr/bin/env node
// ─── screenshot.js ────────────────────────────────────────────────────────────
// Skill: screenshot-ui
//
// Usage:
//   node scripts/screenshot.js                    → runs target(s) from config
//   node scripts/screenshot.js --target localhost
//   node scripts/screenshot.js --target vercel
//   node scripts/screenshot.js --target both
//   node scripts/screenshot.js --delay 15         → manual login window (seconds)
//
// Auto-discovers routes via DOM crawl; falls back to manualRoutes in config.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "./screenshot.config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const targetOverride  = getArg("--target");
const delayOverride   = getArg("--delay");
const loginDelay      = parseInt(delayOverride ?? config.loginDelaySeconds ?? 0, 10);
const extraDelay      = config.extraDelayMs ?? 1200;
const outputDir       = path.resolve(PROJECT_ROOT, config.outputDir ?? "screenshots");

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "_")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "home";
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function titleCase(slug) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Route discovery ───────────────────────────────────────────────────────────
const NAV_SELECTORS = config.navSelectors ?? [
  "nav a", "header a", '[role="navigation"] a',
  ".navbar a", ".nav-links a", ".sidebar a", ".menu a",
  '[class*="nav"] a', '[class*="menu"] a', '[class*="tab"] a',
];

const TAB_SELECTORS = [
  'button[role="tab"]',
  '[role="tablist"] button',
  '[class*="tab"] button',
];

async function discoverRoutes(page, baseUrl, targetKey) {
  console.log("  🔍 Discovering routes via DOM...");
  const found = new Map();
  const baseOrigin = new URL(baseUrl).origin;

  for (const selector of NAV_SELECTORS) {
    try {
      const links = await page.$$eval(selector, (els) =>
        els.map((el) => ({
          href: el.href ?? "",
          text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim(),
        }))
      );
      for (const { href, text } of links) {
        try {
          const url = new URL(href, baseUrl);
          if (url.origin === baseOrigin && url.pathname && !found.has(url.pathname)) {
            found.set(url.pathname, text || url.pathname);
          }
        } catch { /* skip invalid */ }
      }
    } catch { /* selector not found */ }
  }

  if (found.size > 1) {
    console.log(`  ✅ Found ${found.size} routes via nav links`);
    return Array.from(found.entries()).map(([p, name]) => ({
      path: p,
      name: slugify(name) || slugify(p),
      type: "route",
    }));
  }

  // Check for tab-based SPA (single page, multiple tabs)
  for (const sel of TAB_SELECTORS) {
    try {
      const tabs = await page.$$eval(sel, (els) =>
        els.map((el) => ({
          text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("data-tab") || "").trim(),
          index: els.indexOf(el),
        }))
      );
      if (tabs.length > 1) {
        console.log(`  ✅ Found ${tabs.length} tabs via tab selectors`);
        return tabs.map((t, i) => ({
          path: "/",
          name: slugify(t.text) || `tab-${i}`,
          type: "tab",
          tabIndex: i,
          tabSelector: sel,
        }));
      }
    } catch { /* selector not found */ }
  }

  // Fallback to manual routes
  const manual = Array.isArray(config.manualRoutes)
    ? config.manualRoutes
    : (config.manualRoutes?.[targetKey] ?? []);

  console.log(`  ⚠️  DOM found ${found.size} route(s) — using ${manual.length} manual routes for "${targetKey}"`);
  return manual.map((r) => ({ path: r.path, name: slugify(r.name || r.path), type: "route" }));
}

// ── Screenshot one target ─────────────────────────────────────────────────────
async function screenshotTarget(browser, label, baseUrl) {
  const targetDir = path.join(outputDir, label === "localhost" ? "" : label).replace(/\/$/, "");
  // If single target, put screenshots directly in outputDir
  const outDir = Object.keys(config.targets ?? {}).length > 1 ? targetDir : outputDir;
  ensureDir(outDir);

  console.log(`\n🌐 Target: ${label} → ${baseUrl}`);

  const context = await browser.newContext({ viewport: config.viewport ?? { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Suppress console noise from the app
  page.on("console", () => {});
  page.on("pageerror", () => {});

  console.log("  📄 Loading root page...");
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(extraDelay);

  if (loginDelay > 0) {
    console.log(`  🔐 Login window: ${loginDelay}s — complete login in the browser...`);
    await sleep(loginDelay * 1000);
    // Reload after login
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(extraDelay);
  }

  const routes = await discoverRoutes(page, baseUrl, label);

  // Always include root if not present (for route-based apps)
  const hasRoot = routes.some((r) => r.path === "/" || r.path === "");
  if (!hasRoot && routes[0]?.type === "route") {
    routes.unshift({ path: "/", name: "home", type: "route" });
  }

  // Deduplicate by path+name
  const seen = new Set();
  const unique = routes.filter((r) => {
    const key = `${r.path}::${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  📋 Capturing ${unique.length} pages: ${unique.map((r) => r.name).join(", ")}`);

  const results = [];

  for (const route of unique) {
    const file = path.join(outDir, `${route.name}.png`);
    process.stdout.write(`  📸 [${route.name}] `);

    try {
      if (route.type === "tab") {
        // Tab-based SPA: click the tab, wait, screenshot in place
        const tabEls = await page.$$(route.tabSelector);
        if (tabEls[route.tabIndex]) {
          await tabEls[route.tabIndex].click();
          await sleep(extraDelay);
          // Dismiss overlays/toasts
          await page.evaluate(() => {
            document.querySelectorAll('[role="alert"], .toast, .notification').forEach((el) => el.remove());
          });
          await page.screenshot({ path: file, fullPage: false });
          process.stdout.write(`✅  (tab ${route.tabIndex})\n`);
          results.push({ name: route.name, file: path.relative(PROJECT_ROOT, file), status: "ok" });
        } else {
          throw new Error(`Tab index ${route.tabIndex} not found`);
        }
      } else {
        // Route-based: navigate to URL
        const url = baseUrl.replace(/\/$/, "") + route.path;
        process.stdout.write(`${url} `);
        await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        await sleep(extraDelay);
        await page.evaluate(() => {
          document.querySelectorAll('[role="alert"], .toast, .notification').forEach((el) => el.remove());
        });
        await page.waitForFunction(
          () => {
            const imgs = [...document.querySelectorAll("img")];
            return imgs.length === 0 || imgs.every((img) => img.complete && img.naturalWidth > 0);
          },
          { timeout: 15000 }
        ).catch(() => {});
        await page.screenshot({ path: file, fullPage: true });
        process.stdout.write(`✅\n`);
        results.push({ name: route.name, file: path.relative(PROJECT_ROOT, file), status: "ok" });
      }
    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`);
      results.push({ name: route.name, file: path.relative(PROJECT_ROOT, file), status: "error", error: err.message });
      // Try partial screenshot
      try { await page.screenshot({ path: file, fullPage: false }); } catch {}
    }
  }

  await context.close();
  return results;
}

// ── README injection ───────────────────────────────────────────────────────────
function buildScreenshotMarkdown(results) {
  const ok = results.filter((r) => r.status === "ok");
  if (ok.length === 0) return "";

  const cols = ok.length >= 3 ? 3 : ok.length;
  const rows = [];

  // Header row
  const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const groups = chunk(ok, cols);

  const lines = ["## Screenshots", ""];

  for (const group of groups) {
    const header = "| " + group.map((r) => titleCase(r.name)).join(" | ") + " |";
    const sep    = "| " + group.map(() => "---").join(" | ") + " |";
    const images = "| " + group.map((r) => `![${titleCase(r.name)}](${r.file.replace(/\\/g, "/")})`).join(" | ") + " |";
    lines.push(header, sep, images, "");
  }

  return lines.join("\n");
}

function injectReadme(readmePath, markdownBlock) {
  if (!fs.existsSync(readmePath)) {
    console.log(`  ℹ️  README not found at ${readmePath} — skipping injection`);
    return;
  }

  let content = fs.readFileSync(readmePath, "utf8");
  const startMarker = "<!-- screenshots -->";
  const endMarker   = "<!-- /screenshots -->";

  const block = `${startMarker}\n${markdownBlock}\n${endMarker}`;

  if (content.includes(startMarker) && content.includes(endMarker)) {
    // Replace existing block
    const re = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "g");
    content = content.replace(re, block);
    console.log("  ✏️  Updated existing <!-- screenshots --> block in README");
  } else if (content.includes(startMarker)) {
    // Marker exists but no closing tag — append closing tag after marker
    content = content.replace(startMarker, block);
    console.log("  ✏️  Replaced <!-- screenshots --> marker in README");
  } else {
    // Append at end
    content = content.trimEnd() + "\n\n" + block + "\n";
    console.log("  ✏️  Appended ## Screenshots section to README");
  }

  fs.writeFileSync(readmePath, content, "utf8");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Screenshot UI — starting\n");

  ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });
  const allResults = {};

  let targets = Object.entries(config.targets ?? {});

  if (targetOverride && targetOverride !== "both" && targetOverride !== "all") {
    targets = targets.filter(([k]) => k === targetOverride);
  } else if (config.run && config.run !== "both" && config.run !== "all") {
    targets = targets.filter(([k]) => k === config.run);
  }

  if (targets.length === 0) {
    console.error("❌ No matching targets found. Check config.targets and --target flag.");
    process.exit(1);
  }

  for (const [label, baseUrl] of targets) {
    if (!baseUrl || baseUrl.includes("your-app")) {
      console.warn(`⚠️  Skipping "${label}" — URL not configured in screenshot.config.js`);
      continue;
    }
    allResults[label] = await screenshotTarget(browser, label, baseUrl);
  }

  await browser.close();

  // ── Inject README ──────────────────────────────────────────────────────────
  // Use first target's results for README injection (localhost preferred)
  const primaryResults = allResults["localhost"] ?? Object.values(allResults)[0] ?? [];
  const mdBlock = buildScreenshotMarkdown(primaryResults);

  if (mdBlock) {
    const readmePath = path.join(PROJECT_ROOT, "README.md");
    injectReadme(readmePath, mdBlock);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n── Summary ──────────────────────────────────────────────────");
  for (const [label, results] of Object.entries(allResults)) {
    const ok  = results.filter((r) => r.status === "ok").length;
    const err = results.filter((r) => r.status === "error").length;
    console.log(`\n  📁 ${label}:  ${ok} captured, ${err} failed`);
    for (const r of results) {
      console.log(`    ${r.status === "ok" ? "✅" : "❌"}  ${r.name}.png`);
    }
  }

  const reportPath = path.join(outputDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));
  console.log(`\n📄 Report:      ${reportPath}`);
  console.log(`📁 Screenshots: ${outputDir}`);
  console.log(`📝 README:      ${path.join(PROJECT_ROOT, "README.md")}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
