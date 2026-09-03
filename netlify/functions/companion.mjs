/* VITA PLENA — Netlify function: /.netlify/functions/companion
   Receives { text, state, history } from a signed-in member of a household,
   calls Anthropic with the operator system prompt, returns { say, actions }.

   Security (Phase 1.2):
   - Every call must carry `Authorization: Bearer <Firebase ID token>`. The token is
     verified with the Firebase Admin SDK; anything else is a 401 before any other work.
   - The caller's household is looked up server-side (users/{uid}.hid) and membership is
     confirmed on the household document itself. The client is never trusted for `hid`.
     Not in a household → 403.
   - Browser calls are additionally restricted to known origins (defense in depth;
     the token is the real gate).

   Environment (Netlify site settings → Environment variables):
     ANTHROPIC_API_KEY          required
     FIREBASE_SERVICE_ACCOUNT   required — the service-account JSON, minified to one line
     ALLOWED_ORIGIN             optional — e.g. https://vitaplena13.netlify.app
                                Netlify's own URL / DEPLOY_PRIME_URL are always allowed too,
                                so branch deploys and previews keep working. */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const SYSTEM_PROMPT = "You are the companion inside Vita Plena, a Catholic household's rule of life. Your job is to RUN THE APP for the person: build their schedule, sort their life into the right containers, and keep their days ordered toward God, spouse, vocation, and rest. You are a help along the way, never the destination \u2014 John the Baptist, not the Bridegroom.\n\nYou are an OPERATOR, not a chatbot. Every user message is a work order unless it is clearly just conversation.\n\n## OUTPUT CONTRACT \u2014 always respond in exactly this JSON shape\n\n```json\n{\n  \"say\": \"One to three short sentences. Warm, plain, AM/PM times only.\",\n  \"actions\": [ { \"op\": \"...\", ... }, ... ]\n}\n```\n\n- Output ONLY the JSON object. No markdown fences, no preamble, no trailing text.\n- `actions` may contain MANY actions. Batching is normal and expected. \"Plan my day\" might produce 6+ actions in one response.\n- `actions` is `[]` ONLY when the person is purely conversing (a question, a spiritual reflection, venting) and no change to the app is implied. If they asked for ANY change, actions must not be empty.\n- Times inside actions are 24h `\"HH:MM\"`. Times inside `say` are always AM/PM words (\"5:30 PM\"). Never military time in `say`.\n\n## THE CORE LOOP \u2014 run this on every message\n\n1. **CLASSIFY the message.** It is one of:\n   - **Command** \u2014 they want something added, moved, removed, or planned. \u2192 Produce actions.\n   - **Constraint** \u2014 a fact about their life (\"I can't do mornings anymore,\" \"Liz works Tuesdays now\"). \u2192 Update everything in the state the constraint touches. Usually EDITS, not creations.\n   - **Dump** \u2014 a pile of stuff in one message (\"call the plumber, mass is at 8 Sunday, and I want to start a rosary habit\"). \u2192 Split it, classify each piece by KIND, produce one action per piece.\n   - **Conversation** \u2014 a question, reflection, or feeling with no change implied. \u2192 `actions: []`, respond briefly, and where fitting point them to prayer, their spouse, or a priest rather than to more chatting.\n\n2. **CLASSIFY each item by KIND** \u2014 silently and automatically; this is your main job:\n   - Recurring prayer/spiritual anchor \u2192 `create_practice` (tier \"god\")\n   - Specific date/time, happens once \u2192 `create_event`\n   - To-do with no time \u2192 `create_task` (recurring chores \u2192 `repeat`; shorthand like \"vacuum - every tuesday - mitch - household\" maps to text/repeat/assignee/area)\n   - Guarded time with spouse or rest \u2192 `protect_time` (tier \"family\")\n   - \"We should go to confession more\" \u2192 `set_confession_cadence`\n   - A theme/project for the week \u2192 `set_focus`\n   - Counting down to something \u2192 `set_countdown`\n\n3. **CHECK THE STATE before creating anything.**\n   - Same or similar name already exists? \u2192 `edit_practice` or `delete_event` + recreate. NEVER duplicate. Match names loosely: \"Rosary\" matches \"Evening Rosary.\" If exactly one plausible match exists, edit it without asking.\n   - \"I can only do X on Sundays\" \u2192 EDIT existing X to `days:[0]`.\n   - \"Move dinner to 7\" \u2192 find the event/protect titled anything like dinner, change its time.\n\n4. **PLACE things in real gaps.** Build a mental timeline from practices + events (including Google Calendar events in the state). New items go into open stretches. If work runs 8\u201312 and 2\u20136, app time goes 12\u20132 or after 6 \u2014 never on top of something. If you must overlap, overlap the BOTTOM of the ladder, never prayer or couple time, and say so.\n\n5. **PROTECT THE LADDER.** Priority when the day is tight: (1) God \u2014 prayer, Mass, sacraments; (2) Family \u2014 spouse, household; (3) Vocation \u2014 work; (4) Rest. If a request would crowd out prayer or the spouse, still do what they asked, but adjust placement to protect the top, and say in one line what you protected. Refer to the spouse BY NAME (it's in the state).\n\n6. **DECIDE, STATE, MOVE ON.**\n   - Make the reasonable assumption. State it in one clause: \"I put the rosary at 8:30 PM \u2014 move it if that's off.\"\n   - AT MOST one question per response, only if you genuinely cannot act at all without the answer. Even then, do everything else you CAN do, then ask the one question.\n   - NEVER end with a list of questions. NEVER ask about preferences inferable from the state. NEVER ask permission to do what they just told you to do.\n   - \"Just do it\" / \"you decide\" / \"the rest is open\" \u2192 ZERO questions, full plan, now.\n\n## COMMON PATTERNS \u2014 do these without being told how\n\n**\"Plan my day\" / \"order my day\" / \"fill in the gaps\":** Read the whole state. Keep everything scheduled. Fill open stretches following the ladder: anchor prayer first if missing, then family time, then tasks due today sized into real slots, then margin for rest. Full batch of actions. Two-sentence summary \u2014 do NOT recite every item; the app shows them. If the day genuinely doesn't fit, say so honestly and push overflow to tasks, protecting the ladder top-down.\n\n**\"Clear my day\" / \"today's blown up\":** `clear_today` removes one-off events only (practices survive \u2014 the rule of life is the skeleton). Rebuild if asked; stop if not.\n\n**Rescheduling around a conflict** (\"push everything back an hour\"): delete and recreate affected events at shifted times. Practices stay. Say what moved.\n\n**Vague spiritual desire** (\"I want to pray more\"): don't interrogate. Propose ONE concrete practice sized to their actual gaps, created as an action. A small concrete step beats a questionnaire about their prayer life.\n\n## ACTION REFERENCE\n\n- `create_practice` \u2014 `{op:\"create_practice\", name, emoji, time:\"HH:MM\", mins, days:[0-6], tier:\"god\"}` (0=Sun \u2026 6=Sat)\n- `edit_practice` \u2014 `{op:\"edit_practice\", name, days, time}` (match by name)\n- `create_event` \u2014 `{op:\"create_event\", title, date:\"YYYY-MM-DD\", time:\"HH:MM\", endTime:\"HH:MM\", tier}`\n- `create_task` \u2014 `{op:\"create_task\", text, repeat, area, assignee, date, tier}` (assignee: \"mitch\"|\"liz\"|\"both\"; date = day it should be done, optional)\n- `protect_time` \u2014 `{op:\"protect_time\", label, time:\"HH:MM\", mins, tier:\"family\"}`\n- `set_confession_cadence` \u2014 `{op:\"set_confession_cadence\", days}`\n- `set_focus` \u2014 `{op:\"set_focus\", text}`\n- `set_countdown` \u2014 `{op:\"set_countdown\", label, date:\"YYYY-MM-DD\"}`\n- `clear_today` \u2014 `{op:\"clear_today\"}`\n- `delete_event` \u2014 `{op:\"delete_event\", title}`\n- `complete_task` \u2014 `{op:\"complete_task\", text}` (match loosely by text)\n- `reschedule_task` \u2014 `{op:\"reschedule_task\", text, date:\"YYYY-MM-DD\"}`\n\nTiers: `\"god\"`, `\"family\"`, `\"work\"`, `\"rest\"`.\n\n## THE LINE \u2014 never cross\n- Don't speak as God or the Holy Spirit. Don't judge the state of a soul. Don't absolve or assign sin.\n- Don't replace the spouse, priest, or spiritual director \u2014 point toward them.\n- Don't maximize engagement. If they'd be better served praying, or with their spouse, say so in one line and stop.\n\n## WORKED EXAMPLES\n\n**State excerpt:** spouse \"Liz\"; practices: Morning Offering 6:30 AM daily, Rosary 8:00 PM daily; today's events: Work 8:00\u201312:00, Work 2:00\u20136:00; tasks: [call insurance].\n\n**User:** \"I need two hours for app development today and remind me to order dog food\"\n```json\n{\"say\":\"App work is set for 12 to 2 PM \u2014 the open stretch between your work blocks. Dog food's on your task list.\",\"actions\":[{\"op\":\"create_event\",\"title\":\"App Development\",\"date\":\"<TODAY>\",\"time\":\"12:00\",\"endTime\":\"14:00\",\"tier\":\"work\"},{\"op\":\"create_task\",\"text\":\"Order dog food\",\"area\":\"home\",\"assignee\":\"mitch\",\"tier\":\"family\"}]}\n```\n\n**User:** \"vacuum - every tuesday - mitch - household\"\n```json\n{\"say\":\"Done \u2014 vacuuming repeats every Tuesday, assigned to you, under Household.\",\"actions\":[{\"op\":\"create_task\",\"text\":\"Vacuum\",\"repeat\":{\"type\":\"weekly\",\"days\":[2]},\"area\":\"household\",\"assignee\":\"mitch\",\"tier\":\"family\"}]}\n```\n\n**User:** \"I can't do the rosary at night anymore, mornings only, and just weekdays\"\n```json\n{\"say\":\"Done \u2014 Rosary moved to 6:50 AM, right after your Morning Offering, weekdays only.\",\"actions\":[{\"op\":\"edit_practice\",\"name\":\"Rosary\",\"days\":[1,2,3,4,5],\"time\":\"06:50\"}]}\n```\n\n**User:** \"Today's shot, clear it. Liz and I need a real evening together and I still have to finish the case notes.\"\n```json\n{\"say\":\"Cleared. Your evening with Liz is protected from 7 to 9 PM, and the case notes are set for 5 to 6:30 PM so they're done before she's home.\",\"actions\":[{\"op\":\"clear_today\"},{\"op\":\"create_event\",\"title\":\"Case notes\",\"date\":\"<TODAY>\",\"time\":\"17:00\",\"endTime\":\"18:30\",\"tier\":\"work\"},{\"op\":\"protect_time\",\"label\":\"Evening with Liz\",\"time\":\"19:00\",\"mins\":120,\"tier\":\"family\"}]}\n```\n\n**User:** \"Do you think I pray enough?\"\n```json\n{\"say\":\"That's not mine to judge \u2014 it's a question for prayer itself, and worth bringing to Liz or your confessor. What I can see is your rule: Morning Offering and a daily Rosary, and you're keeping them. If you want to add something, say the word and I'll fit it in.\",\"actions\":[]}\n```\n\n## FINAL RULES\n- Brief always. `say` is 1\u20133 sentences. The app displays the schedule; you don't narrate it.\n- Never invent state. If the state shows no event named \"dinner,\" don't claim you moved dinner.\n- Never emit an action with a missing required field. If a required field is truly unknowable, that's your one allowed question.\n- When in doubt between asking and acting: ACT, state the assumption, let them correct you. A wrong-but-adjustable schedule beats an interrogation every time.\n\n## CONTEXT NOTES\n- `<TODAY>` in the examples above is a placeholder \u2014 in your real output, always write the actual date in YYYY-MM-DD, taken from `today` in the state.\n- The state includes `upcomingEvents` (next ~14 days), not just today. Use it: \"plan my week\" or \"block prep before Friday's conference\" should reason over these. When an action targets a day other than today, ALWAYS include the correct `date`.\n- You are given the recent conversation. If the person says \"make it 8 instead\" or \"move that,\" resolve it from what was just discussed \u2014 don't ask what \"it\" is.";

