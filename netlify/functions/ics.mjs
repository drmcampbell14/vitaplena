/* VITA PLENA — Netlify function: /.netlify/functions/ics
   The household's calendar as an iCalendar feed, for Apple Calendar, Google, Outlook.

   POST (with a Firebase ID token)  → { url }   the household's private feed URL
   GET  ?h=<hid>&t=<token>          → text/calendar

   The token is an HMAC of the household id with a server-side secret, so the feed
   URL is unguessable but needs no login (calendar apps can't sign in). Sharing
   the URL shares the calendar; regenerating is a Phase 3 follow-up. */
import { createHmac } from "node:crypto";
import { authenticate, db, gate, handle, json, serverSecret, HttpError } from "./_shared/admin.mjs";
import { buildIcs } from "./_shared/ics.mjs";

export function feedToken(hid, secret) {
  return createHmac("sha256", secret || "vita-plena").update(hid).digest("hex").slice(0, 32);
}

export default handle(async (req, headers) => {
  const early = gate(req, headers, ["POST", "GET"]);
  if (early) return early;

  if (req.method === "POST") {
    const { hid } = await authenticate(req);
    const origin = new URL(req.url).origin;
    const url = `${origin}/.netlify/functions/ics?h=${encodeURIComponent(hid)}&t=${feedToken(hid, serverSecret())}`;
    return json(200, { url, webcal: url.replace(/^https?:/, "webcal:") }, headers);
  }

  const u = new URL(req.url);
  const hid = u.searchParams.get("h") || "", t = u.searchParams.get("t") || "";
  if (!hid || !t || t !== feedToken(hid, serverSecret())) throw new HttpError(403, "This calendar link isn't valid");

  const fs = db();
  const houseSnap = await fs.doc(`households/${hid}`).get();
  if (!houseSnap.exists) throw new HttpError(404, "No such household");
  const house = houseSnap.data();
  const stateSnap = await fs.doc(`households/${hid}/state/main`).get();
  const practices = stateSnap.exists ? (stateSnap.get("practices") || []) : [];
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 30);
  const to = new Date(now); to.setDate(to.getDate() + 120);
  const ymd = (d) => d.toISOString().slice(0, 10);
  const evSnap = await fs.collection(`households/${hid}/items`).where("kind", "==", "event").get();
  const events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.date >= ymd(from) && e.date <= ymd(to));

  const body = buildIcs({ name: house.name || "Household", hid, practices, events, now });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "Content-Disposition": 'inline; filename="vita-plena.ics"' } });
});
