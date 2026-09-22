/* Vita Plena — service worker.
   Makes the app installable and usable with no signal: the shell (index, the
   built assets, icons, fonts, manifest) is precached on install; the readings
   are kept network-first with the last good copy as the offline fallback.
   Firebase (Firestore, Auth) is never touched here: it goes straight to the
   network and Firestore keeps its own offline store inside the app.

   VERSION must be bumped on every deploy that changes cached files. The build
   (vite.config.js) also stamps the list of hashed assets into PRECACHE below, so
   in practice every build carries a fresh list; the version string is the
   human-readable part and the belt to those braces. A new worker waits until
   the app tells it to take over (see src/lib/pwa.js); it never skips waiting on
   its own, so a person mid-task is never reloaded under their feet. */
const CACHE_VERSION = "vp-v7";
const SHELL_CACHE = CACHE_VERSION + "-shell";        // precached: index, assets, icons, fonts, manifest
const READINGS_CACHE = CACHE_VERSION + "-readings";  // network-first: lectionary index, readings function
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";    // cache-first: third-party fonts and CDN files, if any

/* The shell. The build replaces the placeholder below with the hashed files in
   dist/assets, so the whole app is on the device after the first visit. */
const PRECACHE = [
  "/", "/index.html", "/manifest.webmanifest",
  "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-32.png",
  "/fonts/fonts.css",
  "/fonts/cormorant-garamond-latin-500-normal.woff2", "/fonts/cormorant-garamond-latin-600-normal.woff2",
  "/fonts/cormorant-garamond-latin-500-italic.woff2", "/fonts/cormorant-garamond-latin-600-italic.woff2",
  "/fonts/source-sans-3-latin-400-normal.woff2", "/fonts/source-sans-3-latin-500-normal.woff2",
  "/fonts/source-sans-3-latin-600-normal.woff2", "/fonts/source-sans-3-latin-700-normal.woff2",
  "/fonts/source-sans-3-latin-400-italic.woff2"
  /* __BUILD_ASSETS__ */
];

/* Hosts that own their own traffic. Matched on the hostname, never the URL: the
   bare word "firebase" once matched our own /assets/firebase-<hash>.js chunk and
   kept the app from booting offline. */
const BYPASS_HOSTS = [
  "firestore.googleapis.com", "identitytoolkit.googleapis.com", "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com", "firebaseio.com", "firebaseapp.com",
  "www.googleapis.com", "accounts.google.com", "apis.google.com", "api.anthropic.com"
];
/* Third-party files worth keeping (fonts from a CDN, should any come back). */
const CDN_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE))
    // no skipWaiting here: the app asks for it once the person taps "Refresh"
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION + "-")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

const put = (cacheName, req, res) => { if (res && res.ok) caches.open(cacheName).then((c) => c.put(req, res.clone())).catch(() => {}); return res; };

/** Network first; the cached copy when the network fails. */
const networkFirst = (cacheName, req, fallbackKey) =>
  fetch(req).then((res) => put(cacheName, fallbackKey || req, res))
    .catch(() => caches.match(fallbackKey || req).then((hit) => hit || Response.error()));

/** Cached copy at once; refresh it in the background. */
const staleWhileRevalidate = (cacheName, req) =>
  caches.match(req).then((hit) => {
    const refresh = fetch(req).then((res) => put(cacheName, req, res)).catch(() => hit);
    return hit || refresh;
  });

/** Cached copy if there is one; otherwise fetch and keep. For files that never change. */
const cacheFirst = (cacheName, req) =>
  caches.match(req).then((hit) => hit || fetch(req).then((res) => put(cacheName, req, res)));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                                          // writes are never ours
  const url = new URL(req.url);
  if (BYPASS_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) return;

  if (url.origin !== self.location.origin) {
    if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(RUNTIME_CACHE, req));
    return;                                                                  // anything else: straight through
  }

  const p = url.pathname;

  // The app opening: fresh deploys win; the precached index is the offline fallback.
  if (req.mode === "navigate") { event.respondWith(networkFirst(SHELL_CACHE, req, "/index.html")); return; }

  // The day's readings: the deploy-time index and the live function, last good copy offline.
  if (p.startsWith("/data/lectionary/") || p.startsWith("/.netlify/functions/readings")) { event.respondWith(networkFirst(READINGS_CACHE, req)); return; }

  // Every other function call is live data (Beacon, household admin, scan): never cached.
  if (p.startsWith("/.netlify/functions/")) return;

  // Hashed build assets and the bundled Bible never change under one name: cache first.
  if (p.startsWith("/assets/") || p.startsWith("/data/drc/")) { event.respondWith(cacheFirst(SHELL_CACHE, req)); return; }

  // Icons, fonts, manifest, screenshots, legal pages: serve at once, refresh behind.
  if (p.startsWith("/icons/") || p.startsWith("/fonts/") || p.startsWith("/screenshots/") || p.endsWith(".webmanifest") || p.endsWith(".svg") || p.endsWith(".html")) {
    event.respondWith(staleWhileRevalidate(SHELL_CACHE, req));
  }
});
