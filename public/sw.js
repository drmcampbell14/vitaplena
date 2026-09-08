/* Vita Plena — service worker.
   App shell: cache-first for same-origin built assets and the index page, so the
   app opens instantly and works on airplane mode. Everything else (Firebase,
   Google, Universalis, the companion function) goes straight to the network and
   is never cached here. Firestore has its own offline cache in the app. */

const VERSION = "vp-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NEVER_CACHE = [
  "googleapis.com", "gstatic.com", "firebaseapp.com", "firebase", "google.com",
  "universalis.com", "/.netlify/functions/", "anthropic.com", "netlify.app/.netlify"
];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (NEVER_CACHE.some((s) => req.url.includes(s))) return;
  if (url.origin !== self.location.origin) return;

  // Navigations: network first (fresh deploys win), cached index as the offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => { caches.open(VERSION).then((c) => c.put("/index.html", res.clone())); return res; })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Hashed build assets and icons: cache first, then network, and remember what we fetch.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }))
    );
  }
});
