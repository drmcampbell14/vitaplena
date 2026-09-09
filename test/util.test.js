import { describe, it, expect } from "vitest";
import { todayS, fmtT, fmtMins, ordinal, esc, money, uid6, rid, DOWS, unentity, plain } from "../src/core/util.js";

/* These helpers are tiny, but util.js is imported by nearly everything, so a broken
   import here takes the whole app down at load. todayS() in particular crosses into
   liturgical.js; calling it is the regression test for that dependency. */

describe("util", () => {
  it("todayS() returns today's local date as YYYY-MM-DD", () => {
    expect(todayS()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("fmtT() renders 24h HH:MM as AM/PM words", () => {
    expect(fmtT("00:05")).toBe("12:05 AM");
    expect(fmtT("07:00")).toBe("7:00 AM");
    expect(fmtT("12:00")).toBe("12:00 PM");
    expect(fmtT("19:30")).toBe("7:30 PM");
    expect(fmtT("")).toBe("");
  });

  it("fmtMins() prefers hours once past sixty", () => {
    expect(fmtMins(5)).toBe("5 min");
    expect(fmtMins(60)).toBe("1h");
    expect(fmtMins(95)).toBe("1h 35m");
  });

  it("ordinal() handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal))
      .toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
  });

  it("esc() neutralises HTML", () => {
    expect(esc('<b onclick="x">&"\'</b>')).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;&quot;&#39;&lt;/b&gt;");
    expect(esc(null)).toBe("");
  });

  it("money() formats to two places and tolerates junk", () => {
    expect(money(1234.5)).toBe("$1,234.50");
    expect(money("nope")).toBe("$0.00");
  });

  it("ids: invite codes avoid look-alike characters; rids are short and unique enough", () => {
    for (let i = 0; i < 50; i++) expect(uid6()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    const set = new Set(Array.from({ length: 500 }, rid));
    expect(set.size).toBe(500);
  });

  it("DOWS starts on Sunday", () => {
    expect(DOWS[0]).toBe("Su");
    expect(DOWS).toHaveLength(7);
  });
});

describe("outside text", () => {
  it("unentity decodes named, decimal and hex entities", () => {
    expect(unentity("Ordinary Time&nbsp;&mdash; St Peter Claver&#8217;s day")).toBe("Ordinary Time — St Peter Claver’s day");
    expect(unentity("&#x2019;&amp;&copy;")).toBe("’&©");
    expect(unentity("plain text")).toBe("plain text");
  });

  it("unentity leaves things that only look like entities alone", () => {
    expect(unentity("5 &lt 6 & 7&nope;")).toBe("5 &lt 6 & 7&nope;");
    expect(unentity("&#999999999;")).toBe("&#999999999;");
  });

  /* The bug this guards: strip tags but not entities, then esc(), and the reader
     sees the literal text "&#8217;" — "a bunch of numbers and symbols". */
  it("plain() decodes before esc() ever sees the string", () => {
    expect(plain("<p>Since you have been <i>raised</i>&#8230;</p>")).toBe("Since you have been raised…");
    expect(esc(plain("Colossians 3:1-11&nbsp;"))).toBe("Colossians 3:1-11");
    expect(plain({ text: "a<br>b" })).toBe("a b");
    expect(plain({ source: "Luke 6:20-26" })).toBe("Luke 6:20-26");
    expect(plain(null)).toBe("");
  });
});
