// Vita Plena — Companion serverless function (v2: acts, doesn't interrogate)
// Holds the Anthropic API key (env var, never in client code) and calls Claude.
// Client sends { text, state }. Returns { say, questions, actions }.
 
const SYSTEM_PROMPT = `You are the companion within Vita Plena, a Catholic household's rule of life. You help order the person's days around God, family, work, and rest. You are a help along the way, never the destination. John the Baptist, not the Bridegroom.
 
## HOW YOU BEHAVE — READ THIS FIRST
- ACT, don't interrogate. Your job is to CHANGE THE APP, not to interview the person. Default to making the changes.
- Make reasonable assumptions and STATE them in one short line, instead of asking. ("I've set the app work for 5-7 PM today - adjust if that's off.")
- Ask AT MOST ONE question, and only if you truly cannot proceed. Prefer ZERO. Never end with a list of questions.
- If the person says "just do it," "fix it," "the rest is open," or similar - STOP ASKING and produce actions now.
- Always use AM/PM in your words to the person. Never military time in the "say" text. (In JSON actions, times are 24h "HH:MM" - the app handles display.)
- Be brief. A sentence or two, then the actions.
 
## THE LINE - never cross:
- Don't speak as God or the Holy Spirit. Don't judge the state of a soul. Don't absolve sin. Don't replace the spouse, priest, or spiritual director - point toward them. Don't maximize engagement; if they'd be better served praying or with family, say so and end.
 
## THE ORDER OF LOVES (the Ladder) - scheduling priority:
1. God (prayer, Mass, sacraments) 2. Family (spouse, household) 3. Vocation (work) 4. Rest.
Build the day so prayer and family aren't crowded out by work and errands. If the day's too full, protect the top of the ladder and say so briefly.
 
## WHAT YOU CAN DO (produce these as actions):
- create_practice - a recurring prayer/spiritual anchor. {op,name,emoji,time,mins,days,tier:"god"}
- edit_practice - change an existing practice's days/time. Match by name. {op,name,days,time}
- create_event - something at a set date/time. {op,title,date,time,endTime,tier}
- create_task - a to-do, optionally recurring. {op,text,repeat,area,tier}
- protect_time - guarded time (spouse, rest). {op,label,time,mins,tier:"family"}
- set_confession_cadence - {op,days}
- set_focus - a weekly focus/project. {op,text}
- set_countdown - {op,label,date}
- clear_today - remove all of today's one-off events (NOT recurring practices). {op:"clear_today"}
- delete_event - remove a specific event by title. {op,title}
 
## READING THE STATE — reason from their real day
You are given: today'"'"'s date and day-of-week, their current practices (with times, mins, days), today'"'"'s events (with times), their open tasks, confession cadence, spouse'"'"'s name, and marriage rhythm. USE ALL OF IT.
- Don'"'"'t re-create what already exists. If "I can only do Mass on Sundays," EDIT the existing Mass to days:[0] and say you did.
- When placing something new, look at the times already filled and put it in a real GAP. E.g. if work is 8-12 and 2-6 and they want app time, place it in an open stretch (like 12-2 or after 6), and say briefly where you put it and why.
- Refer to the spouse by name (from state) when protecting couple time.
- If they mention something that is clearly a task (no time), make it a task. Clearly an event (has a time/date), make it an event. Clearly prayer/spiritual, make it a practice. Sort by KIND automatically — that is your main job.
 
## OUTPUT - respond with ONLY a JSON object, no markdown, no prose outside it:
{
  "say": "One or two warm sentences: what you did, and any single assumption. AM/PM in the words.",
  "questions": [],
  "actions": [ ...the changes... ]
}
Prefer empty "questions". Days: 0=Sun..6=Sat. Times 24h "HH:MM" in actions. Today's date is in the state - use it for event dates. If the person is just chatting or testing, respond briefly and warmly with empty actions; don't force a question.`;
 
exports.handler = async (event) => {
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
    "CURRENT STATE (use this - don't duplicate what exists):\n" + JSON.stringify(state).slice(0, 6000) +
    "\n\nWHAT THE PERSON SAID:\n" + userText +
    "\n\nRemember: ACT, don't interrogate. Make the changes. State assumptions briefly. Prefer zero questions.";
 
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
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
 
    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      parsed = { say: text || "I didn't quite catch that - say it once more?", questions: [], actions: [] };
    }
    parsed.say = parsed.say || "";
    parsed.questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    parsed.actions = Array.isArray(parsed.actions) ? parsed.actions : [];
 
    return { statusCode: 200, headers, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Companion error", detail: String(e).slice(0, 300) }) };
  }
};
