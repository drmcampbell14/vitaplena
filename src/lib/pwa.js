/* Vita Plena — the web app on a phone.
   Registers the service worker, shows "Update available" when a new build is
   waiting (and reloads exactly once when the person says so), offers the
   install prompt where the browser has one, gives iPhone Safari its one-time
   "Add to Home Screen" hint, and shows a quiet line while the device is
   offline. Nothing here runs inside the native apps or the dev server. */
import { isNative } from "./native.js";

const DISMISS_KEY = "vp-install-dismissed";     // ms timestamp of the last "Not now"
const IOS_HINT_KEY = "vp-ios-hint-seen";
const REASK_DAYS = 14;

let deferredPrompt = null;
let reloading = false;

/** True in the installed app (any platform) or the native shells. */
export function isStandalone() {
  return isNative() || window.matchMedia("(display-mode: standalone)").matches || /** @type {any} */ (navigator).standalone === true;
}
/** iPhone or iPad in Safari: no install prompt exists, so the hint is the way. */
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

/* ---------------- the bar ----------------
   One element (#pwa-bar in index.html) with three uses: update, install, offline.
   Offline wins while it lasts; the others wait for it to clear. */
let current = null;   // "offline" | "update" | "install" | "ios" | null
let pending = null;   // what to show once offline clears
function bar() { return document.getElementById("pwa-bar"); }
function show(kind, text, actions) {
  const el = bar(); if (!el) return;
  if (current === "offline" && kind !== "offline") { pending = { kind, text, actions }; return; }
  current = kind;
  el.className = "pwa-bar " + kind;
  el.innerHTML = `<span class="pwa-text">${text}</span>` +
    actions.map((a, i) => `<button class="pwa-btn ${a.primary ? "primary" : ""}" data-i="${i}">${a.label}</button>`).join("");
  actions.forEach((a, i) => { /** @type {HTMLElement} */ (el.querySelector(`[data-i="${i}"]`)).onclick = () => { hide(); a.run && a.run(); }; });
}
function hide() {
  const el = bar(); if (el) el.className = "pwa-bar hide";
  current = null;
  if (pending) { const p = pending; pending = null; show(p.kind, p.text, p.actions); }
}

/* ---------------- offline ---------------- */
function syncOnline() {
  if (!navigator.onLine) show("offline", "Offline. What you change here is kept and synced when you're back.", []);
  else if (current === "offline") hide();
}

/* ---------------- updates ----------------
   A new worker installs beside the old one and waits. We say so; on "Refresh" we
   ask it to take over, and reload once when it has (controllerchange), guarded
   so a second controllerchange can never loop the page. */
function watchForUpdates(reg) {
  const offer = () => show("update", "A new version of Vita Plena is ready.", [
    { label: "Refresh", primary: true, run: () => reg.waiting && reg.waiting.postMessage({ type: "SKIP_WAITING" }) },
    { label: "Later" }
  ]);
  if (reg.waiting && navigator.serviceWorker.controller) offer();
  reg.addEventListener("updatefound", () => {
    const w = reg.installing; if (!w) return;
    w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(); });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) return; reloading = true; location.reload(); });
  // Look for a new build when the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
}

/* ---------------- install ---------------- */
function offerInstall() {
  if (isStandalone()) return;
  const last = Number(store.get(DISMISS_KEY) || 0);
  if (Date.now() - last < REASK_DAYS * 864e5) return;
  show("install", "Put Vita Plena on your home screen: full screen, and it works offline.", [
    { label: "Install", primary: true, run: () => promptInstall() },
    { label: "Not now", run: () => store.set(DISMISS_KEY, String(Date.now())) }
  ]);
}
/** Runs the browser's own install prompt. Resolves true when it was shown. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const p = deferredPrompt; deferredPrompt = null;
  try { p.prompt(); await p.userChoice; } catch { /* dismissed */ }
  return true;
}
/** Whether a native install prompt is on hand (Chrome, Edge, Samsung). */
export const canPromptInstall = () => !!deferredPrompt;

function offerIosHint() {
  if (!isIosSafari() || isStandalone() || store.get(IOS_HINT_KEY)) return;
  show("ios", "On iPhone: tap Share, then Add to Home Screen.", [{ label: "Got it", run: () => store.set(IOS_HINT_KEY, "1") }]);
}

/* ---------------- boot ---------------- */
export function initPwa() {
  if (isNative()) return;
  window.addEventListener("online", syncOnline);
  window.addEventListener("offline", syncOnline);
  syncOnline();

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; setTimeout(offerInstall, 4000); });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; if (current === "install") hide(); });
  setTimeout(offerIosHint, 6000);

  if (!("serviceWorker" in navigator) || location.hostname === "localhost") return;   // the dev server is never cached
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(watchForUpdates).catch((e) => console.warn("Service worker not registered:", e?.message || e));
  });
}
