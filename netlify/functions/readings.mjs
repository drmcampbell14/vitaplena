/* Vita Plena — the day's Mass readings.
   Universalis publishes them as JSONP, meant to be loaded with a <script> tag.
   Doing that from the app is fragile: iOS content blockers and privacy extensions
   drop third-party scripts, a stalled request never fires an error, and the payload
   arrives as HTML with entities in it. So we fetch it here instead, on the server,
   where none of that applies, and hand the app clean JSON with CORS.

   Public on purpose: today's readings are public knowledge and cost nothing to
   serve. Responses are cached at the edge for the rest of the day. */

const DAY = 86400;

/* Entities Universalis actually emits, plus the numeric forms. Kept in step with
   unentity() in src/core/util.js; this file must stay dependency-free for Netlify. */
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö",
  auml: "ä", iacute: "í", oacute: "ó", aacute: "á", uacute: "ú", ntilde: "ñ",
  deg: "°", sect: "§", dagger: "†", bull: "•", middot: "·", times: "×",
  copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»", prime: "′" };

function unentity(s) {
  return String(s ?? "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
    if (body[0] === "#") {
      const n = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    const c = ENTITIES[body] ?? ENTITIES[body.toLowerCase()];
    return c === undefined ? m : c;
  });
}

/** One clean line: no tags, no entities, no runs of whitespace. */
function line(v) {
  const raw = v && typeof v === "object" ? (v.text ?? v.source ?? "") : v;
  return unentity(String(raw ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/** Reading body as paragraphs: entities decoded, markup dropped, verse numbers gone. */
function paragraphs(v) {
  const raw = v && typeof v === "object" ? (v.text ?? "") : (v ?? "");
  return unentity(String(raw)
    .replace(/<\/(?:p|div|h[1-6])>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, ""))
    .replace(/[ \t ]+/g, " ")
    .split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
}

/** A reading as the app wants it: what it's called, where it's from, what it says.
    @returns {{source:string, heading:string, body:string[]}|null} */
function reading(v) {
  if (!v) return null;
  const source = line(typeof v === "object" ? v.source : "");
  const body = paragraphs(v);
  if (!source && !body.length) return null;
  return { source, heading: line(typeof v === "object" ? v.heading : ""), body };
}

/* Universalis does not serve JSON. It serves a JavaScript expression, and the long
   strings inside it are compressed: a single letter stands in for a phrase that
   repeats, and the expansion rides along as a chain of calls on the literal.

     "...the translatq&#x201c;Roman Missal&#x201d;k2010...".split("q").join("ion of ").split("k").join(" &#xa9; ")

   The chain is order-dependent and it feeds itself: one replacement can introduce
   the letter that a later replacement expands, and the same letter can appear twice
   in one chain meaning different things both times. So the calls have to be applied
   strictly left to right, exactly as a browser running the script would.

   We fold those chains back down to plain string literals and hand the result to
   JSON.parse. Running the payload instead — eval, new Function — would give a third
   party arbitrary code execution inside our function, so we never do that. */

/** Read the JavaScript string literal whose opening quote is at `s[i]`.
    @param {string} s @param {number} i
    @returns {[string, number]} the decoded text, and the index just past the closing quote. */
function readLiteral(s, i) {
  const quote = s[i];
  let out = "";
  for (i += 1; i < s.length; i++) {
    const c = s[i];
    if (c === quote) return [out, i + 1];
    if (c !== "\\") { out += c; continue; }
    const esc = s[i + 1];
    if (esc === "u") { out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 5; continue; }
    out += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" })[esc] ?? esc;   // \\ and \" fall through as themselves
    i += 1;
  }
  return [out, i];                                                          // unterminated: JSON.parse will reject it
}

/** Apply every `.split("a").join("b")` hanging off a literal, in order.
    @param {string} s @param {string} value @param {number} i
    @returns {[string, number]} the expanded text, and the index just past the last call. */
function applyChain(s, value, i) {
  for (;;) {
    const split = /^\s*\.split\(\s*["']/.exec(s.slice(i));
    if (!split) return [value, i];
    let [sep, j] = readLiteral(s, i + split[0].length - 1);
    const join = /^\s*\)\s*\.join\(\s*["']/.exec(s.slice(j));
    if (!join) return [value, i];
    let [rep, k] = readLiteral(s, j + join[0].length - 1);
    const close = /^\s*\)/.exec(s.slice(k));
    if (!close) return [value, i];
    value = value.split(sep).join(rep);
    i = k + close[0].length;
  }
}

/** The payload with its substitution chains folded away, so it is plain JSON again.
    Anything that is not a double-quoted literal is copied through untouched.
    @param {string} s */
function foldSubstitutions(s) {
  let out = "";
  for (let i = 0; i < s.length;) {
    if (s[i] !== '"') { out += s[i]; i += 1; continue; }
    let [value, j] = readLiteral(s, i);
    [value, i] = applyChain(s, value, j);
    out += JSON.stringify(value);
  }
  return out;
}

/** `universalisCallback({...})` to the shape the app renders, or null if it isn't that. */
export function parseUniversalis(raw, date) {
  const s = String(raw ?? "");
  const open = s.indexOf("{"), close = s.lastIndexOf("}");
  if (open < 0 || close <= open) return null;
  const body = s.slice(open, close + 1);
  let u;
  try {
    u = JSON.parse(body);                      // a plain payload, or a day with nothing to compress
  } catch {
    try {
      u = JSON.parse(foldSubstitutions(body)); // the usual case: substitution chains to fold first
    } catch {
      return null;
    }
  }
  return {
    date,
    day: line(u.day),
    readings: /** @type {[string, ReturnType<typeof reading>][]} */ ([
      ["First Reading", reading(u.Mass_R1)],
      ["Responsorial Psalm", reading(u.Mass_Ps)],
      ["Second Reading", reading(u.Mass_R2)],
      ["Gospel Acclamation", reading(u.Mass_GA)],
      ["Gospel", reading(u.Mass_G)]
    ]).flatMap(([label, r]) => (r ? [{ label, source: r.source, heading: r.heading, body: r.body }] : [])),
    copyright: line(u.copyright)
  };
}

const json = (obj, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });

/** One plain line for the card: the most useful thing that went wrong. */
function summarise(tried) {
  const t = tried[0] || {};
  if (!tried.length) return "No address answered.";
  if (t.status === 0) return /Timeout|abort/i.test(t.snippet) ? "Universalis took too long to answer." : "Could not reach Universalis: " + t.snippet.trim();
  return `Universalis answered ${t.status}.`;
}

export default async (req) => {
  if (req.method === "OPTIONS") return json({}, 204);

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") || "").replace(/-/g, "");
  if (!/^\d{8}$/.test(date)) return json({ error: "bad_date", message: "Pass ?date=YYYYMMDD." }, 400);

  /* Two addresses: the US calendar, then the General Roman one if that fails.
     A synchronous Netlify function is cut off at 10 seconds, so each try gets a
     short leash rather than one long one. Whatever goes wrong is reported in
     the JSON — status, a snippet of the reply, which address — so the card in
     the app can show a reason instead of "didn't load", and Mitch can read it
     to me. */
  const sources = [`https://universalis.com/USA/${date}/jsonpmass.js`, `https://universalis.com/${date}/jsonpmass.js`];
  const tried = [];
  let out = null;
  for (const src of sources) {
    try {
      const res = await fetch(src, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; VitaPlena/5; +https://vitaplena13.netlify.app)",
          "accept": "*/*",
          "referer": "https://universalis.com/"
        }
      });
      const body = await res.text();
      if (!res.ok) { tried.push({ src, status: res.status, snippet: body.slice(0, 120) }); continue; }
      out = parseUniversalis(body, date);
      if (out) { out.via = src.includes("/USA/") ? "USA" : "general"; break; }
      tried.push({ src, status: res.status, snippet: "unparseable: " + body.slice(0, 120) });
    } catch (e) {
      tried.push({ src, status: 0, snippet: String(e?.name || "") + " " + String(e?.message || e) });
    }
  }
  if (!out) return json({ error: "upstream", reason: summarise(tried), tried }, 502);

  /* Today's readings never change once published, so let the edge hold them. */
  return json(out, 200, `public, max-age=${DAY}, s-maxage=${DAY}, stale-while-revalidate=${DAY}`);
};
