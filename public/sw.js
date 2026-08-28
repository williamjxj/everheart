/* Everheart service worker — offline PWA shell.
 * Precache the app shell (home + all demo chat routes) and runtime-cache
 * static assets and companion portraits so the app keeps working offline.
 */
const CACHE_NAME = "everheart-v1";

const PRECACHE_URLS = [
  "/",
  "/chat/demo-elena",
  "/chat/demo-kai",
  "/chat/demo-lyra",
  "/chat/demo-mira",
  "/chat/demo-dante",
  "/chat/demo-yuna",
  "/chat/demo-cassian",
  "/chat/demo-nova",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Serve from cache immediately, refresh it in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok && request.method === "GET") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

/** Prefer the network; fall back to cache (or the app shell for navigations). */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === "GET") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("/");
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: fresh page online, cached page offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Build assets + companion images: cache-first with background refresh.
  // mp4 clips are left to the browser (media range requests).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/companions/")
  ) {
    if (url.pathname.endsWith(".mp4")) return;
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Icons / manifest: cache-first.
  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg" ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
