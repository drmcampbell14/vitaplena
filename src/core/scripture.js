/* Vita Plena — Scripture: the Catholic canon, citation parsing, passage lookup.

   Text is the Douay-Rheims (Challoner) — public domain, bundled under
   /data/drc/<id>.json, one file per book, fetched only when a passage is read.
   Citations arrive the way lectionaries write them ("Colossians 3:1-11",
   "Psalm 144(145):2-3, 8-9", "1 Corinthians 12:31–13:13", "Matthew 5:1-12a")
   and come out as verse ranges we can pull from the book file.

   Pure: no DOM, no fetch in here except the loader at the bottom, which takes
   the fetch function so tests can hand it a fake. */

/** The 73 books, in order. `drc` is the name scrollmapper's DRC file uses;
    `alias` are the spellings lectionaries and older Douay editions use. */
export const BOOKS = [
  ["gen", "Genesis", "Genesis", ["Gn", "Gen"]],
  ["exod", "Exodus", "Exodus", ["Ex", "Exod"]],
  ["lev", "Leviticus", "Leviticus", ["Lv", "Lev"]],
  ["num", "Numbers", "Numbers", ["Nm", "Num"]],
  ["deut", "Deuteronomy", "Deuteronomy", ["Dt", "Deut"]],
  ["josh", "Joshua", "Joshua", ["Jos", "Josh", "Josue"]],
  ["judg", "Judges", "Judges", ["Jgs", "Judg"]],
  ["ruth", "Ruth", "Ruth", ["Ru"]],
  ["1sam", "1 Samuel", "I Samuel", ["1 Sm", "1 Sam", "I Samuel", "1 Kings (Douay)", "1 Kgs (Douay)"]],
  ["2sam", "2 Samuel", "II Samuel", ["2 Sm", "2 Sam", "II Samuel"]],
  ["1kgs", "1 Kings", "I Kings", ["1 Kgs", "I Kings", "3 Kings"]],
  ["2kgs", "2 Kings", "II Kings", ["2 Kgs", "II Kings", "4 Kings"]],
  ["1chr", "1 Chronicles", "I Chronicles", ["1 Chr", "I Chronicles", "1 Paralipomenon"]],
  ["2chr", "2 Chronicles", "II Chronicles", ["2 Chr", "II Chronicles", "2 Paralipomenon"]],
  ["ezra", "Ezra", "Ezra", ["Ezr", "1 Esdras"]],
  ["neh", "Nehemiah", "Nehemiah", ["Neh", "2 Esdras"]],
  ["tob", "Tobit", "Tobit", ["Tb", "Tobias"]],
  ["jdt", "Judith", "Judith", ["Jdt"]],
  ["esth", "Esther", "Esther", ["Est"]],
  ["job", "Job", "Job", ["Jb"]],
  ["ps", "Psalms", "Psalms", ["Ps", "Psalm", "Pss"]],
  ["prov", "Proverbs", "Proverbs", ["Prv", "Prov"]],
  ["eccl", "Ecclesiastes", "Ecclesiastes", ["Eccl", "Qoheleth", "Qo"]],
  ["song", "Song of Songs", "Song of Solomon", ["Sg", "Song", "Canticle of Canticles", "Canticles", "Song of Solomon"]],
  ["wis", "Wisdom", "Wisdom", ["Wis", "Wisdom of Solomon"]],
  ["sir", "Sirach", "Sirach", ["Sir", "Ecclesiasticus", "Ecclus"]],
  ["isa", "Isaiah", "Isaiah", ["Is", "Isa", "Isaias"]],
  ["jer", "Jeremiah", "Jeremiah", ["Jer", "Jeremias"]],
  ["lam", "Lamentations", "Lamentations", ["Lam"]],
  ["bar", "Baruch", "Baruch", ["Bar"]],
  ["ezek", "Ezekiel", "Ezekiel", ["Ez", "Ezek", "Ezechiel"]],
  ["dan", "Daniel", "Daniel", ["Dn", "Dan"]],
  ["hos", "Hosea", "Hosea", ["Hos", "Osee"]],
  ["joel", "Joel", "Joel", ["Jl"]],
  ["amos", "Amos", "Amos", ["Am"]],
  ["obad", "Obadiah", "Obadiah", ["Ob", "Abdias"]],
  ["jon", "Jonah", "Jonah", ["Jon", "Jonas"]],
  ["mic", "Micah", "Micah", ["Mi", "Mic", "Micheas"]],
  ["nah", "Nahum", "Nahum", ["Na", "Nah"]],
  ["hab", "Habakkuk", "Habakkuk", ["Hb", "Hab", "Habacuc"]],
  ["zeph", "Zephaniah", "Zephaniah", ["Zep", "Zeph", "Sophonias"]],
  ["hag", "Haggai", "Haggai", ["Hg", "Hag", "Aggeus"]],
  ["zech", "Zechariah", "Zechariah", ["Zec", "Zech", "Zacharias"]],
  ["mal", "Malachi", "Malachi", ["Mal", "Malachias"]],
  ["1macc", "1 Maccabees", "I Maccabees", ["1 Mc", "1 Macc", "I Maccabees", "1 Machabees"]],
  ["2macc", "2 Maccabees", "II Maccabees", ["2 Mc", "2 Macc", "II Maccabees", "2 Machabees"]],
  ["matt", "Matthew", "Matthew", ["Mt", "Matt"]],
  ["mark", "Mark", "Mark", ["Mk"]],
  ["luke", "Luke", "Luke", ["Lk"]],
  ["john", "John", "John", ["Jn"]],
  ["acts", "Acts", "Acts", ["Acts of the Apostles"]],
  ["rom", "Romans", "Romans", ["Rom"]],
  ["1cor", "1 Corinthians", "I Corinthians", ["1 Cor", "I Corinthians"]],
  ["2cor", "2 Corinthians", "II Corinthians", ["2 Cor", "II Corinthians"]],
  ["gal", "Galatians", "Galatians", ["Gal"]],
  ["eph", "Ephesians", "Ephesians", ["Eph"]],
  ["phil", "Philippians", "Philippians", ["Phil"]],
  ["col", "Colossians", "Colossians", ["Col"]],
  ["1thess", "1 Thessalonians", "I Thessalonians", ["1 Thes", "1 Thess", "I Thessalonians"]],
  ["2thess", "2 Thessalonians", "II Thessalonians", ["2 Thes", "2 Thess", "II Thessalonians"]],
  ["1tim", "1 Timothy", "I Timothy", ["1 Tm", "1 Tim", "I Timothy"]],
  ["2tim", "2 Timothy", "II Timothy", ["2 Tm", "2 Tim", "II Timothy"]],
  ["titus", "Titus", "Titus", ["Ti", "Tit"]],
  ["phlm", "Philemon", "Philemon", ["Phlm", "Philem"]],
  ["heb", "Hebrews", "Hebrews", ["Heb"]],
  ["jas", "James", "James", ["Jas"]],
  ["1pet", "1 Peter", "I Peter", ["1 Pt", "1 Pet", "I Peter"]],
  ["2pet", "2 Peter", "II Peter", ["2 Pt", "2 Pet", "II Peter"]],
  ["1john", "1 John", "I John", ["1 Jn", "I John"]],
  ["2john", "2 John", "II John", ["2 Jn", "II John"]],
  ["3john", "3 John", "III John", ["3 Jn", "III John"]],
  ["jude", "Jude", "Jude", []],
  ["rev", "Revelation", "Revelation of John", ["Rv", "Rev", "Apocalypse", "Apoc", "Revelation of John"]]
].map(([id, name, drc, alias]) => ({ id, name, drc, alias }));

