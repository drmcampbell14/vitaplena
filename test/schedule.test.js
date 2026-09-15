import { describe, it, expect } from "vitest";
import { scheduleTasks, toMin, toHHMM, hintRange, BUFFER_MINS } from "../src/core/schedule.js";

const by = (plan, id) => plan.placed.find((p) => p.id === id);

describe("time helpers", () => {
  it("round-trip HH:MM and reject junk", () => {
    expect(toMin("07:05")).toBe(425);
    expect(toHHMM(425)).toBe("07:05");
    expect(toMin("25:00")).toBeNull();
    expect(toMin("")).toBeNull();
    expect(toMin(undefined)).toBeNull();
  });
  it("a clock-time hint means the part of the day it falls in", () => {
    expect(hintRange("morning")).toEqual([0, 720]);
    expect(hintRange("14:00")).toEqual([720, 1020]);
    expect(hintRange("19:00")).toEqual([1020, 1440]);
    expect(hintRange(null)).toBeNull();
  });
});

describe("scheduleTasks()", () => {
  it("packs tasks into the gaps from now forward, never into the past", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "a", mins: 30 }, { id: "b", mins: 15 }],
      busy: [{ start: "12:00", end: "12:05" }],        // the Angelus
      dayStart: "07:00", now: "09:02"
    });
    expect(by(plan, "a").start).toBe("09:05");         // rounded up to the next five minutes
    expect(by(plan, "a").end).toBe("09:35");
    expect(by(plan, "b").start).toBe("09:35");
    expect(plan.later).toEqual([]);
  });

  it("keeps a travel buffer either side of an event, but not around a practice", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "t", mins: 20 }],
      busy: [{ start: "10:00", end: "11:00", pad: true }],
      dayStart: "07:00", now: "09:50"
    });
    // 09:50 + 20 would run into the 09:45 buffer, so it lands after 11:15
    expect(by(plan, "t").start).toBe("11:15");
    const plan2 = scheduleTasks({
      tasks: [{ id: "t", mins: 20 }],
      busy: [{ start: "10:00", end: "10:05", pad: false }],
      dayStart: "07:00", now: "09:50"
    });
    expect(by(plan2, "t").start).toBe("10:05");
    expect(BUFFER_MINS).toBe(15);
  });

  it("a locked task stays at its time and the others go around it", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "free", mins: 60 }, { id: "pin", mins: 30, lock: "09:30" }],
      busy: [], dayStart: "09:00", now: "09:00"
    });
    expect(by(plan, "pin")).toMatchObject({ start: "09:30", end: "10:00", locked: true });
    expect(by(plan, "free").start).toBe("10:00");        // the 30 min before the pin is too short
  });

  it("a lock already behind us is released so the task flows forward", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "pin", mins: 15, lock: "08:00" }],
      busy: [], dayStart: "07:00", now: "13:00"
    });
    expect(by(plan, "pin")).toMatchObject({ start: "13:00", locked: false });
  });

  it("prefers the part of the day the task was hinted for", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "eve", mins: 30, hint: "evening" }, { id: "any", mins: 30 }],
      busy: [], dayStart: "07:00", now: "08:00"
    });
    expect(by(plan, "any").start).toBe("08:00");
    expect(by(plan, "eve").start).toBe("17:00");
  });

  it("falls back to any gap when the hinted part of the day is full", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "eve", mins: 30, hint: "evening" }],
      busy: [{ start: "17:00", end: "21:30" }],
      dayStart: "07:00", now: "08:00"
    });
    expect(by(plan, "eve").start).toBe("08:00");
  });

  it("soonest due goes first; the longer task takes the bigger gap", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "later", mins: 15, due: "2026-09-20" }, { id: "soon", mins: 15, due: "2026-09-16" }, { id: "undated", mins: 15 }],
      busy: [], dayStart: "07:00", now: "07:00"
    });
    expect(plan.placed.map((p) => p.id)).toEqual(["soon", "later", "undated"]);
  });

  it("what fits nowhere today is reported, not dropped", () => {
    const plan = scheduleTasks({
      tasks: [{ id: "big", mins: 180 }, { id: "small", mins: 10 }],
      busy: [{ start: "08:00", end: "21:00" }],
      dayStart: "07:00", now: "07:00", dayEnd: "21:30"
    });
    expect(plan.later).toEqual(["big"]);
    expect(by(plan, "small").start).toBe("07:00");
  });

  it("a task with no length gets the default, and never fits into a sliver", () => {
    const plan = scheduleTasks({ tasks: [{ id: "x" }], busy: [{ start: "07:05", end: "21:30" }], dayStart: "07:00", now: "07:00" });
    expect(plan.later).toEqual(["x"]);
  });
});
