/* Vita Plena — family mode.
   The same app, on a tablet on the counter: big type, no menus, no login for the
   kids (the device stays signed in as a parent). Today's date and liturgical day,
   the next bell, the rhythm with who has kept it, and a column per person with
   their chores, tap to check. Enter from the menu or with ?family=1. */
import { S, esc, fmtT, todayS, taskOccursOn, taskDoneOn, doneSet, scheduledToday, profOf } from "../core/data.js";
import { who, assigneeOn, people } from "../core/people.js";
import { liturgyLine, applyLiturgy, registerScreen } from "../app/shell.js";
import { findPrayer } from "../content/prayers.js";
import { $, A, ICON } from "../ui/dom.js";

let on = false;
export const familyModeOn = () => on;

export function renderFamily() {
  if (!on) return;
  const now = new Date(), date = todayS(), hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const c = applyLiturgy(now), line = liturgyLine(now);
  const dn = doneSet(date);
  const practices = (S.state.practices || []).filter((p) => scheduledToday(p, now));
  const next = practices.find((p) => p.time >= hhmm && !dn.has(p.id));
  const members = S.house.members || [];
  const keptBy = (p) => members.filter((u) => (((S.state.rhythmDone || {})[date] || {})[u] || []).includes(p.id));

  const cols = [...members.map((u) => who(u)), ...people().map((p) => who("p:" + p.id))];
  const tasksFor = (key) => S.items.filter((t) => t.kind === "task" && taskOccursOn(t, date) && (assigneeOn(t, date) === key));
  const together = S.items.filter((t) => t.kind === "task" && taskOccursOn(t, date) && assigneeOn(t, date) === "together");

  $("family").innerHTML = `
    <div class="fm-head">
      <div><div class="fm-date">${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      <div class="fm-lit">${esc(line.main)}${line.sub ? " · " + esc(line.sub) : ""} · ${c.name}</div></div>
      <div class="fm-clock" id="fm-clock">${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
    </div>
    ${next ? `<div class="fm-next"><div class="fm-next-t">${fmtT(next.time)}</div><div><div class="fm-next-n">${esc(next.name)}</div><div class="fm-next-s">The house rings · ${next.mins} min${findPrayer(next.name) ? ` · <button class="fm-link" onclick="A.openPrayer('${esc(next.name)}')">pray now</button>` : ""}</div></div></div>`
           : `<div class="fm-next quiet"><div class="fm-next-n">${practices.length && practices.every((p) => dn.has(p.id)) ? "The rule is kept today. Deo gratias." : "No more bells today."}</div></div>`}
    <div class="fm-grid">
      <div class="fm-col rhythm">
        <div class="fm-col-h">The rhythm</div>
        ${practices.map((p) => `<div class="fm-row ${dn.has(p.id) ? "done" : ""}" onclick="A.togglePractice('${p.id}')"><div class="fm-time">${fmtT(p.time)}</div><div class="fm-name">${p.emoji || "🙏"} ${esc(p.name)}</div><div class="kept">${keptBy(p).map((u) => `<span class="av sm ${u === S.user.uid ? "me" : ""}">${esc(profOf(u).initials)}</span>`).join("")}</div></div>`).join("") || '<div class="fm-empty">No practices set.</div>'}
      </div>
      ${cols.map((w) => { const ts = tasksFor(w.key); return `<div class="fm-col"><div class="fm-col-h">${w.emoji ? w.emoji + " " : ""}${esc(w.name)}</div>
        ${ts.map((t) => { const d = taskDoneOn(t, date); return `<div class="fm-row ${d ? "done" : ""}" onclick="toggleTaskOn('${t.id}','${date}')"><div class="fm-chk ${d ? "on" : ""}">${ICON.check}</div><div class="fm-name">${esc(t.text)}</div></div>`; }).join("") || '<div class="fm-empty">Nothing today.</div>'}</div>`; }).join("")}
      ${together.length ? `<div class="fm-col"><div class="fm-col-h">🏡 Together</div>${together.map((t) => { const d = taskDoneOn(t, date); return `<div class="fm-row ${d ? "done" : ""}" onclick="toggleTaskOn('${t.id}','${date}')"><div class="fm-chk ${d ? "on" : ""}">${ICON.check}</div><div class="fm-name">${esc(t.text)}</div></div>`; }).join("")}</div>` : ""}
    </div>
    <button class="fm-exit" onclick="A.closeFamilyMode()">Exit family mode</button>`;
}

A.openFamilyMode = () => { on = true; document.body.classList.add("family-on"); $("family").classList.remove("hide"); renderFamily(); A.closeSheet && A.closeSheet(); };
A.closeFamilyMode = () => { on = false; document.body.classList.remove("family-on"); $("family").classList.add("hide"); };
setInterval(() => { const el = $("fm-clock"); if (el && on) el.textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }, 15000);
registerScreen("family", renderFamily);