/* ---------------- psalm numbering ----------------

   The Douay-Rheims follows the Vulgate's psalm numbers; modern lectionaries — and
   every citation feed built from them — follow the Masoretic. They agree for
   Psalms 1-8 and 148-150 and disagree everywhere between, because the Vulgate
   joins Masoretic 9 and 10 into one psalm and joins 114 and 115, while splitting
   Masoretic 116 and 147 in two. Get this wrong and the responsorial psalm is not
   merely off by a verse, it is a different psalm: Masoretic 145 ("Every day will
   I bless thee") is Douay 144, while Douay 145 is "Put not your trust in princes".

   Citations that carry both numbers — "Psalm 144(145)" — say outright which is
   which and never come through here; parseCitation keeps the outer, Vulgate one.
   A bare number is Masoretic and is mapped below. Boundaries verified against the
   bundled text: Douay 9 runs to 39 verses (9:22 = Masoretic 10:1) and Douay 113
   to 26 (113:9 = Masoretic 115:1). */

/** One Masoretic psalm verse as the Vulgate numbers it. @returns {{ch:number, v:number}} */
export function toVulgatePsalm(ch, v) {
  if (ch === 10) return { ch: 9, v: v + 21 };
  if (ch === 115) return { ch: 113, v: v + 8 };
  if (ch === 116) return v <= 9 ? { ch: 114, v } : { ch: 115, v: v - 9 };
  if (ch === 147) return v <= 11 ? { ch: 146, v } : { ch: 147, v: v - 11 };
  if (ch === 114) return { ch: 113, v };
  if ((ch >= 11 && ch <= 113) || (ch >= 117 && ch <= 146)) return { ch: ch - 1, v };
  return { ch, v };                                   // 1-9 and 148-150 agree
}

