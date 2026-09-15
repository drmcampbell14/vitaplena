/* Vita Plena — scan a schedule.
   A photo of a kids' game schedule, a school calendar, a parish bulletin, a
   work rota — Claude reads it and returns the dated events on it, which the app
   shows for review before adding any to the calendar.

   Same gate as the companion: verified Firebase identity, household membership,
   entitlement, and the household's daily quota — one scan counts as one message.
   Calls the Messages API the way companion.mjs does (raw fetch), so the two stay
   alike. Server-side refusal fallbacks are on: if the model declines a request
   on policy, the API re-runs it on a fallback model inside the same call.

   Environment: ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT. */
import { authenticate, db, gate, handle, json, capFor, entitled, FieldValue, HttpError } from "./_shared/admin.mjs";

const MODEL = "claude-opus-5";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;           // after client-side downscaling this is ~400 KB
const MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SYSTEM = `You read a photograph of a schedule and list every dated event on it.
The photo may be a kids' sports season, a school or parish calendar, a bulletin, a work rota, a flyer, a handwritten list.
Return ONLY a JSON object, no prose, no code fences:
{"events":[{"title":"","date":"YYYY-MM-DD","time":"HH:MM","endTime":"HH:MM","location":"","note":""}],"note":""}
Rules:
- One entry per dated occurrence. A recurring line ("every Tuesday in October") becomes one entry per date.
- Dates are absolute. Resolve partial or relative dates against today and the current year; a month with no year means the next occurrence on or after today unless the sheet names a season or year.
- Times are 24-hour. Leave time empty for an all-day item; leave endTime empty if not shown.
- title is short and specific ("U10 vs. Tigers", not "Game"). Put the opponent, field, room or other detail in location or note.
- Skip lines with no resolvable date. If the image is not a schedule at all, return {"events":[],"note":"what the image is"}.`;

const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/* JavaScript rolls "2026-02-30" over to March 2 instead of rejecting it, so a date
   is real only if it survives the round trip unchanged. */
const pad2 = (n) => String(n).padStart(2, "0");
const realDate = (ds) => { if (!DATE.test(ds)) return false; const d = new Date(ds + "T12:00"); return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` === ds; };

/** The model's text → clean events, or an empty list. Exported for tests. */
export function parseEvents(text) {
  const s = String(text || "");
  const open = s.indexOf("{"), close = s.lastIndexOf("}");
  if (open < 0 || close <= open) return { events: [], note: "" };
  let obj;
  try { obj = JSON.parse(s.slice(open, close + 1)); } catch { return { events: [], note: "" }; }
  const list = Array.isArray(obj?.events) ? obj.events : [];
  const seen = new Set();
  const events = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const title = str(e.title, 120), date = str(e.date, 10);
    if (!title || !realDate(date)) continue;
    const time = TIME.test(str(e.time, 5)) ? str(e.time, 5) : "";
    const endTime = time && TIME.test(str(e.endTime, 5)) ? str(e.endTime, 5) : "";
    const key = `${date}|${time}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ title, date, time, endTime, location: str(e.location, 120), note: str(e.note, 200) });
    if (events.length >= 80) break;
  }
  events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { events, note: str(obj?.note, 200) };
}

export default handle(async (req, headers) => {
  const early = gate(req, headers);
  if (early) return early;
  const { hid, house } = await authenticate(req);
  if (!entitled(house)) throw new HttpError(402, "This household's subscription has lapsed. Renew from Settings to scan schedules.");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError(503, "Server not configured — add ANTHROPIC_API_KEY in Netlify environment variables");

  let body;
  try { body = await req.json(); } catch { throw new HttpError(400, "Bad request"); }
  const media = String(body?.image?.mediaType || "");
  const data = String(body?.image?.data || "");
  if (!MEDIA.has(media) || !data) throw new HttpError(400, "Send a JPEG, PNG or WebP photo.");
  if (data.length * 0.75 > MAX_IMAGE_BYTES) throw new HttpError(413, "That photo is too large. Try again — the app shrinks it before sending.");

  /* The daily quota, shared with the companion. */
  const day = new Date().toISOString().slice(0, 10);
  const usageRef = db().doc(`households/${hid}/meta/usage`);
  const usageSnap = await usageRef.get();
  const used = usageSnap.exists ? (usageSnap.get(day) || 0) : 0;
  const cap = capFor(house);
  if (used >= cap) throw new HttpError(429, `Today's ${cap} messages are used up. Scanning is back tomorrow.`);

  const today = DATE.test(String(body.today || "")) ? body.today : day;
  const weekday = new Date(today + "T12:00").toLocaleDateString("en-US", { weekday: "long" });
  const tz = str(body.tz, 60) || "UTC";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: media, data } },
        { type: "text", text: `Today is ${weekday}, ${today}. The household's timezone is ${tz}. List the events on this schedule.` }
      ] }]
    })
  });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = out?.error?.message || `The reader answered ${resp.status}.`;
    throw new HttpError(502, "Couldn't read the photo: " + msg);
  }
  if (out.stop_reason === "refusal") throw new HttpError(422, "The reader declined this photo" + (out.stop_details?.explanation ? ": " + out.stop_details.explanation : "."));
  const text = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const parsed = parseEvents(text);

  await usageRef.set({ [day]: FieldValue.increment(1) }, { merge: true }).catch(() => {});
  return json(200, { ...parsed, quota: { used: used + 1, cap } }, headers);
});
