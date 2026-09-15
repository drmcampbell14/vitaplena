import { describe, it, expect } from "vitest";
import { parseEvents } from "../netlify/functions/scan.mjs";

/* The model is asked for JSON; this is the wall between what it says and what
   reaches the calendar. Junk rows are dropped, never patched into events. */
describe("parseEvents()", () => {
  it("keeps clean rows, sorted by date and time", () => {
    const { events } = parseEvents(JSON.stringify({ events: [
      { title: "U10 vs. Tigers", date: "2026-10-03", time: "09:30", endTime: "10:30", location: "Field 4" },
      { title: "Picture day", date: "2026-09-28", time: "", endTime: "" }
    ] }));
    expect(events.map((e) => e.title)).toEqual(["Picture day", "U10 vs. Tigers"]);
    expect(events[1]).toMatchObject({ date: "2026-10-03", time: "09:30", endTime: "10:30", location: "Field 4" });
  });

  it("survives prose and code fences around the JSON", () => {
    const { events } = parseEvents("Here you go:\n```json\n{\"events\":[{\"title\":\"Practice\",\"date\":\"2026-10-01\",\"time\":\"17:00\"}]}\n```");
    expect(events).toHaveLength(1);
  });

  it("drops rows with no title, a bad date, or an impossible date", () => {
    const { events } = parseEvents(JSON.stringify({ events: [
      { title: "", date: "2026-10-03" },
      { title: "Bad date", date: "Oct 3" },
      { title: "No such day", date: "2026-02-30" },
      { title: "Good", date: "2026-10-03" }
    ] }));
    expect(events.map((e) => e.title)).toEqual(["Good"]);
  });

  it("blanks a malformed time rather than inventing one, and endTime needs a time", () => {
    const { events } = parseEvents(JSON.stringify({ events: [
      { title: "A", date: "2026-10-03", time: "9:30am", endTime: "10:30" },
      { title: "B", date: "2026-10-03", time: "", endTime: "10:30" },
      { title: "C", date: "2026-10-03", time: "25:00" }
    ] }));
    expect(events.map((e) => [e.time, e.endTime])).toEqual([["", ""], ["", ""], ["", ""]]);
  });

  it("de-duplicates the same event listed twice, and caps the list", () => {
    /** @type {any[]} */
    const rows = Array.from({ length: 100 }, () => ({ title: "Game", date: "2026-10-03", time: "09:00" }));
    rows.push({ title: "Other", date: "2026-10-04" });
    const { events } = parseEvents(JSON.stringify({ events: rows }));
    expect(events).toHaveLength(2);
  });

  it("returns nothing, never throws, on garbage or a non-schedule", () => {
    expect(parseEvents("").events).toEqual([]);
    expect(parseEvents("not json at all").events).toEqual([]);
    expect(parseEvents('{"events": "nope"}').events).toEqual([]);
    expect(parseEvents('{"events":[],"note":"a photo of a dog"}')).toEqual({ events: [], note: "a photo of a dog" });
  });
});
