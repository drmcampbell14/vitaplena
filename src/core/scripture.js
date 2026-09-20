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

const norm = (s) => String(s || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim()
  .replace(/^(first|1st|i)\s/, "1 ").replace(/^(second|2nd|ii)\s/, "2 ").replace(/^(third|3rd|iii)\s/, "3 ");
const LOOKUP = new Map();
for (const b of BOOKS) for (const n of [b.name, b.drc, ...b.alias]) LOOKUP.set(norm(n), b);

/** Find a book by any spelling a lectionary uses, or null. */
export function findBook(name) { return LOOKUP.get(norm(name)) || null; }

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
  /* Book name is everything up to the first digit that starts a chapter — but a
     leading ordinal ("1 Samuel") is part of the name. */
  const m = /^((?:[1-3]|I{1,3})?\s?[A-Za-z][A-Za-z .]*?)\s+(\d.*)$/.exec(s);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  let rest = m[2].trim();
  /* Psalm 144(145): the parenthesised number is the Hebrew count; the Douay
     follows the Vulgate, so the number outside the brackets is ours. */
  rest = rest.replace(/^(\d+)\s*\(\d+\)/, "$1").replace(/[a-z]\b/g, "").replace(/\bff\b/g, "");
  const ranges = [];
  let ch = null;
  for (const part of rest.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
    const cross = /^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/.exec(part);      // 12:31-13:13
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
  return { book, ranges, label: `${book.name} ${m[2].trim()}` };
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
