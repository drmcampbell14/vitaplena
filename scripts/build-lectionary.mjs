#!/usr/bin/env node
/* Vita Plena — build the lectionary index: which passages are read on which day.

   The text of the readings is the bundled Douay-Rheims; this file only says
   *which* passages, plus what the day is called. Citations are facts about what
   the Church prescribes, and the text we render is public domain, so nothing
   copyrighted is copied here or shipped.

   Source: cpbjr/catholic-readings-api (MIT), served as static JSON from GitHub
   Pages, one file per day, covering whole years. It replaced universalis.com,
   which by design publishes only yesterday, today and the week ahead — fine for
   a website, useless for an app that is compiled once and then lives on a phone
   for months. The old behaviour left an App Store build blank after two weeks.

   Output: public/data/lectionary/<year>.json, committed, so a Netlify deploy and
   an Xcode build both start from a full file. It runs before the Netlify build
   (see netlify.toml) and by hand on a Mac:

       node scripts/build-lectionary.mjs                          # a year ahead
       node scripts/build-lectionary.mjs 2026-11-29 2027-11-27    # a stated span

   It never fails the build: days it cannot fetch are left as they were, and it
   gives up quietly if the source is unreachable. Run it again later to fill gaps.

   Psalm citations arrive with modern (Masoretic) numbers. They are stored exactly
   as the source gives them; src/core/scripture.js re-numbers them to the Vulgate
   when it looks the passage up, which is where that rule is tested. */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://cpbjr.github.io/catholic-readings-api";
const OUT = path.resolve("public/data/lectionary");
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const [fromArg, toArg] = process.argv.slice(2);
const from = fromArg ? new Date(fromArg + "T12:00") : addDays(new Date(), -7);
const to = toArg ? new Date(toArg + "T12:00") : addDays(new Date(), 400);
if (process.env.LECTIONARY_SKIP) { console.log("lectionary: skipped (LECTIONARY_SKIP)"); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
const files = new Map();                      // year → { data, dirty }
const load = (y) => {
  if (!files.has(y)) {
    const f = path.join(OUT, `${y}.json`);
    files.set(y, { data: fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}, dirty: false });
  }
  return files.get(y);
};

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
};

/* The source names the readings by role; the app wants them labelled and in the
   order they are proclaimed. A weekday has no second reading, and the key is
   simply absent, so the filter below does the omitting. */
const ROLES = [
  ["firstReading", "First Reading"],
  ["psalm", "Responsorial Psalm"],
  ["secondReading", "Second Reading"],
  ["alleluia", "Gospel Acclamation"],
  ["gospel", "Gospel"]
];

/** One day as the app stores it, or null if the source has nothing usable. */
async function fetchDay(ds) {
  const [y, md] = [ds.slice(0, 4), ds.slice(5)];
  const [r, cal] = await Promise.all([
    getJson(`${BASE}/readings/${y}/${md}.json`).catch(() => null),
    getJson(`${BASE}/liturgical-calendar/${y}/${md}.json`).catch(() => null)
  ]);
  const src = r && r.readings;
  if (!src) return null;
  const readings = ROLES
    .map(([key, label]) => {
      let source = String(src[key] || "").replace(/\s+/g, " ").replace(/\.$/, "").trim();
      /* The feed sometimes drops the book name from a psalm and sends "137:1-2"
         on its own. The label says what it must be, so put it back. */
      if (source && label === "Responsorial Psalm" && /^\d/.test(source)) source = `Psalm ${source}`;
      return { label, source };
    })
    .filter((x) => x.source);
  if (!readings.length) return null;
  /* The day's name: the celebration when the calendar knows one, else the season,
     which is what the header falls back to anyway. */
  const day = cal?.celebration?.name || r.season || "";
  return { day, readings };
}

const wanted = [];
for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
  const ds = ymd(d);
  if (!load(d.getFullYear()).data[ds]) wanted.push(ds);
}
console.log(`lectionary: ${wanted.length} day(s) to fetch between ${ymd(from)} and ${ymd(to)}`);

let ok = 0, miss = 0, consecutiveMisses = 0;
const queue = wanted.slice();
async function worker() {
  while (queue.length) {
    if (consecutiveMisses >= 25) return;                  // the source is not answering; stop hammering it
    const ds = queue.shift();
    const entry = await fetchDay(ds).catch(() => null);
    if (entry) { const f = load(+ds.slice(0, 4)); f.data[ds] = entry; f.dirty = true; ok++; consecutiveMisses = 0; }
    else { miss++; consecutiveMisses++; }
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

for (const [y, f] of files) if (f.dirty) {
  const sorted = Object.fromEntries(Object.keys(f.data).sort().map((k) => [k, f.data[k]]));
  fs.writeFileSync(path.join(OUT, `${y}.json`), JSON.stringify(sorted));
}
const summary = [...files.keys()].sort().map((y) => `${y}.json (${Object.keys(files.get(y).data).length} days)`).join(", ");
console.log(`lectionary: ${ok} fetched, ${miss} missed${consecutiveMisses >= 25 ? " (stopped: source unreachable)" : ""}; files: ${summary || "none"}`);
process.exit(0);
