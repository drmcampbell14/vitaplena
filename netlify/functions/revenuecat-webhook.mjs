/* Vita Plena — Netlify function: /.netlify/functions/revenuecat-webhook
   RevenueCat tells us when a household's subscription changes (a purchase,
   a renewal, a cancellation, an expiry) and this writes the one field the
   app reads for entitlements: households/{hid}.subscription. Clients cannot
   write that field (firestore.rules); only this function and, one day, the
   Stripe webhook do.

   The RevenueCat "app user id" is the household id (see src/lib/billing.js),
   so the household as a whole is subscribed, not one spouse.

   Console: RevenueCat → Project → Integrations → Webhooks. URL is this
   function; "Authorization header value" is REVENUECAT_WEBHOOK_SECRET, a long
   random string set in Netlify env vars. Events are acknowledged with 200 even
   when ignored, so RevenueCat doesn't retry forever; only a bad secret is 401. */
import { timingSafeEqual } from "node:crypto";
import { db, handle, json, HttpError, FieldValue } from "./_shared/admin.mjs";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); };
const HID = /^[A-Za-z0-9_-]{4,128}$/;

/** RevenueCat's store names, as the app shows them. */
const SOURCE = { APP_STORE: "apple", MAC_APP_STORE: "apple", PLAY_STORE: "google", STRIPE: "stripe", PROMOTIONAL: "promo", AMAZON: "amazon" };

/**
 * The new subscription record for a household after one event, or null when
 * the event changes nothing. Pure, so it is tested directly.
 * @param {object|null|undefined} prev  the household's current subscription field
 * @param {object} ev  RevenueCat's `event` object
 * @param {number} [nowMs]
 * @returns {Record<string, any>|null}
 */
export function applyEvent(prev, ev, nowMs = Date.now()) {
  const type = String(ev?.type || "");
  if (!type || type === "TEST" || type === "SUBSCRIBER_ALIAS") return null;
  // Out-of-order delivery: never let an older event overwrite a newer one.
  const at = Number(ev.event_timestamp_ms) || nowMs;
  if (prev?.lastEventAt && at < prev.lastEventAt) return null;

  const base = {
    plan: "family",
    source: SOURCE[ev.store] || String(ev.store || "store").toLowerCase(),
    productId: ev.product_id || prev?.productId || null,
    sandbox: ev.environment === "SANDBOX",
    lastEvent: type,
    lastEventAt: at,
    trialEndsAt: prev?.trialEndsAt || null
  };
  const exp = Number(ev.expiration_at_ms) || 0;
  const renewsAt = exp ? ymd(exp) : (prev?.renewsAt || null);

  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
      return { ...base, status: "active", renewsAt, cancelled: false, billingIssue: false, paused: false,
        introductory: ev.period_type === "TRIAL" || ev.period_type === "INTRO" };
    case "CANCELLATION":
      // Auto-renew turned off: paid through the period, then it lapses (EXPIRATION arrives).
      if (exp && exp <= nowMs) return { ...base, status: "lapsed", renewsAt, cancelled: true };
      return { ...base, status: prev?.status === "lapsed" ? "lapsed" : "active", renewsAt, cancelled: true };
    case "BILLING_ISSUE":
      return { ...base, status: prev?.status || "active", renewsAt, billingIssue: true };
    case "SUBSCRIPTION_PAUSED":
      return { ...base, status: "lapsed", renewsAt, paused: true };
    case "EXPIRATION":
      return { ...base, status: "lapsed", renewsAt, cancelled: true, expiredBecause: ev.expiration_reason || null };
    case "TRANSFER":
      // Handled per household by the caller; the record itself is the same as a purchase.
      return { ...base, status: "active", renewsAt, cancelled: false };
    default:
      return null;
  }
}

/** Constant-time compare, so the response time can't be used to guess the secret. */
function sameSecret(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** The household ids an event speaks about, in the order to apply: gone first, then gained. */
export function householdsFor(ev) {
  if (ev?.type === "TRANSFER") {
    const from = (ev.transferred_from || []).filter((h) => HID.test(h));
    const to = (ev.transferred_to || []).filter((h) => HID.test(h));
    return { lapsed: from, active: to };
  }
  const ids = [ev?.app_user_id, ev?.original_app_user_id, ...(ev?.aliases || [])].filter((h) => typeof h === "string" && HID.test(h));
  return { lapsed: [], active: [...new Set(ids)] };
}

export default handle(async (req, headers) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, headers);
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "REVENUECAT_WEBHOOK_SECRET is not set");
  const auth = req.headers.get("authorization") || "";
  if (!sameSecret(auth, secret) && !sameSecret(auth.replace(/^Bearer\s+/i, ""), secret)) throw new HttpError(401, "Bad webhook secret");

  let body;
  try { body = await req.json(); } catch { return json(200, { ignored: "not json" }, headers); }
  const ev = body?.event;
  if (!ev || typeof ev !== "object") return json(200, { ignored: "no event" }, headers);

  const fs = db();
  const { lapsed, active } = householdsFor(ev);
  const applied = [];
  for (const [hid, force] of [...lapsed.map((h) => [h, "lapsed"]), ...active.map((h) => [h, null])]) {
    const ref = fs.doc(`households/${hid}`);
    const snap = await ref.get();
    if (!snap.exists) continue;                       // not one of ours (or a sandbox id); acknowledged, not written
    const prev = snap.get("subscription") || null;
    let next = applyEvent(prev, ev);
    if (!next) continue;
    if (force === "lapsed") next = { ...next, status: "lapsed", cancelled: true, transferredAway: true };
    await ref.set({ subscription: next, subscriptionUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    applied.push({ hid, status: next.status });
    if (applied.length === 1 && lapsed.length === 0) break;   // one household per ordinary event
  }
  return json(200, { ok: true, type: ev.type, applied }, headers);
});
