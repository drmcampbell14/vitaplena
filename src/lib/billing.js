/* Vita Plena — the family plan, inside the app stores.
   Purchases go through RevenueCat, which talks to the App Store and Google
   Play and then tells our webhook (netlify/functions/revenuecat-webhook.mjs),
   which writes households/{hid}.subscription. The app never writes that field
   itself; it only shows the paywall and starts a purchase.

   The subscription belongs to the household, not the person: RevenueCat's
   "app user id" is the household id, so a spouse who joins later is covered.

   Switched on by the public SDK keys (VITE_RC_IOS_KEY, VITE_RC_ANDROID_KEY) at
   build time. Without them, or on the web, billingOn() is false and the plan
   card says subscriptions arrive with the store release. */
import { Purchases } from "@revenuecat/purchases-capacitor";
import { isNative, platform } from "./native.js";

/** The RevenueCat entitlement identifier that means "this household is paid up". */
export const ENTITLEMENT = "family";

/** @type {ImportMetaEnv} */
const env = import.meta.env || /** @type {any} */ ({});
const KEY = platform() === "ios" ? (env.VITE_RC_IOS_KEY || "") : platform() === "android" ? (env.VITE_RC_ANDROID_KEY || "") : "";

/** True when purchases can be made from this build on this device. */
export const billingOn = () => isNative() && !!KEY;

let configuredFor = "";

/** Point the store SDK at this household. Safe to call on every attach. */
export async function initBilling(hid) {
  if (!billingOn() || !hid) return false;
  try {
    if (!configuredFor) await Purchases.configure({ apiKey: KEY, appUserID: hid });
    else if (configuredFor !== hid) await Purchases.logIn({ appUserID: hid });
    configuredFor = hid;
    return true;
  } catch { return false; }
}

/** The packages on the current offering (what the paywall lists), soonest-renewing last.
    @returns {Promise<any[]>} */
export async function offerings() {
  const o = await Purchases.getOfferings();
  return o?.current?.availablePackages || [];
}

/** True when the customer info carries the family entitlement. */
export function isActive(info) { return !!info?.entitlements?.active?.[ENTITLEMENT]; }

/** Start a purchase. Resolves {ok, active} or {ok:false, cancelled, error}. Never throws. */
export async function buy(pkg) {
  try {
    const r = await Purchases.purchasePackage({ aPackage: pkg });
    return { ok: true, active: isActive(r.customerInfo) };
  } catch (e) {
    return { ok: false, cancelled: !!e?.userCancelled, error: String(e?.message || e || "Purchase failed") };
  }
}

/** Restore purchases made on another device or before a reinstall. Resolves whether the entitlement is active. */
export async function restore() {
  const r = await Purchases.restorePurchases();
  return isActive(r.customerInfo);
}

/** A plain name for a package: "Yearly", "Monthly", or the store's own title. */
export function packageName(pkg) {
  const t = String(pkg?.packageType || "");
  if (t === "ANNUAL") return "Yearly";
  if (t === "MONTHLY") return "Monthly";
  if (t === "LIFETIME") return "Once, for good";
  return pkg?.product?.title || pkg?.identifier || "Plan";
}
