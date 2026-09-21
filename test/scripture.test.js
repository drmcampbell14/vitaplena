import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { BOOKS, findBook, parseCitation, versesFor, passage } from "../src/core/scripture.js";

/* The parser is tested against the citations lectionaries actually write, and
   the lookups run against the real generated Douay-Rheims files, so a broken
   split or a wrong book name fails here before it reaches a phone. */
const fakeFetch = async (url) => {
  const p = "public" + url;
  if (!fs.existsSync(p)) return { ok: false, status: 404 };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};

describe("the canon", () => {
  it("has the 73 books, each with a generated file", () => {
    expect(BOOKS).toHaveLength(73);
    for (const b of BOOKS) expect(fs.existsSync(`public/data/drc/${b.id}.json`)).toBe(true);
  });
  it("finds books by lectionary, Douay and abbreviated spellings", () => {
    expect(findBook("Sirach").id).toBe("sir");
    expect(findBook("Ecclesiasticus").id).toBe("sir");
    expect(findBook("Revelation").id).toBe("rev");
    expect(findBook("Apocalypse").id).toBe("rev");
    expect(findBook("1 Samuel").id).toBe("1sam");
    expect(findBook("I Samuel").id).toBe("1sam");
    expect(findBook("First Corinthians").id).toBe("1cor");
    expect(findBook("Song of Songs").id).toBe("song");
    expect(findBook("Canticle of Canticles").id).toBe("song");
    expect(findBook("Psalm").id).toBe("ps");
    expect(findBook("Acts of the Apostles").id).toBe("acts");
    expect(findBook("Nonsense")).toBeNull();
  });
});

describe("parseCitation()", () => {
  it("a plain range", () => {
    const c = parseCitation("Colossians 3:1-11");
    expect(c.book.id).toBe("col");
    expect(c.ranges).toEqual([{ ch: 3, from: 1, to: 11 }]);
  });
  it("a psalm with both numberings keeps the Vulgate number the Douay uses", () => {
    const c = parseCitation("Psalm 144(145):2-3, 8-9, 10-11");
    expect(c.book.id).toBe("ps");
    expect(c.ranges).toEqual([{ ch: 144, from: 2, to: 3 }, { ch: 144, from: 8, to: 9 }, { ch: 144, from: 10, to: 11 }]);
  });
  it("a whole chapter, and a chapter with one verse", () => {
    expect(parseCitation("Psalm 150").ranges).toEqual([{ ch: 150, from: 1, to: null }]);
    expect(parseCitation("Psalm 22(23)").ranges).toEqual([{ ch: 22, from: 1, to: null }]);
    expect(parseCitation("John 6:63").ranges).toEqual([{ ch: 6, from: 63, to: 63 }]);
  });
  it("crosses a chapter boundary", () => {
    expect(parseCitation("1 Corinthians 12:31–13:13").ranges)
      .toEqual([{ ch: 12, from: 31, to: null }, { ch: 13, from: 1, to: 13 }]);
  });
  it("drops verse letters, 'cf.', and takes the first of alternatives", () => {
    expect(parseCitation("Matthew 5:1-12a").ranges).toEqual([{ ch: 5, from: 1, to: 12 }]);
    expect(parseCitation("cf. John 6:63").book.id).toBe("john");
    expect(parseCitation("John 1:1-18 or 1:1-5, 9-14").ranges).toEqual([{ ch: 1, from: 1, to: 18 }]);
  });
  it("mixed separators and a verse list", () => {
    expect(parseCitation("1 Corinthians 15:12, 16-20").ranges)
      .toEqual([{ ch: 15, from: 12, to: 12 }, { ch: 15, from: 16, to: 20 }]);
    expect(parseCitation("Isaiah 55:10-11; 56:1").ranges)
      .toEqual([{ ch: 55, from: 10, to: 11 }, { ch: 56, from: 1, to: 1 }]);
  });
  it("returns null for junk rather than a wrong passage", () => {
    expect(parseCitation("")).toBeNull();
    expect(parseCitation("Reading")).toBeNull();
    expect(parseCitation("Book of Kells 3:1")).toBeNull();
  });
});

