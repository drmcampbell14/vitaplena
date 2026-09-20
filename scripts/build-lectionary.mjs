#!/usr/bin/env node
/* Vita Plena — build the lectionary index: which passages are read on which day.

   The text of the readings is the bundled Douay-Rheims; this file only says
   *which* passages. It is generated from Universalis' day pages (title and
   citations, nothing else) into public/data/lectionary/<year>.json, so at run
   time the app never has to reach an outside site. It runs before the Netlify
   build (see netlify.toml) and can be run by hand on a Mac:

       node scripts/build-lectionary.mjs            # the next ~4 months
       node scripts/build-lectionary.mjs 2026-11-29 2027-11-27   # a whole year

   It never fails the build: days it cannot fetch are left as they were, and it
   stops early when the site is plainly unreachable. Run it again later and it
   fills the gaps. Commit the result so a deploy always starts from a full file. */
import fs from "node:fs";
import path from "node:path";
import { parseUniversalis } from "../netlify/functions/readings.mjs";

const OUT = path.resolve("public/data/lectionary");
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const [fromArg, toArg] = process.argv.slice(2);
const from = fromArg ? new Date(fromArg + "T12:00") : addDays(new Date(), -3);
const to = toArg ? new Date(toArg + "T12:00") : addDays(new Date(), 120);
if (process.env.LECTIONARY_SKIP) { console.log("lectionary: skipped (LECTIONARY_SKIP)"); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
const files = new Map();                      // year → { data, dirty }
const load = (y) => { if (!files.has(y)) { const f = path.join(OUT, `${y}.json`); files.set(y, { data: fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}, dirty: false }); } return files.get(y); };

async function fetchDay(ds) {
  const compact = ds.replace(/-/g, "");
  for (const src of [`https://universalis.com/USA/${compact}/jsonpmass.js`, `https://universalis.com/${compact}/jsonpmass.js`]) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 (compatible; VitaPlena/5; +https://vitaplena13.netlify.app)", accept: "*/*", referer: "https://universalis.com/" } });
      if (!res.ok) continue;
      const out = parseUniversalis(await res.text(), compact);
      if (out && out.readings.length) return { day: out.day, readings: out.readings.map((r) => ({ label: r.label, source: r.source })) };
    } catch { /* next source, then give up on this day */ }
  }
  return null;
}

const wanted = [];
for (let d = new Date(from); d <= to; d = addDays(d, 1)) { const ds = ymd(d); if (!load(d.getFullYear()).data[ds]) wanted.push(ds); }
console.log(`lectionary: ${wanted.length} day(s) to fetch between ${ymd(from)} and ${ymd(to)}`);

let ok = 0, miss = 0, consecutiveMisses = 0;
const queue = wanted.slice();
async function worker() {
  while (queue.length) {
    if (consecutiveMisses >= 8) return;                     // the site is not answering; stop hammering it
    const ds = queue.shift();
    const entry = await fetchDay(ds);
    if (entry) { const f = load(+ds.slice(0, 4)); f.data[ds] = entry; f.dirty = true; ok++; consecutiveMisses = 0; }
    else { miss++; consecutiveMisses++; }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

for (const [y, f] of files) if (f.dirty) {
  const sorted = Object.fromEntries(Object.keys(f.data).sort().map((k) => [k, f.data[k]]));
  fs.writeFileSync(path.join(OUT, `${y}.json`), JSON.stringify(sorted));
}
console.log(`lectionary: ${ok} fetched, ${miss} missed${consecutiveMisses >= 8 ? " (stopped: site unreachable)" : ""}; files: ${[...files.keys()].map((y) => `${y}.json (${Object.keys(files.get(y).data).length} days)`).join(", ") || "none"}`);
process.exit(0);
