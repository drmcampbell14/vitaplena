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
