import { describe, it, expect } from "vitest";
import { taskOccursOn, taskDoneOn, scheduledToday, repeatLabel } from "../src/core/recurrence.js";

/* Calendar facts used below: 2026-09-01 is a Tuesday, 2026-09-06 is a Sunday. */

const task = (extra) => ({ kind: "task", text: "Vacuum", ...extra });

describe("taskOccursOn()", () => {
  it("ignores anything that is not a task", () => {
    expect(taskOccursOn({ kind: "event", date: "2026-09-01" }, "2026-09-01")).toBe(false);
  });

  it("a one-off task occurs only on its due date", () => {
    const t = task({ due: "2026-09-01" });
    expect(taskOccursOn(t, "2026-09-01")).toBe(true);
    expect(taskOccursOn(t, "2026-09-02")).toBe(false);
  });

  it("weekly: occurs on the listed weekdays (0 = Sunday)", () => {
    const t = task({ repeat: { type: "weekly", days: [2] } }); // Tuesdays
    expect(taskOccursOn(t, "2026-09-01")).toBe(true);  // Tue
    expect(taskOccursOn(t, "2026-09-02")).toBe(false); // Wed
    expect(taskOccursOn(t, "2026-09-08")).toBe(true);  // next Tue
    expect(taskOccursOn(task({ repeat: { type: "weekly", days: [0] } }), "2026-09-06")).toBe(true); // Sun
  });

  it("every N days: counts from the anchor, never before it", () => {
    const t = task({ repeat: { type: "every", n: 3, anchor: "2026-09-01" } });
    expect(taskOccursOn(t, "2026-08-29")).toBe(false); // before anchor
    expect(taskOccursOn(t, "2026-09-01")).toBe(true);
    expect(taskOccursOn(t, "2026-09-02")).toBe(false);
    expect(taskOccursOn(t, "2026-09-04")).toBe(true);
    expect(taskOccursOn(t, "2026-09-07")).toBe(true);
  });

  it("every N days: treats n < 1 as daily", () => {
    const t = task({ repeat: { type: "every", n: 0, anchor: "2026-09-01" } });
    expect(taskOccursOn(t, "2026-09-02")).toBe(true);
  });

  it("monthly: fires on the day of month, clamped to short months", () => {
    const t = task({ repeat: { type: "monthly", dom: 31 } });
    expect(taskOccursOn(t, "2026-08-31")).toBe(true);
    expect(taskOccursOn(t, "2026-09-30")).toBe(true);  // September has 30 days
    expect(taskOccursOn(t, "2026-09-29")).toBe(false);
    expect(taskOccursOn(t, "2026-02-28")).toBe(true);  // 2026 is not a leap year
  });

  it("an unknown repeat type never occurs", () => {
    expect(taskOccursOn(task({ repeat: { type: "lunar" } }), "2026-09-01")).toBe(false);
  });
});

describe("taskDoneOn()", () => {
  it("repeating tasks are done per date; one-offs are done once", () => {
    const r = task({ repeat: { type: "weekly", days: [2] }, doneDates: { "2026-09-01": true } });
    expect(taskDoneOn(r, "2026-09-01")).toBe(true);
    expect(taskDoneOn(r, "2026-09-08")).toBe(false);
    expect(taskDoneOn(task({ due: "2026-09-01", done: true }), "2026-09-01")).toBe(true);
    expect(taskDoneOn(task({ due: "2026-09-01" }), "2026-09-01")).toBe(false);
  });
});

describe("scheduledToday()", () => {
  it("checks a practice's weekday list against the given date", () => {
    const p = { name: "Rosary", days: [1, 2, 3, 4, 5] };
    expect(scheduledToday(p, new Date(2026, 8, 1))).toBe(true);  // Tue
    expect(scheduledToday(p, new Date(2026, 8, 6))).toBe(false); // Sun
    expect(scheduledToday({ name: "x" }, new Date(2026, 8, 1))).toBe(false);
  });
});

describe("repeatLabel()", () => {
  it("describes the rule in the order Mon..Sun", () => {
    expect(repeatLabel(task({ repeat: { type: "weekly", days: [0, 2] } }))).toBe("↻ Tu · Su");
    expect(repeatLabel(task({ repeat: { type: "monthly", dom: 3 } }))).toBe("↻ the 3rd of each month");
    expect(repeatLabel(task({ repeat: { type: "every", n: 4 } }))).toBe("↻ every 4 days");
    expect(repeatLabel(task({}))).toBe("");
  });
});