describe("the text itself", () => {
  it("Luke 6:20-26 is seven verses of the Beatitudes, in order", async () => {
    const p = await passage("Luke 6:20-26", fakeFetch);
    expect(p.book).toBe("Luke");
    expect(p.verses).toHaveLength(7);
    expect(p.verses[0]).toMatchObject({ ch: 6, v: 20 });
    expect(p.verses[0].text).toMatch(/Blessed are ye poor/);
    expect(p.verses[6].v).toBe(26);
  });
  it("Psalm 22 (Vulgate) is 'The Lord ruleth me' — the 23rd in Hebrew numbering", async () => {
    const p = await passage("Psalm 22(23)", fakeFetch);
    expect(p.verses[0].text).toMatch(/The Lord ruleth me/);
    expect(p.verses.length).toBe(6);
  });
  it("crossing chapters keeps reading order", async () => {
    const p = await passage("1 Corinthians 12:31–13:13", fakeFetch);
    expect(p.verses[0]).toMatchObject({ ch: 12, v: 31 });
    expect(p.verses[1]).toMatchObject({ ch: 13, v: 1 });
    expect(p.verses[p.verses.length - 1]).toMatchObject({ ch: 13, v: 13 });
    expect(p.verses.some((x) => /charity/.test(x.text))).toBe(true);   // the Douay's word for love
  });
  it("Genesis 1:1 reads as the Douay", async () => {
    const p = await passage("Genesis 1:1", fakeFetch);
    expect(p.verses[0].text).toBe("In the beginning God created heaven, and earth.");
  });
  it("a range past the end of a chapter is clipped, not padded", () => {
    const data = { chapters: [["a", "b", "c"]] };
    expect(versesFor(data, [{ ch: 1, from: 2, to: 99 }]).map((x) => x.v)).toEqual([2, 3]);
    expect(versesFor(data, [{ ch: 5, from: 1, to: null }])).toEqual([]);
  });
});

/* Psalm numbering is the one place where a silent off-by-one shows the family
   the wrong psalm at Mass, so these run against the real Douay text and check
   the words, not just the numbers. The pairs come from Universalis, which prints
   both numbers ("Psalm 144(145)") and so is its own answer key. */
describe("psalm numbering, Masoretic to Vulgate", () => {
  it("keeps the Vulgate number when a citation carries both", () => {
    expect(parseCitation("Psalm 144(145):2-3").ranges).toEqual([{ ch: 144, from: 2, to: 3 }]);
    expect(parseCitation("Psalm 22(23):1-3").ranges).toEqual([{ ch: 22, from: 1, to: 3 }]);
  });

  it("re-numbers a bare modern citation", () => {
    expect(parseCitation("Psalm 145:2-3").ranges).toEqual([{ ch: 144, from: 2, to: 3 }]);
    expect(parseCitation("Psalm 23:1-3").ranges).toEqual([{ ch: 22, from: 1, to: 3 }]);
    expect(parseCitation("Psalm 119:1, 27").ranges).toEqual([{ ch: 118, from: 1, to: 1 }, { ch: 118, from: 27, to: 27 }]);
  });

  it("leaves alone the psalms both numberings agree on", () => {
    expect(parseCitation("Psalm 4:2, 4").ranges).toEqual([{ ch: 4, from: 2, to: 2 }, { ch: 4, from: 4, to: 4 }]);
    expect(parseCitation("Psalm 150:1").ranges).toEqual([{ ch: 150, from: 1, to: 1 }]);
  });

  it("handles the joins and the splits", () => {
    expect(parseCitation("Psalm 10:1").ranges).toEqual([{ ch: 9, from: 22, to: 22 }]);     // joined into Douay 9
    expect(parseCitation("Psalm 115:1").ranges).toEqual([{ ch: 113, from: 9, to: 9 }]);    // joined into Douay 113
    expect(parseCitation("Psalm 116:1-9").ranges).toEqual([{ ch: 114, from: 1, to: 9 }]);  // split: first half
    expect(parseCitation("Psalm 116:10-19").ranges).toEqual([{ ch: 115, from: 1, to: 10 }]); // split: second half
    expect(parseCitation("Psalm 147:12-20").ranges).toEqual([{ ch: 147, from: 1, to: 9 }]);
    expect(parseCitation("Psalm 147:1-11").ranges).toEqual([{ ch: 146, from: 1, to: 11 }]);
  });

  it("splits a range that straddles a join", () => {
    expect(parseCitation("Psalm 116:8-12").ranges).toEqual([{ ch: 114, from: 8, to: null }, { ch: 115, from: 1, to: 3 }]);
  });

  it("reads the words the lectionary means", async () => {
    const p = await passage("Psalm 145:2-3", fakeFetch);
    expect(p.verses[0].text).toMatch(/Every day will I bless thee/);
    const shepherd = await passage("Psalm 23:1", fakeFetch);
    expect(shepherd.verses[0].text).toMatch(/The Lord ruleth me/);
    const nations = await passage("Psalm 117:1", fakeFetch);
    expect(nations.verses[0].text).toMatch(/O Praise the Lord, all ye nations/);
  });
});

