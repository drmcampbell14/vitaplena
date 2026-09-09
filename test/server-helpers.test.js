import { describe, it, expect } from "vitest";
import { capFor, entitled, ownerOf, QUOTA } from "../netlify/functions/_shared/admin.mjs";
import { buildIcs, icsStamp } from "../netlify/functions/_shared/ics.mjs";
import { feedToken } from "../netlify/functions/ics.mjs";

describe("entitlements and quotas", () => {
  it("households without a subscription field get the paid cap and are entitled", () => {
    expect(capFor({})).toBe(QUOTA.free);
    expect(entitled({})).toBe(true);
  });
  it("trial and active caps; lapsed is the only refusing state", () => {
    expect(capFor({ subscription: { status: "trial" } })).toBe(40);
    expect(capFor({ subscription: { status: "active" } })).toBe(150);
    expect(entitled({ subscription: { status: "trial" } })).toBe(true);
    expect(entitled({ subscription: { status: "lapsed" } })).toBe(false);
  });
  it("ownerOf prefers the explicit owner, else the first member", () => {
    expect(ownerOf({ owner: "b", members: ["a", "b"] })).toBe("b");
    expect(ownerOf({ members: ["a", "b"] })).toBe("a");
    expect(ownerOf({})).toBeNull();
  });
});

describe("iCalendar feed", () => {
  const cal = buildIcs({
    name: "The Campbells", hid: "h1", now: new Date("2026-09-09T12:00:00"),
    practices: [{ id: "p1", name: "Angelus", time: "12:00", mins: 5, days: [0, 1, 2, 3, 4, 5, 6] }, { id: "p2", name: "Rosary", time: "19:00", mins: 20, days: [2, 5] }, { id: "p3", name: "No time", days: [1] }],
    events: [{ id: "e1", title: "Dinner, with; friends", date: "2026-09-10", time: "18:30", endTime: "20:00", location: "Home" }, { id: "e2", title: "Feast day", date: "2026-09-14" }]
  });
  it("is a valid VCALENDAR with CRLF line endings", () => {
    expect(cal.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(cal.trim().endsWith("END:VCALENDAR")).toBe(true);
    expect(cal.includes("X-WR-CALNAME:Vita Plena · The Campbells")).toBe(true);
  });
  it("turns practices into weekly recurring events and skips ones without a time", () => {
    expect(cal).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA");
    expect(cal).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,FR");
    expect(cal).toContain("DTSTART:20260909T190000");
    expect(cal).toContain("DTEND:20260909T192000");
    expect(cal).not.toContain("No time");
  });
  it("escapes commas and semicolons, and handles all-day events", () => {
    expect(cal).toContain("SUMMARY:Dinner\\, with\\; friends");
    expect(cal).toContain("DTSTART;VALUE=DATE:20260914");
    expect(cal).toContain("DTEND;VALUE=DATE:20260915");
    expect(cal).toContain("LOCATION:Home");
  });
  it("icsStamp formats floating local stamps", () => {
    expect(icsStamp("2026-09-09", "07:05")).toBe("20260909T070500");
    expect(icsStamp("2026-09-09")).toBe("20260909");
  });
  it("feed tokens are stable per household and secret, and differ across households", () => {
    expect(feedToken("h1", "s")).toBe(feedToken("h1", "s"));
    expect(feedToken("h1", "s")).not.toBe(feedToken("h2", "s"));
    expect(feedToken("h1", "s")).not.toBe(feedToken("h1", "t"));
    expect(feedToken("h1", "s")).toMatch(/^[0-9a-f]{32}$/);
  });
});
