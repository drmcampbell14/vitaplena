/* Vita Plena — shared server helpers for the Netlify functions.
   Firebase Admin app, caller verification, origin checks, HTTP helpers.
   Files under _shared/ are not functions themselves; each function imports this. */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const PROJECT_ID = "vita-plena-a7efa";
export { FieldValue };

/* ---------------- HTTP ---------------- */
const stripSlash = (s) => String(s).replace(/\/+$/, "");

/** Extra browser origins allowed besides the site's own address. */
export function extraOrigins(env = process.env) {
  return new Set([
    env.ALLOWED_ORIGIN,       // e.g. a custom domain that fronts the site
    "http://localhost:5173",  // Vite dev server
    "capacitor://localhost",  // Capacitor iOS shell
    "http://localhost"        // Capacitor Android shell
  ].filter(Boolean).map(stripSlash));
}

/** The site's own origin is always allowed (production, branch deploys, previews).
    A missing Origin header (curl, native) passes; those callers still need a token. */
export function isAllowedOrigin(origin, requestUrl, extra = extraOrigins()) {
  if (!origin) return true;
  const o = stripSlash(origin);
  try { if (o === new URL(requestUrl).origin) return true; } catch { /* fall through */ }
  return extra.has(o);
}

export function parseBearer(headerValue) {
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(headerValue || "");
  return m ? m[1] : null;
}

export const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json"
});

export const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers });

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Standard preflight / method / origin gate. Returns a Response to send, or null to continue. */
export function gate(req, headers, methods = ["POST"]) {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!methods.includes(req.method)) return json(405, { error: "Method not allowed" }, headers);
  if (!isAllowedOrigin(origin, req.url)) return json(403, { error: "This site isn't allowed to use this function (origin " + origin + ")" }, headers);
  return null;
}

/* ---------------- Firebase Admin ---------------- */
export function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  let sa;
  try { sa = JSON.parse(raw); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON"); }
  return initializeApp({ credential: cert(sa), projectId: sa.project_id || PROJECT_ID });
}
export const db = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());

/** A stable server-side secret with no extra configuration: the service account's key id. */
export function serverSecret() {
  try { return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}").private_key_id || ""; } catch { return ""; }
}

/** The household's owner: the explicit field, else the first member (households created before owners existed). */
export const ownerOf = (house) => house.owner || (house.members || [])[0] || null;

/** Verifies the caller's ID token and resolves their household. Confirms membership on
    the household document itself, since users/{uid}.hid is user-writable.
    Returns { uid, hid, house, houseRef, decoded }. */
export async function authenticate(req, { requireHousehold = true } = {}) {
  const token = parseBearer(req.headers.get("authorization"));
  if (!token) throw new HttpError(401, "Sign in required");
  const app = adminApp();
  let decoded;
  try { decoded = await getAuth(app).verifyIdToken(token); }
  catch { throw new HttpError(401, "Session expired — sign in again"); }
  const uid = decoded.uid;
  const fs = getFirestore(app);
  const userSnap = await fs.doc(`users/${uid}`).get();
  const hid = userSnap.exists ? userSnap.get("hid") : null;
  if (!hid) { if (requireHousehold) throw new HttpError(403, "This account isn't part of a household yet"); return { uid, hid: null, house: null, houseRef: null, decoded }; }
  const houseRef = fs.doc(`households/${hid}`);
  const houseSnap = await houseRef.get();
  const house = houseSnap.exists ? houseSnap.data() : null;
  if (!house || !(house.members || []).includes(uid)) throw new HttpError(403, "This account isn't a member of that household");
  return { uid, hid, house, houseRef, decoded };
}

/** Wraps a handler: catches HttpError → status, config errors → 503, anything else → 500. */
export function handle(fn) {
  return async (req) => {
    const headers = corsHeaders(req.headers.get("origin") || "");
    try { return await fn(req, headers); }
    catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message }, headers);
      if (/FIREBASE_SERVICE_ACCOUNT/.test(String(e?.message))) return json(503, { error: "Server isn't configured: " + e.message }, headers);
      console.error(e);
      return json(500, { error: "Server error", detail: String(e?.message || e).slice(0, 300) }, headers);
    }
  };
}

/* ---------------- quotas and entitlements ---------------- */
export const QUOTA = { trial: 40, active: 150, free: 150 }; // Beacon messages per household per day

/** The daily Beacon cap for a household. Households without a subscription field
    (created before entitlements existed) get the paid cap. */
export function capFor(house) {
  const st = house?.subscription?.status;
  if (!st) return QUOTA.free;
  return QUOTA[st] ?? QUOTA.trial;
}

/** True when the household may use paid features. `lapsed` is the only refusing state;
    it is never set automatically, so nobody is locked out before payments exist. */
export function entitled(house) {
  const st = house?.subscription?.status;
  return st !== "lapsed";
}