/* The citation feed is typed by hand and arrives scuffed, and three books are
   numbered differently in the Douay. Both were found by running every citation
   in the shipped lectionary through the parser; these keep them found. */
describe("citations as the lectionary really writes them", () => {
  it("tolerates the feed's punctuation", () => {
    expect(parseCitation("Matthew 15: 21-28").ranges).toEqual([{ ch: 15, from: 21, to: 28 }]);
    expect(parseCitation("Sirach 51:12 cd-20").ranges).toEqual([{ ch: 51, from: 12, to: 20 }]);
    expect(parseCitation("Psalm 31:3cd-4, 6 and 8ab").ranges)
      .toEqual([{ ch: 30, from: 3, to: 4 }, { ch: 30, from: 6, to: 6 }, { ch: 30, from: 8, to: 8 }]);
  });

  it("drops runs of part-verse letters in either case", () => {
    expect(parseCitation("2 Kings 5:1-15ab").ranges).toEqual([{ ch: 5, from: 1, to: 15 }]);
    expect(parseCitation("Revelation 11:19A; 12:1-6A, 10AB").ranges)
      .toEqual([{ ch: 11, from: 19, to: 19 }, { ch: 12, from: 1, to: 6 }, { ch: 12, from: 10, to: 10 }]);
    expect(parseCitation("Psalm 98:1bcde, 2-3ab").ranges).toEqual([{ ch: 97, from: 1, to: 1 }, { ch: 97, from: 2, to: 3 }]);
  });

  it("corrects a misspelt book name, but only when there is one clear answer", () => {
    expect(findBook("Phiippians").id).toBe("phil");
    expect(findBook("Sirarch").id).toBe("sir");
    expect(findBook("Qqqqqqqqqq")).toBe(null);
  });

  it("reads single-chapter books as verses, not chapters", () => {
    expect(parseCitation("Philemon 7-20").ranges).toEqual([{ ch: 1, from: 7, to: 20 }]);
    expect(parseCitation("2 John 4-9").ranges).toEqual([{ ch: 1, from: 4, to: 9 }]);
  });

  it("re-numbers the books the Douay divides differently", async () => {
    const zech = await passage("Zechariah 2:14-17", fakeFetch);      // Douay 2:10-13
    expect(zech.verses[0].text).toMatch(/Sing praise, and rejoice, O daughter of Sion/);
    const joel = await passage("Joel 4:12-21", fakeFetch);           // Douay 3
    expect(joel.verses[0].text).toMatch(/valley of Josaphat/);
    const esther = await passage("Esther C:12, 14-16", fakeFetch);   // Douay 14:1, 3-5
    expect(esther.verses[0].text).toMatch(/Queen Esther also/);
  });

  it("survives the stray range in the feed's Jonah citation", () => {
    expect(parseCitation("Jonah 1:1-2:1-2, 11").ranges)
      .toEqual([{ ch: 1, from: 1, to: null }, { ch: 2, from: 1, to: 1 }, { ch: 2, from: 11, to: 11 }]);
  });
});

/* The guard that matters: every citation the app will actually show, for every
   day it ships with, must find real verses in the bundled Douay. This is what
   caught the psalm numbering, the part-verse letters and the divergent books —
   it runs over roughly thirteen hundred citations and costs a fraction of a
   second. If a future lectionary build introduces a citation we cannot read,
   this fails here rather than showing a family a blank card at Mass. */
describe("the shipped lectionary", () => {
  const years = fs.existsSync("public/data/lectionary")
    ? fs.readdirSync("public/data/lectionary").filter((f) => /^\d{4}\.json$/.test(f))
    : [];

  it("has been generated", () => {
    expect(years.length).toBeGreaterThan(0);
  });

  it("cites only passages the bundled text can produce", async () => {
    const days = Object.assign({}, ...years.map((f) => JSON.parse(fs.readFileSync(`public/data/lectionary/${f}`, "utf8"))));
    const failures = [];
    let checked = 0;
    for (const [date, entry] of Object.entries(days)) {
      for (const r of entry.readings) {
        checked++;
        const p = await passage(r.source, fakeFetch).catch(() => null);
        if (!p || !p.verses.length) failures.push(`${date} ${r.label}: ${r.source}`);
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(failures).toEqual([]);
  });

  it("names every day", () => {
    const days = Object.assign({}, ...years.map((f) => JSON.parse(fs.readFileSync(`public/data/lectionary/${f}`, "utf8"))));
    const unnamed = Object.entries(days).filter(([, e]) => !e.day).map(([d]) => d);
    expect(unnamed).toEqual([]);
  });
});
