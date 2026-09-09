/* Vita Plena — people and assignment.
   A household has members (accounts) and people (no account: children, a
   grandparent, the dog). Anything assignable (tasks, chores) carries an `area`:
     <uid>        a member
     "together"   the household
     "p:<id>"     a person, from state.people
   A chore can rotate weekly between assignees: task.rotate = [area, area, ...];
   the assignee for a given date is rotate[weekIndex % n]. Pure module, tested. */
import { S, profOf } from "./state.js";
import { dayIdx } from "./util.js";

export const isPerson = (a) => typeof a === "string" && a.startsWith("p:");
export const people = () => (S.state && S.state.people) || [];
export const personById = (id) => people().find((p) => p.id === id) || null;

/** Everything about an assignee key, for display. */
export function who(area) {
  if (area === "together") return { key: area, name: "Together", initials: "US", kind: "together", emoji: "🏡" };
  if (isPerson(area)) {
    const p = personById(area.slice(2));
    return p ? { key: area, name: p.name, initials: initialsOf(p.name), kind: "person", emoji: p.emoji || "💛", role: p.role }
             : { key: area, name: "Someone", initials: "?", kind: "person", emoji: "💛" };
  }
  const prof = profOf(area);
  return { key: area, name: prof.name, initials: prof.initials, kind: S.user && area === S.user.uid ? "me" : "member", emoji: "" };
}
export const initialsOf = (name) => (name || "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "·";

/** All assignable keys in display order: me, other members, people, together. */
export function assignees() {
  const me = S.user?.uid;
  const members = (S.house?.members || []);
  return [
    ...members.filter((u) => u === me).map((u) => who(u)),
    ...members.filter((u) => u !== me).map((u) => who(u)),
    ...people().map((p) => who("p:" + p.id)),
    who("together")
  ];
}

/** Sunday-aligned week number for a "YYYY-MM-DD" date (epoch day 0 was a Thursday). */
export const weekIndex = (dateS) => Math.floor((dayIdx(new Date(dateS + "T12:00")) + 4) / 7);

/** The assignee of a task on a date, honouring weekly rotation. */
export function assigneeOn(task, dateS) {
  const r = task.rotate;
  if (Array.isArray(r) && r.length) return r[((weekIndex(dateS) % r.length) + r.length) % r.length];
  return task.area;
}

/** Is this task mine on this date? Mine = assigned to me, or to the household. */
export function mineOn(task, dateS) {
  const a = assigneeOn(task, dateS);
  return a === "together" || a === S.user?.uid;
}

/** Resolve a spoken name to an assignee key: "Liz" → uid, "Gordie" → "p:..", "both" → together. */
export function resolveName(name) {
  const a = (name || "").toLowerCase().trim();
  if (!a || a === "me" || a === "mine") return S.user.uid;
  if (["both", "together", "us", "household", "everyone"].includes(a)) return "together";
  const m = (S.house?.members || []).find((u) => { const n = (profOf(u).name || "").toLowerCase(); return n && (n === a || n.startsWith(a)); });
  if (m) return m;
  const p = people().find((x) => { const n = (x.name || "").toLowerCase(); return n && (n === a || n.startsWith(a)); });
  if (p) return "p:" + p.id;
  return null;
}
