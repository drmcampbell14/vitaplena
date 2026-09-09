import { describe, it, expect, beforeEach } from "vitest";

/* people.js reads household state from S; give it a fake household. */
import { S } from "../src/core/state.js";
import { who, assigneeOn, weekIndex, mineOn, resolveName, assignees, isPerson } from "../src/core/people.js";

beforeEach(() => {
  S.user = { uid: "u-mitch" };
  S.house = { members: ["u-mitch", "u-liz"], profiles: { "u-mitch": { name: "Mitch", initials: "MC" }, "u-liz": { name: "Liz", initials: "LC" } } };
  S.state = { people: [{ id: "k1", name: "Gordie", emoji: "🐕", role: "pet" }, { id: "k2", name: "Anna", emoji: "👧", role: "child" }] };
});

describe("who()", () => {
  it("describes members, people, and the household", () => {
    expect(who("u-mitch")).toMatchObject({ name: "Mitch", kind: "me" });
    expect(who("u-liz")).toMatchObject({ name: "Liz", kind: "member" });
    expect(who("p:k2")).toMatchObject({ name: "Anna", kind: "person", initials: "A" });
    expect(who("together")).toMatchObject({ name: "Together", kind: "together" });
    expect(who("p:missing").name).toBe("Someone");
  });
});

describe("weekly rotation", () => {
  it("weekIndex is Sunday-aligned: a Sunday and the following Saturday share a week", () => {
    expect(weekIndex("2026-09-06")).toBe(weekIndex("2026-09-12")); // Sun..Sat
    expect(weekIndex("2026-09-13")).toBe(weekIndex("2026-09-06") + 1);
  });
  it("assigneeOn rotates through the list one week at a time", () => {
    const t = { area: "p:k1", rotate: ["p:k1", "p:k2", "u-mitch"] };
    const a = assigneeOn(t, "2026-09-06"), b = assigneeOn(t, "2026-09-13"), c = assigneeOn(t, "2026-09-20"), d = assigneeOn(t, "2026-09-27");
    expect([a, b, c]).toEqual(expect.arrayContaining(["p:k1", "p:k2", "u-mitch"]));
    expect(new Set([a, b, c]).size).toBe(3);
    expect(d).toBe(a);
    expect(assigneeOn(t, "2026-09-10")).toBe(a); // same week as the 6th
  });
  it("falls back to area without a rotation", () => {
    expect(assigneeOn({ area: "u-liz" }, "2026-09-06")).toBe("u-liz");
    expect(assigneeOn({ area: "u-liz", rotate: [] }, "2026-09-06")).toBe("u-liz");
  });
  it("mineOn is true for me and for the household", () => {
    expect(mineOn({ area: "u-mitch" }, "2026-09-06")).toBe(true);
    expect(mineOn({ area: "together" }, "2026-09-06")).toBe(true);
    expect(mineOn({ area: "u-liz" }, "2026-09-06")).toBe(false);
    expect(mineOn({ area: "p:k1" }, "2026-09-06")).toBe(false);
  });
});

describe("resolveName()", () => {
  it("maps spoken names to members, people, and the household", () => {
    expect(resolveName("Liz")).toBe("u-liz");
    expect(resolveName("liz")).toBe("u-liz");
    expect(resolveName("Gordie")).toBe("p:k1");
    expect(resolveName("ann")).toBe("p:k2");
    expect(resolveName("both")).toBe("together");
    expect(resolveName("me")).toBe("u-mitch");
    expect(resolveName("")).toBe("u-mitch");
    expect(resolveName("nobody")).toBeNull();
  });
});

describe("assignees()", () => {
  it("lists me first, then members, people, together", () => {
    expect(assignees().map((a) => a.key)).toEqual(["u-mitch", "u-liz", "p:k1", "p:k2", "together"]);
    expect(isPerson("p:k1")).toBe(true);
    expect(isPerson("u-liz")).toBe(false);
  });
});
