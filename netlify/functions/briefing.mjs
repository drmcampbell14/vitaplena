/* VITA PLENA — Netlify scheduled function: the Sunday briefing.
   Every Sunday at 21:00 UTC (5 PM Eastern in winter, 5 PM EDT is 21:00) each
   household gets a short note for the week ahead: the liturgical week, the
   events, the open tasks, ordered by the ladder. Written by Claude in the
   household's voice, saved to households/{hid}/briefings/{YYYY-MM-DD}, shown as
   a card on Today, and emailed to the members when RESEND_API_KEY is set.

   Also callable on demand: POST with a Firebase ID token writes this week's
   briefing for the caller's household right now (Settings → "Write this week's
   briefing"). */
import { authenticate, db, adminAuth, gate, handle, json, entitled } from "./_shared/admin.mjs";
import { season, liturgicalColor, mysteriesFor } from "../../src/core/liturgical.js";

export const config = { schedule: "0 21 * * 0" };

const MAX_WORDS = 150;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const SYSTEM = `You write a short Sunday note for a Catholic household that keeps a rule of life ordered God → Family → Vocation → Rest. Voice: warm, plain, traditional; the Church is the authority, never a therapist. No emoji, no headings, no bullet points. At most ${MAX_WORDS} words. Mention the liturgical week and any feast, the two or three things that matter most on the calendar, one open task worth finishing, and close with a single line pointing them to prayer or to each other. Address them by name. Do not invent events that aren't in the data.`;

async function writeBriefing(fs, hid, house, key) {
  const now = new Date();
  const from = ymd(now), to = ymd(addD(now, 7));
  const stateSnap = await fs.doc(`households/${hid}/state/main`).get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  const itemsSnap = await fs.collection(`households/${hid}/items`).get();
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const events = items.filter((i) => i.kind === "event" && i.date >= from && i.date <= to).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 20);
  const tasks = items.filter((i) => i.kind === "task" && !i.done && !i.repeat).slice(0, 15);
  const names = Object.values(house.profiles || {}).map((p) => p.name).filter(Boolean);
  const sundays = [];
  for (let i = 0; i <= 7; i++) { const d = addD(now, i); if (d.getDay() === 0) sundays.push(ymd(d)); }
  const data = {
    household: house.name, members: names, people: (state.people || state.famSections || []).map((p) => p.name),
    weekOf: from, season: season(now).name, colour: liturgicalColor(now).name, sundayMysteries: mysteriesFor(now).name,
    practices: (state.practices || []).map((p) => `${p.name} at ${p.time}`),
    events: events.map((e) => `${e.date}${e.time ? " " + e.time : ""} · ${e.title}${e.ownerName ? " (" + e.ownerName + ")" : ""}`),
    openTasks: tasks.map((t) => t.text + (t.due ? " (due " + t.due + ")" : "")),
    focus: (state.focus || []).filter((f) => !f.done).map((f) => f.text)
  };
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, temperature: 0.4, system: SYSTEM, messages: [{ role: "user", content: "Write this week's note from this data:\n" + JSON.stringify(data) }] })
  });
  if (!resp.ok) throw new Error("Anthropic " + resp.status + ": " + (await resp.text()).slice(0, 200));
  const out = await resp.json();
  const text = (out.content?.[0]?.text || "").trim();
  if (!text) throw new Error("Empty briefing");
  await fs.doc(`households/${hid}/briefings/${from}`).set({ text, weekOf: from, createdAt: Date.now(), season: data.season, colour: data.colour });
  return { text, weekOf: from, data };
}

async function emailMembers(house, text, weekOf) {
  const apiKey = process.env.RESEND_API_KEY; if (!apiKey) return { emailed: 0, reason: "RESEND_API_KEY not set" };
  const from = process.env.BRIEFING_FROM || "Vita Plena <briefing@vitaplena.app>";
  const emails = [];
  for (const uid of house.members || []) { try { const u = await adminAuth().getUser(uid); if (u.email) emails.push(u.email); } catch { /* skip */ } }
  if (!emails.length) return { emailed: 0, reason: "no member emails" };
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#1E211B;line-height:1.55;font-size:17px"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#3E7A55">Vita Plena · the week of ${weekOf}</div><p style="white-space:pre-line;margin-top:14px">${text.replace(/</g, "&lt;")}</p><p style="font-size:13px;color:#767C6E;margin-top:26px">Unless the Lord builds the house, those who build it labor in vain.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: emails, subject: "The week ahead · " + (house.name || "your household"), html, text }) });
  return { emailed: r.ok ? emails.length : 0, status: r.status };
}

export default handle(async (req, headers) => {
  const key = process.env.ANTHROPIC_API_KEY;
  const fs = db();

  // Scheduled invocation: Netlify calls the function with no Authorization header.
  const scheduled = !req.headers.get("authorization");
  if (scheduled) {
    if (!key) return json(503, { error: "ANTHROPIC_API_KEY is not set" }, headers);
    const snap = await fs.collection("households").get();
    const results = [];
    for (const d of snap.docs) {
      const house = d.data();
      if (!entitled(house)) { results.push({ hid: d.id, skipped: "not entitled" }); continue; }
      try { const b = await writeBriefing(fs, d.id, house, key); const m = await emailMembers(house, b.text, b.weekOf); results.push({ hid: d.id, ok: true, ...m }); }
      catch (e) { results.push({ hid: d.id, error: String(e.message).slice(0, 200) }); }
    }
    return json(200, { ok: true, households: results.length, results }, headers);
  }

  // On demand, for the caller's own household.
  const early = gate(req, headers, ["POST"]);
  if (early) return early;
  const { hid, house } = await authenticate(req);
  if (!key) return json(503, { error: "ANTHROPIC_API_KEY is not set" }, headers);
  const b = await writeBriefing(fs, hid, house, key);
  const m = await emailMembers(house, b.text, b.weekOf);
  return json(200, { ok: true, text: b.text, weekOf: b.weekOf, ...m }, headers);
});