/** A whole Masoretic psalm as Vulgate ranges (a merge covers only part of its chapter). */
const WHOLE_PSALM = {
  10: [{ ch: 9, from: 22, to: null }],
  114: [{ ch: 113, from: 1, to: 8 }],
  115: [{ ch: 113, from: 9, to: null }],
  116: [{ ch: 114, from: 1, to: null }, { ch: 115, from: 1, to: null }],
  147: [{ ch: 146, from: 1, to: null }, { ch: 147, from: 1, to: null }]
};

/** Re-number parsed ranges from Masoretic to Vulgate, splitting any that straddle a join. */
export function vulgatiseRanges(ranges) {
  const out = [];
  for (const r of ranges) {
    if (r.from === 1 && r.to === null && WHOLE_PSALM[r.ch]) { out.push(...WHOLE_PSALM[r.ch].map((x) => ({ ...x }))); continue; }
    const a = toVulgatePsalm(r.ch, r.from);
    if (r.to === null) { out.push({ ch: a.ch, from: a.v, to: WHOLE_PSALM[r.ch] ? WHOLE_PSALM[r.ch][0].to : null }); continue; }
    const b = toVulgatePsalm(r.ch, r.to);
    if (a.ch === b.ch) { out.push({ ch: a.ch, from: a.v, to: b.v }); continue; }
    out.push({ ch: a.ch, from: a.v, to: null }, { ch: b.ch, from: 1, to: b.v });   // straddles the join
  }
  return out;
}

/* ---------------- where the Vulgate divides books differently ----------------

   The psalter is the big one (above), but three other books are numbered apart
   in the Douay, and each shows up in the lectionary. Verified verse by verse
   against the bundled text:

     Joel        modern chapter 3 is Douay 2:28-32, and modern 4 is Douay 3.
     Zechariah   modern 2:1-4 is Douay 1:18-21; modern 2:5-17 is Douay 2:1-13.
     Esther      the Greek additions, which modern lectionaries letter A-F, sit
                 in the Douay as chapters 10:4-16. "Esther C:12" is Douay 14:1. */

/** Modern chapter-and-verse → Douay, for the books that need it. Psalms are separate. */
const DIVERGENT = {
  joel: (ch, v) => (ch === 4 ? { ch: 3, v } : ch === 3 ? { ch: 2, v: v + 27 } : { ch, v }),
  zech: (ch, v) => (ch === 2 ? (v <= 4 ? { ch: 1, v: v + 17 } : { ch: 2, v: v - 4 }) : { ch, v })
};

/** The lettered Greek additions to Esther, as Douay chapter and verse. */
const ESTHER_ADDITION = {
  A: (v) => (v <= 11 ? { ch: 11, v: v + 1 } : { ch: 12, v: v - 11 }),
  B: (v) => ({ ch: 13, v }),
  C: (v) => (v <= 11 ? { ch: 13, v: v + 7 } : { ch: 14, v: v - 11 }),
  D: (v) => ({ ch: 15, v: v + 3 }),
  E: (v) => ({ ch: 16, v }),
  F: (v) => (v <= 10 ? { ch: 10, v: v + 3 } : { ch: 11, v: v - 10 })
};

/** Re-number ranges for a book the Douay divides differently, splitting where it must. */
function divergeRanges(map, ranges) {
  const out = [];
  for (const r of ranges) {
    const a = map(r.ch, r.from);
    if (r.to === null) { out.push({ ch: a.ch, from: a.v, to: null }); continue; }
    const b = map(r.ch, r.to);
    if (a.ch === b.ch) out.push({ ch: a.ch, from: a.v, to: b.v });
    else out.push({ ch: a.ch, from: a.v, to: null }, { ch: b.ch, from: 1, to: b.v });
  }
  return out;
}