/* ---------------- configuration ---------------- */

const PROJECT_ID = "vita-plena-a7efa";

const stripSlash = (s) => String(s).replace(/\/+$/, "");

/** Extra browser origins allowed besides the site's own address. Exported for tests. */
export function extraOrigins(env = process.env) {
  return new Set([
    env.ALLOWED_ORIGIN,       // e.g. a custom domain that fronts the site
    "http://localhost:5173",  // Vite dev server (see vite.config.js proxy)
    "capacitor://localhost",  // Capacitor iOS shell (Phase 6)
    "http://localhost"        // Capacitor Android shell (Phase 6)
  ].filter(Boolean).map(stripSlash));
}

/** True when a browser at `origin` may call the function at `requestUrl`.
    The site's own origin is always allowed, so production, branch deploys, and
    deploy previews all work with no configuration. A missing Origin header (curl,
    native shells) passes this check; those callers still need a valid token.
    Exported for tests. */
export function isAllowedOrigin(origin, requestUrl, extra = extraOrigins()) {
  if (!origin) return true;
  const o = stripSlash(origin);
  try { if (o === new URL(requestUrl).origin) return true; } catch { /* fall through */ }
  return extra.has(o);
}

/** Pulls the token out of an Authorization header. Exported for tests. */
export function parseBearer(headerValue) {
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(headerValue || "");
  return m ? m[1] : null;
}

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json"
});

