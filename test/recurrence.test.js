import { describe, it, expect } from "vitest";
import { taskOccursOn, taskDoneOn, eventDoneOn, itemDoneOn, scheduledToday, repeatLabel, billDueOn, billPaidOn, billPeriod, nextBillDate } from "../src/core/recurrence.js";

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

describe("eventDoneOn() / itemDoneOn()", () => {
  /* Events are crossed off once for the household — not per person like a practice,
     and not per date like a repeating task. */
  it("an event is done when it says it is", () => {
    expect(eventDoneOn({ kind: "event", title: "Dinner" })).toBe(false);
    expect(eventDoneOn({ kind: "event", title: "Dinner", done: true })).toBe(true);
  });

  it("a done event stays done on every date, unlike a repeating task", () => {
    const e = { kind: "event", date: "2026-09-01", done: true };
    expect(itemDoneOn(e, "2026-09-01")).toBe(true);
    expect(itemDoneOn(e, "2026-09-02")).toBe(true);
  });

  it("itemDoneOn sends tasks down the task path", () => {
    const r = task({ repeat: { type: "weekly", days: [2] }, doneDates: { "2026-09-01": true } });
    expect(itemDoneOn(r, "2026-09-01")).toBe(true);
    expect(itemDoneOn(r, "2026-09-08")).toBe(false);
    expect(itemDoneOn(task({ due: "2026-09-01", done: true }), "2026-09-01")).toBe(true);
  });
});

describe("bills", () => {
  const monthly = { kind: "bill", text: "Mortgage", amount: 2100, dueDom: 31 };
  const once = { kind: "bill", text: "Dentist", amount: 180, due: "2026-09-20" };

  it("a monthly bill falls due on its day, clamped to short months", () => {
    expect(billDueOn(monthly, "2026-08-31")).toBe(true);
    expect(billDueOn(monthly, "2026-09-30")).toBe(true);
    expect(billDueOn(monthly, "2026-09-29")).toBe(false);
    expect(billDueOn(once, "2026-09-20")).toBe(true);
    expect(billDueOn(once, "2026-09-21")).toBe(false);
    expect(billDueOn({ kind: "task", dueDom: 1 }, "2026-09-01")).toBe(false);
  });

  it("paid is per month for a monthly bill, once for a one-off", () => {
    expect(billPaidOn({ ...monthly, paidMonths: { "2026-09": true } }, "2026-09-30")).toBe(true);
    expect(billPaidOn({ ...monthly, paidMonths: { "2026-09": true } }, "2026-10-31")).toBe(false);
    expect(billPeriod(monthly, "2026-09-30")).toBe("2026-09");
    expect(billPeriod(once, "2026-09-20")).toBe("once");
    expect(billPaidOn({ ...once, paid: true }, "2026-09-20")).toBe(true);
  });

  it("nextBillDate rolls into the next month, and across the year", () => {
    expect(nextBillDate(monthly, "2026-09-15")).toBe("2026-09-30");
    expect(nextBillDate(monthly, "2026-09-30")).toBe("2026-09-30");
    expect(nextBillDate(monthly, "2026-10-01")).toBe("2026-10-31");
    expect(nextBillDate({ ...monthly, dueDom: 5 }, "2026-12-06")).toBe("2027-01-05");
    expect(nextBillDate(once, "2026-09-15")).toBe("2026-09-20");
    expect(nextBillDate(once, "2026-09-21")).toBeNull();
  });
});
