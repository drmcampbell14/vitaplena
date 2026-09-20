#!/usr/bin/env node
/* Vita Plena — split a scrollmapper Bible JSON into one small file per book.

   Usage:  node scripts/build-bible.mjs <path/to/DRC.json>

   Source: github.com/scrollmapper/bible_databases, formats/json/DRC.json — the
   Douay-Rheims Bible, Challoner revision. Public domain. We keep the 73 books
   of the Catholic canon and drop the five extras the source carries (Prayer of
   Manasses, I/II Esdras, the Additional Psalm, Laodiceans).

   Output: public/data/drc/<id>.json  — { id, name, chapters: [[verse, ...], ...] }
           public/data/drc/index.json — [{ id, name, chapters, verses }]
   Chapters and verses are 1-based in citations and 0-based in the arrays. A
   missing verse number leaves "" in its slot so indexes stay honest. */
import fs from "node:fs";
import path from "node:path";
import { BOOKS } from "../src/core/scripture.js";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/build-bible.mjs <DRC.json>"); process.exit(1); }
const out = path.resolve("public/data/drc");
fs.mkdirSync(out, { recursive: true });

const data = JSON.parse(fs.readFileSync(src, "utf8"));
const byName = new Map(data.books.map((b) => [b.name, b]));
const index = [];
let total = 0;
for (const book of BOOKS) {
  const b = byName.get(book.drc);
  if (!b) { console.error("missing in source:", book.drc); process.exit(1); }
  const chapters = [];
  for (const ch of b.chapters) {
    const verses = [];
    for (const v of ch.verses) verses[v.verse - 1] = String(v.text || "").replace(/\s+/g, " ").trim();
    for (let i = 0; i < verses.length; i++) if (verses[i] === undefined) verses[i] = "";
    chapters[ch.chapter - 1] = verses;
  }
  for (let i = 0; i < chapters.length; i++) if (!chapters[i]) chapters[i] = [];
  const verses = chapters.reduce((n, c) => n + c.filter(Boolean).length, 0);
  total += verses;
  fs.writeFileSync(path.join(out, book.id + ".json"), JSON.stringify({ id: book.id, name: book.name, chapters }));
  index.push({ id: book.id, name: book.name, chapters: chapters.length, verses });
}
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify({ translation: "Douay-Rheims Bible, Challoner Revision", books: index }));
console.log(`${index.length} books, ${total} verses → ${out}`);