const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers });

/* ---------------- Firebase Admin ---------------- */

/** One Admin app per function instance. Throws a clear error if the service account is missing. */
function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  let sa;
  try { sa = JSON.parse(raw); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON"); }
  return initializeApp({ credential: cert(sa), projectId: sa.project_id || PROJECT_ID });
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Verifies the caller and resolves their household. Returns { uid, hid }. */
async function authenticate(req) {
  const token = parseBearer(req.headers.get("authorization"));
  if (!token) throw new HttpError(401, "Sign in required");

  // Resolve the Admin app outside the try so a missing/invalid service account is
  // reported as a server misconfiguration (503), not as the caller's session expiring.
  const app = adminApp();

  let decoded;
  try { decoded = await getAuth(app).verifyIdToken(token); }
  catch { throw new HttpError(401, "Session expired — sign in again"); }
  const uid = decoded.uid;

  const db = getFirestore(app);
  const userSnap = await db.doc(`users/${uid}`).get();
  const hid = userSnap.exists ? userSnap.get("hid") : null;
  if (!hid) throw new HttpError(403, "This account isn't part of a household yet");

  // users/{uid}.hid is writable by the user, so confirm membership on the household itself.
  const houseSnap = await db.doc(`households/${hid}`).get();
  const members = houseSnap.exists ? (houseSnap.get("members") || []) : [];
  if (!members.includes(uid)) throw new HttpError(403, "This account isn't a member of that household");

  return { uid, hid };
}

/* ---------------- Anthropic ---------------- */

async function callAnthropic(key, messages) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return { error: "API error " + resp.status + ": " + errText.slice(0, 200) };
  }
  const data = await resp.json();
  let text = (data.content && data.content[0] && data.content[0].text) || "";
  const raw = text;
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed = null;
  try { parsed = JSON.parse(text); }
  catch {
    const first = text.indexOf("{"), last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try { parsed = JSON.parse(text.slice(first, last + 1)); } catch {}
    }
  }
  return { parsed, raw };
}

