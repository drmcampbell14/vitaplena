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
