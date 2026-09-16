import { describe, it, expect } from "vitest";
import { parseUniversalis } from "../netlify/functions/readings.mjs";

/* Universalis serves HTML inside JSONP. Everything the app displays has to come
   out of here already decoded, or esc() re-escapes the ampersand and the reader
   sees "&#8217;" spelled out on the page. */

const jsonp = (obj) => `universalisCallback(${JSON.stringify(obj)})`;

const sample = jsonp({
  day: "Wednesday of week 23 in Ordinary Time&nbsp;&mdash; St Peter Claver, Priest",
  Mass_R1: { source: "Colossians 3:1-11", heading: "You have been&#160;raised", text: "<p>Since you have been brought back to true life with Christ,</p>\n<p>look for the things that are in heaven.&#8217;</p>" },
  Mass_Ps: { source: "Psalm 144(145):2-3", text: "<p>I will bless you day after day.</p>" },
  Mass_GA: { source: "cf. John 6:63", text: "<p>Alleluia!</p>" },
  Mass_G: { source: "Luke 6:20-26", text: "<p>Happy are you who are poor&hellip;</p>" },
  copyright: { text: "&copy; Universalis Publishing" }
});

describe("parseUniversalis()", () => {
  const out = parseUniversalis(sample, "20260909");

  it("unwraps the JSONP callback and keeps the date it was asked for", () => {
    expect(out.date).toBe("20260909");
  });

  it("decodes entities and drops markup from every string it returns", () => {
    expect(out.day).toBe("Wednesday of week 23 in Ordinary Time — St Peter Claver, Priest");
    expect(out.copyright).toBe("© Universalis Publishing");
    const r1 = out.readings[0];
    expect(r1.heading).toBe("You have been raised");
    expect(r1.body).toEqual([
      "Since you have been brought back to true life with Christ,",
      "look for the things that are in heaven.’"
    ]);
    const all = JSON.stringify(out);
    expect(all).not.toMatch(/&[a-z]+;|&#\d+;|<[a-z]/i);
  });

  it("labels the readings in the order they are proclaimed, skipping ones not said today", () => {
    expect(out.readings.map((r) => r.label))
      .toEqual(["First Reading", "Responsorial Psalm", "Gospel Acclamation", "Gospel"]);
    expect(out.readings.find((r) => r.label === "Second Reading")).toBeUndefined();
  });

  it("returns null rather than a half-built day when the payload isn't usable", () => {
    expect(parseUniversalis("<html>404</html>", "20260909")).toBeNull();
    expect(parseUniversalis("universalisCallback({not json})", "20260909")).toBeNull();
    expect(parseUniversalis("", "20260909")).toBeNull();
  });

  it("survives a day with no readings at all", () => {
    expect(parseUniversalis(jsonp({ day: "Holy Saturday" }), "20260404"))
      .toMatchObject({ day: "Holy Saturday", readings: [] });
  });
});

/* The payload Universalis actually serves is not JSON: every long string is
   compressed, and the expansion hangs off the literal as a chain of calls.
   The fixture below is the real reply for 15 September 2026, trimmed to three
   fields but otherwise byte-for-byte as it came off the wire — the sample above
   is built with JSON.stringify, so it can never reproduce this shape, which is
   why a payload that broke the app in production still passed the suite.

   The Psalm is the case worth keeping: the chain feeds itself. "J" expands to
   text containing "A", "A" expands to text containing "D" and "q", and later
   "A" and "q" come round a second time meaning something different. Applied in
   any other order it turns to gibberish. */

const wire = String.raw`universalisCallback({"number" : 20260915,"date" : "Tuesday 15 September 2026","day" : "<div style='text-indent: -3em; margin-left: 3em;'><b>Our Lady of Sorrows</b></div><div style='text-indent: -2em; margin-left: 3em;'>&#160;&#160;on Tuesday of week 24 in Ordinary Time</div>","Mass_Ps" : {"source" : "Psalm 99(100)","text" : "z3xem;'>JFCry out with joy toqLord, allqearth.BServeqLord with gladness.BCome before him, singing for joy.FJFKnow that he,qLord, is God.BHe made us, we belong to him,BwAFJFGo withinDgates, giving thanks.BEnterDcourts with songs of praise.BGive thanks to him and blessDname.FJFIndeed, how good isqLord,BeternalDmerciful love.BHe is faithful from age to age.FJ</div>".split("J").join("<i>WA</i>").split("A").join("e areDpeople,qsheep ofDflock.").split("q").join(" the ").split("F").join("A3xqtop:0.8em;'>").split("D").join(" his ").split("B").join("A2xem;'>&#160;&#160;").split("A").join("</div>z").split("x").join("qleft: 3").split("z").join("<div style='text-indent: -").split("q").join("em; margin-")},"Mass_G" : {"heading" : "'Woman, this is your son'","source" : "John 19:25&#x2010;27","text" : "<div style='text-align:justify;'>Near the cross of Jesus stood hisb and hisb&#x2019;s sister, Mary the wife of Clopas, and Mary of Magdala. Seeing hisb and the disciple he loved standing near her, Jesus said to hisb, &#x2018;Woman, this is your son.&#x2019; Then to the disciple he said, &#x2018;This is yourb.&#x2019; And from that moment the disciple made a place for her in his home.</div>".split("b").join(" mother")},"copyright" : {"text" : "<span>Copyrightk1996&#x2010;2026 Universalis Publishing Limited: see universalis.com. Text of the Psalms: Copyrightk1963, The Grail (England). Used with permissqA.P. Watt Ltd. The English translatq&#x201c;The Roman Missal&#x201d;k2010, ICEL.</span>".split("q").join("ion of ").split("k").join(" &#xa9; ")}})`;

describe("parseUniversalis() on the wire format", () => {
  const out = parseUniversalis(wire, "20260915");

  it("parses a payload whose strings are JavaScript expressions, not JSON", () => {
    expect(out).not.toBeNull();
    expect(out.date).toBe("20260915");
    expect(out.readings.map((r) => r.label)).toEqual(["Responsorial Psalm", "Gospel"]);
  });

  it("reads the day through the markup Universalis wraps it in", () => {
    expect(out.day).toBe("Our Lady of Sorrows on Tuesday of week 24 in Ordinary Time");
  });

  it("expands a self-feeding chain in order, so the antiphon comes out whole", () => {
    const psalm = out.readings[0];
    expect(psalm.source).toBe("Psalm 99(100)");
    expect(psalm.body[0]).toBe("We are his people, the sheep of his flock.");
    expect(psalm.body).toContain("Cry out with joy to the Lord, all the earth.");
    expect(psalm.body).toContain("Go within his gates, giving thanks.");
    expect(psalm.body.at(-1)).toBe("We are his people, the sheep of his flock.");
  });

  it("expands a single-letter chain in the Gospel", () => {
    const gospel = out.readings[1];
    expect(gospel.source).toBe("John 19:25‐27");
    expect(gospel.body[0]).toContain("stood his mother and his mother’s sister");
    expect(gospel.body[0]).toContain("‘This is your mother.’");
  });

  it("expands the chain on the copyright line too", () => {
    expect(out.copyright).toContain("Copyright © 1996‐2026 Universalis Publishing Limited");
    expect(out.copyright).toContain("Used with permission of A.P. Watt Ltd");
    expect(out.copyright).toContain("The English translation of “The Roman Missal” © 2010, ICEL.");
  });

  it("leaves no placeholder letter, no markup and no entity behind", () => {
    const all = JSON.stringify(out);
    expect(all).not.toMatch(/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;|<[a-z]/i);
    expect(all).not.toMatch(/\.split\(|\.join\(/);
    expect(all).not.toMatch(/qLord|BServe|Dgates|FJF|em; margin-/);   // the compressed forms
  });
});