/** Books of a single chapter: a bare number in their citations is a verse. */
export const SINGLE_CHAPTER = new Set(["phlm", "jude", "obad", "2john", "3john"]);

const norm = (s) => String(s || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim()
  .replace(/^(first|1st|i)\s/, "1 ").replace(/^(second|2nd|ii)\s/, "2 ").replace(/^(third|3rd|iii)\s/, "3 ");
const LOOKUP = new Map();
for (const b of BOOKS) for (const n of [b.name, b.drc, ...b.alias]) LOOKUP.set(norm(n), b);

/** Levenshtein distance, capped: we only care whether it is small. */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Find a book by any spelling a lectionary uses, or null.

    Feeds are typed by hand and misspell book names ("Phiippians", "Sirarch"), so
    an exact miss falls back to the nearest spelling within two edits. It must be
    a clear winner: two books the same distance away means we admit we don't know
    rather than guess, which is why 1/2/3 John and the like stay safe. */
export function findBook(name) {
  const key = norm(name);
  const hit = LOOKUP.get(key);
  if (hit) return hit;
  if (key.length < 5) return null;                       // too short to correct safely
  let best = null, bestD = 3, tie = false;
  for (const [spelling, book] of LOOKUP) {
    const d = editDistance(key, spelling);
    if (d < bestD) { bestD = d; best = book; tie = false; }
    else if (d === bestD && book !== best) tie = true;
  }
  return best && !tie ? best : null;
}

/**
 * Parse one citation into verse ranges.
 * "Psalm 144(145):2-3, 8-9" → book ps, [{ch:144, from:2, to:3}, {ch:144, from:8, to:9}]
 * "1 Corinthians 12:31–13:13" → [{ch:12, from:31, to:null}, {ch:13, from:1, to:13}]
 * "Matthew 5:1-12a" → letters dropped. "Psalm 150" → the whole chapter.
 * Alternatives ("A or B") keep A. Returns null when no book is recognised.
 * @returns {{book:object, ranges:{ch:number, from:number, to:number|null}[], label:string}|null}
 */
export function parseCitation(text) {
  let s = String(text || "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  if (!s) return null;
  s = s.split(/\s+or\s+/i)[0].trim();
  s = s.replace(/^(?:cf\.?|see|from)\s+/i, "");            // "cf. John 6:63" — the acclamation's usual form
  /* Lectionary feeds are typed by hand and arrive scuffed. Tidy the punctuation
     before anything tries to read meaning out of it: a space after the colon
     ("Matthew 15: 21-28"), "and" used as a list separator ("6 and 8ab, 16bc and
     17"), and part-verse letters detached from their number ("51:12 cd-20"). */
  s = s.replace(/:\s+/g, ":").replace(/\s+and\s+/gi, ", ").replace(/(\d)\s+([a-z]{1,4})\b/g, "$1$2");
  /* "Esther C:12, 14-16" — a lettered Greek addition. It has no chapter number
     to parse, so it is resolved here and returned before the usual machinery. */
  const greek = /^esther\s+([A-F]):(.+)$/i.exec(s);
  if (greek) {
    const map = ESTHER_ADDITION[greek[1].toUpperCase()];
    const book = findBook("Esther");
    const ranges = [];
    for (const part of greek[2].replace(/(\d)[a-zA-Z]+\b/g, "$1").split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
      const span = /^(\d+)\s*-\s*(\d+)$/.exec(part), one = /^(\d+)$/.exec(part);
      if (span) { const a = map(+span[1]), b = map(+span[2]); ranges.push(a.ch === b.ch ? { ch: a.ch, from: a.v, to: b.v } : { ch: a.ch, from: a.v, to: null }); }
      else if (one) { const a = map(+one[1]); ranges.push({ ch: a.ch, from: a.v, to: a.v }); }
    }
    return ranges.length ? { book, ranges, label: `Esther ${greek[1].toUpperCase()}:${greek[2].trim()}` } : null;
  }
  /* Book name is everything up to the first digit that starts a chapter — but a
     leading ordinal ("1 Samuel") is part of the name. */
  const m = /^((?:[1-3]|I{1,3})?\s?[A-Za-z][A-Za-z .]*?)\s+(\d.*)$/.exec(s);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  let rest = m[2].trim();
  /* Psalm 144(145): the parenthesised number is the Hebrew count; the Douay
     follows the Vulgate, so the number outside the brackets is ours. A psalm
     cited with a bare number came from a modern lectionary and is Masoretic —
     remember that, and re-number it once the ranges are parsed. */
  const dual = /^\d+\s*\(\d+\)/.test(rest);
  /* Part-verse letters mark where a reading starts or stops inside a verse
     ("1-16a", "19A; 12:1-6A, 10AB", "1bcde"). We read whole verses, so a run of
     them after a number is dropped however long it is and whichever case it is
     in — the old rule only knew how to drop one lowercase letter at a time. */
  rest = rest.replace(/^(\d+)\s*\(\d+\)/, "$1").replace(/(\d)[a-zA-Z]+\b/g, "$1").replace(/\bff\b/g, "");
  const ranges = [];
  /* Philemon, Jude, Obadiah, 2 and 3 John have one chapter each, so their
     citations name verses directly ("Philemon 7-20"). Everywhere else a bare
     range means chapters. */
  const oneChapter = SINGLE_CHAPTER.has(book.id);
  let ch = oneChapter ? 1 : null;
  for (const part of rest.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
    /* 12:31-13:13. The trailing group swallows a stray "-2" of the kind the feed
       sends in "Jonah 1:1-2:1-2, 11", where the reading really ends at 2:1. */
    const cross = /^(\d+):(\d+)\s*-\s*(\d+):(\d+)(?:\s*-\s*\d+)?$/.exec(part);
    const span = /^(\d+):(\d+)\s*-\s*(\d+)$/.exec(part);              // 3:1-11
    const one = /^(\d+):(\d+)$/.exec(part);                           // 6:1
    const cont = /^(\d+)\s*-\s*(\d+)$/.exec(part);                     // 8-9 (after a chapter)
    const single = /^(\d+)$/.exec(part);                              // 150 (whole chapter) or a verse
    if (cross) { ch = +cross[3]; ranges.push({ ch: +cross[1], from: +cross[2], to: null }, { ch: +cross[3], from: 1, to: +cross[4] }); }
    else if (span) { ch = +span[1]; ranges.push({ ch, from: +span[2], to: +span[3] }); }
    else if (one) { ch = +one[1]; ranges.push({ ch, from: +one[2], to: +one[2] }); }
    else if (cont && ch !== null) ranges.push({ ch, from: +cont[1], to: +cont[2] });
    else if (cont) { for (let c = +cont[1]; c <= +cont[2]; c++) ranges.push({ ch: c, from: 1, to: null }); }
    else if (single && ch !== null) ranges.push({ ch, from: +single[1], to: +single[1] });
    else if (single) { ch = +single[1]; ranges.push({ ch, from: 1, to: null }); }
  }
  if (!ranges.length) return null;
  const final = book.id === "ps"
    ? (dual ? ranges : vulgatiseRanges(ranges))
    : (DIVERGENT[book.id] ? divergeRanges(DIVERGENT[book.id], ranges) : ranges);
  return { book, ranges: final, label: `${book.name} ${m[2].trim()}` };
}

/**
 * Pull the verses a parsed citation names out of a book file.
 * @param {{chapters:string[][]}} bookData  the /data/drc/<id>.json contents
 * @returns {{ch:number, v:number, text:string}[]} in reading order; empty if nothing matched
 */
export function versesFor(bookData, ranges) {
  const out = [];
  for (const r of ranges) {
    const verses = bookData.chapters[r.ch - 1] || [];
    const to = r.to === null ? verses.length : Math.min(r.to, verses.length);
    for (let v = r.from; v <= to; v++) { const t = verses[v - 1]; if (t) out.push({ ch: r.ch, v, text: t }); }
  }
  return out;
}

/* ---------------- loading ---------------- */
const cache = new Map();
/** Fetch (and remember) one book. `fetcher` defaults to window.fetch; tests pass their own. */
export async function loadBook(id, fetcher = (typeof fetch === "function" ? fetch : null)) {
  if (cache.has(id)) return cache.get(id);
  if (!fetcher) throw new Error("no fetch");
  const p = fetcher(`/data/drc/${id}.json`).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}
/** A citation string → { label, verses } from the bundled Douay-Rheims, or null if unrecognised. */
export async function passage(citation, fetcher) {
  const c = parseCitation(citation);
  if (!c) return null;
  const data = await loadBook(c.book.id, fetcher);
  return { label: c.label, book: c.book.name, verses: versesFor(data, c.ranges) };
}
