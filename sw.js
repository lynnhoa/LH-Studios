// ─────────────────────────────────────────────────────────────
// Service Worker — app-shell cache + network-first for API
// Ensures the PWA loads instantly and doesn't blank on flaky
// connections. Cache is updated in the background on each visit.
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = "lh-studio-v1";

// App shell — cached on install so the PWA opens offline
const APP_SHELL = [
  "/",
  "/index.html",
];

// ── Install: pre-cache app shell ─────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback ─────────────────
// API calls (Supabase) always go to network — never cached.
// Static assets try network first; fall back to cache if offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase API, auth, or POST requests
  if (
    event.request.method !== "GET" ||
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/rest")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/index.html");
        });
      })
  );
});