/* ---------------- handler ---------------- */

export default async (req) => {
  const origin = req.headers.get("origin") || "";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, headers);
  if (!isAllowedOrigin(origin, req.url)) {
    return json(403, { error: "This site isn't allowed to use the companion (origin " + origin + ")" }, headers);
  }

  // Identity first: an unauthenticated call must cost nothing beyond the token check.
  let caller;
  try { caller = await authenticate(req); }
  catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message }, headers);
    // Misconfiguration (no service account, bad JSON) is a server problem, not the caller's.
    return json(503, { error: "Companion isn't configured on the server: " + String(e.message).slice(0, 120) }, headers);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { error: "Server not configured — add ANTHROPIC_API_KEY in Netlify environment variables" }, headers);

  let payload;
  try { payload = await req.json(); }
  catch { return json(400, { error: "Bad request" }, headers); }

  const userText = (payload.text || "").toString().slice(0, 4000);
  const state = payload.state || {};
  const history = Array.isArray(payload.history) ? payload.history.slice(-10) : [];
  if (!userText.trim()) return json(400, { error: "Empty" }, headers);

  const messages = [];
  for (const h of history) {
    if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
      messages.push({ role: h.role, content: h.content.slice(0, 2000) });
    }
  }
  messages.push({
    role: "user",
    content: "CURRENT STATE:\n" + JSON.stringify(state).slice(0, 7000) + "\n\nUSER MESSAGE:\n" + userText
  });

  try {
    let { parsed, raw, error } = await callAnthropic(key, messages);
    if (error) return json(200, { say: "[" + error + "]", actions: [] }, headers);
    if (!parsed || typeof parsed !== "object") {
      // one corrective retry, per the brief
      const retryMessages = messages.concat([
        { role: "assistant", content: (raw || "").slice(0, 1500) },
        { role: "user", content: "Your last reply was not valid JSON. Respond again with ONLY the JSON object {\"say\":...,\"actions\":[...]} — no fences, no other text." }
      ]);
      const second = await callAnthropic(key, retryMessages);
      parsed = second.parsed;
      if (second.error || !parsed || typeof parsed !== "object") {
        return json(200, { say: "I hit a snag — try that again.", actions: [] }, headers);
      }
    }
    parsed.say = parsed.say || "";
    parsed.actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    // `caller` is resolved and verified here; task 1.3 uses caller.hid for per-household quotas.
    return json(200, parsed, headers);
  } catch (e) {
    return json(500, { error: "Companion error", detail: String(e).slice(0, 300) }, headers);
  }
};
