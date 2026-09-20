/* Vita Plena — the native shells.
   The same built site runs inside an iOS and an Android app (Capacitor; see
   capacitor.config.ts and store/SUBMIT.md). This is the one place the app
   notices which it is in. In a browser every export here is a harmless no-op
   or the plain web answer, so the rest of the app calls these freely. */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** True inside the iOS or Android app; false in any browser, including the demo. */
export const isNative = () => Capacitor.isNativePlatform();
/** "ios" | "android" | "web" */
export const platform = () => Capacitor.getPlatform();

/** The website that hosts our functions and the lectionary index. In a browser
    everything is same-origin, so the base is empty; inside the app the origin is
    the app itself, so calls go to the site by name. VITE_SITE_URL overrides it
    for a branch deploy. */
export const SITE = (import.meta.env?.VITE_SITE_URL || "https://vitaplena13.netlify.app").replace(/\/+$/, "");
export const apiBase = () => (isNative() ? SITE : "");

/**
 * Wire the shell: status bar colours, the Android back button, and resume.
 * @param {{onBack?:()=>boolean, onResume?:()=>void}} [h]
 *   onBack returns true when it handled the press (closed an overlay, changed tab);
 *   false lets the app exit, as Android users expect from the home tab.
 */
export async function initNative(h = {}) {
  if (!isNative()) return;
  try { await StatusBar.setStyle({ style: Style.Dark }); } catch { /* older Android */ }
  if (platform() === "android") {
    try { await StatusBar.setBackgroundColor({ color: "#16386A" }); } catch { /* Android 15+ draws its own */ }
  }
  App.addListener("backButton", () => {
    if (h.onBack && h.onBack()) return;
    App.exitApp();
  });
  App.addListener("resume", () => { if (h.onResume) h.onResume(); });
}

/** Take the launch image down once the first screen is drawn (the gate, the
    onboarding, or the shell). Safe to call more than once. */
export function hideSplash() {
  if (!isNative()) return;
  SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
}

/** A light tap. Returns false on the web so the caller can fall back to vibrate(). */
export function nativeTap() {
  if (!isNative()) return false;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  return true;
}
