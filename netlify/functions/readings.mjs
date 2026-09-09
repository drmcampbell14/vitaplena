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

/** A reading as the app wants it: what it's called, where it's from, what it says. */
function reading(v) {
  if (!v) return null;
  const source = line(typeof v === "object" ? v.source : "");
  const body = paragraphs(v);
  if (!source && !body.length) return null;
  return { source, heading: line(typeof v === "object" ? v.heading : ""), body };
}

/** `universalisCallback({...})` to the shape the app renders, or null if it isn't that. */
export function parseUniversalis(raw, date) {
  const open = String(raw ?? "").indexOf("{"), close = String(raw ?? "").lastIndexOf("}");
  if (open < 0 || close <= open) return null;
  let u;
  try {
    u = JSON.parse(raw.slice(open, close + 1));
  } catch {
    return null;
  }
  return {
    date,
    day: line(u.day),
    readings: [
      ["First Reading", reading(u.Mass_R1)],
      ["Responsorial Psalm", reading(u.Mass_Ps)],
      ["Second Reading", reading(u.Mass_R2)],
      ["Gospel Acclamation", reading(u.Mass_GA)],
      ["Gospel", reading(u.Mass_G)]
    ].filter(([, r]) => r).map(([label, r]) => ({ label, ...r })),
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

export default async (req) => {
  if (req.method === "OPTIONS") return json({}, 204);

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") || "").replace(/-/g, "");
  if (!/^\d{8}$/.test(date)) return json({ error: "bad_date", message: "Pass ?date=YYYYMMDD." }, 400);

  let raw;
  try {
    const ctl = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
    const res = await fetch(`https://universalis.com/USA/${date}/jsonpmass.js`, {
      signal: ctl,
      headers: { "user-agent": "VitaPlena/5 (+https://vitaplena13.netlify.app)" }
    });
    if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
    raw = await res.text();
  } catch (e) {
    return json({ error: "upstream", message: String(e?.message || e) }, 502);
  }

  const out = parseUniversalis(raw, date);
  if (!out) return json({ error: "unparseable" }, 502);

  /* Today's readings never change once published, so let the edge hold them. */
  return json(out, 200, `public, max-age=${DAY}, s-maxage=${DAY}, stale-while-revalidate=${DAY}`);
};
