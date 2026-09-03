import { describe, it, expect } from "vitest";
import { easter, season, ymd, addD } from "../src/core/liturgical.js";

/* Dates below are from the published General Roman Calendar for each year.
   If one of these fails, the math is wrong, not the calendar. */

const d = (y, m, day) => new Date(y, m - 1, day);

describe("easter()", () => {
  it("matches the published dates", () => {
    expect(ymd(easter(2025))).toBe("2025-04-20");
    expect(ymd(easter(2026))).toBe("2026-04-05");
    expect(ymd(easter(2027))).toBe("2027-03-28");
    expect(ymd(easter(2028))).toBe("2028-04-16");
  });
});

describe("season() in 2026", () => {
  it("Christmastide runs from Jan 1 through the Baptism of the Lord (Jan 11)", () => {
    expect(season(d(2026, 1, 1)).name).toBe("Christmas");
    expect(season(d(2026, 1, 6)).name).toBe("Christmas");
    expect(season(d(2026, 1, 11)).name).toBe("Christmas");
    expect(season(d(2026, 1, 12)).name).toBe("Ordinary Time");
  });
  it("Lent starts Ash Wednesday (Feb 18) and ends before Holy Thursday", () => {
    expect(season(d(2026, 2, 17)).name).toBe("Ordinary Time");
    expect(season(d(2026, 2, 18)).name).toBe("Lent");
    expect(season(d(2026, 4, 1)).name).toBe("Lent");
  });
  it("the Triduum is Holy Thursday through Holy Saturday (Apr 2 to 4)", () => {
    expect(season(d(2026, 4, 2)).name).toBe("Sacred Triduum");
    expect(season(d(2026, 4, 4)).name).toBe("Sacred Triduum");
  });
  it("Eastertide runs from Easter (Apr 5) to Pentecost (May 24)", () => {
    expect(season(d(2026, 4, 5)).name).toBe("Easter");
    expect(season(d(2026, 5, 23)).name).toBe("Easter");
    expect(season(d(2026, 5, 24)).name).toBe("Pentecost");
    expect(season(d(2026, 5, 25)).name).toBe("Ordinary Time");
  });
  it("Advent begins on the First Sunday of Advent (Nov 29) and yields to Christmas", () => {
    expect(season(d(2026, 11, 28)).name).toBe("Ordinary Time");
    expect(season(d(2026, 11, 29)).name).toBe("Advent");
    expect(season(d(2026, 12, 24)).name).toBe("Advent");
    expect(season(d(2026, 12, 25)).name).toBe("Christmas");
  });
  it("midsummer is Ordinary Time", () => {
    expect(season(d(2026, 7, 15)).name).toBe("Ordinary Time");
  });
});

describe("date helpers", () => {
  it("ymd formats local calendar dates with zero padding", () => {
    expect(ymd(d(2026, 3, 7))).toBe("2026-03-07");
  });
  it("addD crosses month and year boundaries", () => {
    expect(ymd(addD(d(2026, 12, 30), 3))).toBe("2027-01-02");
    expect(ymd(addD(d(2026, 3, 1), -1))).toBe("2026-02-28");
  });
});
