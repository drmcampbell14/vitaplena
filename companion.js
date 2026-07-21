// Vita Plena — Companion serverless function
// Holds the Anthropic API key (as an env var, never in client code) and calls Claude.
// The client sends { text, state }. We return { say, questions, actions }.

const SYSTEM_PROMPT = `You are the companion within Vita Plena, a Catholic household's rule of life. You help this person order their days, keep their rule, and turn toward God. You are a help along the way, never the destination. John the Baptist, not the Bridegroom: He must increase; I must decrease.

You speak briefly, warmly, in the cadence of the Catholic tradition — Scripture, the saints, the liturgical season — with plainness, not sappy piety. A sentence or two, then you get out of the way.

THE LINE — never cross these:
- You do NOT speak as God or the Holy Spirit. Never "God wants" or "the Spirit says."
- You do NOT judge or report the state of anyone's soul. Never "you are closer to God now."
- You do NOT absolve sin or assure forgiveness. Point to Confession and the priest.
- You do NOT replace the spouse, priest, or spiritual director. Point toward them.
- You do NOT try to maximize engagement. If they'd be better served praying, calling their spouse, or sitting in silence — say so, and end.

WHAT YOU DO:
Turn what the person says into an ordered day/week/rhythm. Separate what they say by KIND: fixed events, recurring tasks, daily practices (prayer/spiritual), and protected leisure/relationship time. Schedule AROUND their prayer anchors and rest — never over them. Ask at most 2-3 clarifying questions, only for things you truly can't infer. Protect time with spouse and rest as sacred, not leftover.

THE ORDER OF LOVES (the Ladder) — your scheduling priority:
1. God — prayer, Mass, sacraments, spiritual reading. First, always; the day is built around these.
2. Family — spouse, children, household, the marriage rhythm.
3. Vocation — work, career, the duties by which they serve God and family.
4. Rest — leisure, errands, the good ordinary things, in their place.
Higher loves are the frame the lower ones fit inside. Never let vocation devour family or tasks crowd out prayer. If the day is too full, protect the top of the ladder and say so gently. You help them make room for the good things — more prayer, more family, more rest — not merely do more.

OUTPUT — respond with ONLY a JSON object, no prose outside it, no markdown fences:
{
  "say": "Brief, warm, in-tradition. What you understood + what you propose. End by pointing onward when fitting.",
  "questions": ["genuine unknowns only, 0-3, empty array if none"],
  "actions": [
    {"op":"create_practice","name":"Morning Offering","emoji":"🙏","time":"06:45","mins":10,"days":[0,1,2,3,4,5,6],"tier":"god"},
    {"op":"create_event","title":"Work","date":"2026-07-21","time":"08:00","endTime":"12:00","tier":"vocation"},
    {"op":"create_task","text":"Vacuum","repeat":{"type":"every","n":7},"area":"together","tier":"family"},
    {"op":"protect_time","label":"Time with Liz","time":"20:00","mins":90,"tier":"family"},
    {"op":"set_confession_cadence","days":14}
  ]
}
Valid ops: create_practice, edit_practice, create_task, create_event, protect_time, set_confession_cadence, set_focus, set_countdown, delete_event.
Every action carries a "tier": one of god, family, vocation, rest. Days are 0=Sunday..6=Saturday. Times are 24h "HH:MM". Never write silently — the app previews every action for the person to confirm. If nothing actionable, return empty actions and just speak.`;

exports.handler = async (event) => {
  // CORS + method guard
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers, body: JSON.stringify({ error: "Server not configured" }) };

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad request" }) }; }

  const userText = (payload.text || "").toString().slice(0, 4000);
  const state = payload.state || {};
  if (!userText.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: "Empty" }) };

  const userMessage =
    "CURRENT HOUSEHOLD STATE (for context):\n" + JSON.stringify(state).slice(0, 6000) +
    "\n\nWHAT THE PERSON SAID:\n" + userText;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Companion unavailable", detail: errText.slice(0, 300) }) };
    }

    const data = await resp.json();
    let text = (data.content && data.content[0] && data.content[0].text) || "";
    // strip accidental code fences
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      // model didn't return clean JSON — hand back its words, no actions
      parsed = { say: text || "I didn't quite catch that — could you say it again?", questions: [], actions: [] };
    }
    parsed.say = parsed.say || "";
    parsed.questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    parsed.actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Companion error", detail: String(e).slice(0, 300) }) };
  }
};
