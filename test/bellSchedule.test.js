import { describe, it, expect } from "vitest";
import { bellNotifications, notifId, inQuietHours } from "../src/core/bellSchedule.js";

// Tuesday 2026-09-22 at 09:00 local
const now = new Date(2026, 8, 22, 9, 0, 0);
const daily = { id: "p1", name: "Angelus", time: "12:00", days: [0, 1, 2, 3, 4, 5, 6], mins: 3 };
const sunday = { id: "p2", name: "Mass", time: "10:30", days: [0] };

describe("bellNotifications", () => {
  it("plans one bell per scheduled day, soonest first", () => {
    const list = bellNotifications([daily], { now, days: 3 });
    expect(list.map(n => n.at.getDate())).toEqual([22, 23, 24]);
    expect(list[0].title).toBe("The house rings · Angelus");
    expect(list[0].body).toBe("It's time for Angelus · 3 min.");
    expect(list[0].at.getHours()).toBe(12);
  });
  it("skips today's bell once the hour has passed", () => {
    const list = bellNotifications([{ ...daily, time: "08:00" }], { now, days: 2 });
    expect(list.map(n => n.at.getDate())).toEqual([23]);
  });
  it("respects weekdays", () => {
    const list = bellNotifications([sunday], { now, days: 7 });
    expect(list).toHaveLength(1);
    expect(list[0].at.getDay()).toBe(0);
  });
  it("drops today's bell for a practice already kept, keeps tomorrow's", () => {
    const list = bellNotifications([daily], { now, days: 2, done: new Set(["p1"]) });
    expect(list.map(n => n.at.getDate())).toEqual([23]);
  });
  it("stays silent in quiet hours", () => {
    const late = { ...daily, time: "22:30" };
    expect(bellNotifications([late], { now, days: 2 })).toHaveLength(0);
    expect(bellNotifications([late], { now, days: 2, quietFrom: "23:00", quietTo: "06:00" })).toHaveLength(2);
  });
  it("caps the list, soonest first", () => {
    const ps = Array.from({ length: 10 }, (_, i) => ({ ...daily, id: "p" + i, time: "1" + i % 10 + ":00" }));
    const list = bellNotifications(ps, { now, days: 7, max: 60 });
    expect(list).toHaveLength(60);
    for (let i = 1; i < list.length; i++) expect(list[i].at.getTime()).toBeGreaterThanOrEqual(list[i - 1].at.getTime());
  });
  it("ignores practices without a time or with a malformed one", () => {
    expect(bellNotifications([{ id: "x", name: "No time", days: [2] }, { id: "y", name: "Bad", time: "noon", days: [2] }], { now })).toHaveLength(0);
  });
});

describe("notifId", () => {
  it("is stable, positive, and fits a 32-bit signed integer", () => {
    const a = notifId("p1", "2026-09-22");
    expect(a).toBe(notifId("p1", "2026-09-22"));
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(0x7fffffff);
    expect(a).not.toBe(notifId("p1", "2026-09-23"));
    expect(a).not.toBe(notifId("p2", "2026-09-22"));
  });
});

describe("inQuietHours", () => {
  it("handles a window that wraps midnight", () => {
    const st = { quietFrom: "22:00", quietTo: "06:00" };
    expect(inQuietHours("23:00", st)).toBe(true);
    expect(inQuietHours("05:59", st)).toBe(true);
    expect(inQuietHours("06:00", st)).toBe(false);
    expect(inQuietHours("12:00", st)).toBe(false);
  });
  it("handles a daytime window and an empty one", () => {
    expect(inQuietHours("13:00", { quietFrom: "12:00", quietTo: "14:00" })).toBe(true);
    expect(inQuietHours("13:00", { quietFrom: "13:00", quietTo: "13:00" })).toBe(false);
  });
});
