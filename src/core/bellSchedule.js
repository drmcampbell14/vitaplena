/* Vita Plena — the bells, planned ahead.
   While the app is open, bells.js watches the clock. When the app is closed
   the phone has to ring on its own, so the native shells schedule one local
   notification per bell for the days ahead and refresh that list every time
   the app wakes. This module works out that list. It is pure: no Firebase, no
   DOM, no Capacitor, so it is tested directly. */

/** Is `hhmm` inside the quiet hours? Quiet hours may wrap midnight (22:00 → 06:00).
    @param {string} hhmm  @param {{quietFrom?:string,quietTo?:string}} st */
export function inQuietHours(hhmm, st) {
  const from = st?.quietFrom || "22:00", to = st?.quietTo || "06:00";
  if (from === to) return false;
  return from < to ? (hhmm >= from && hhmm < to) : (hhmm >= from || hhmm < to);
}

/** A stable 31-bit id for one bell on one day, so re-scheduling replaces rather
    than duplicates. Both platforms want a 32-bit signed integer.
    @param {string} practiceId  @param {string} dateS YYYY-MM-DD */
export function notifId(practiceId, dateS) {
  const s = practiceId + "@" + dateS;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;           // positive, never zero
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

/**
 * The bells to schedule from `now` forward.
 * @param {Array<{id:string,name:string,time?:string,days?:number[],mins?:number}>} practices
 * @param {{now?:Date, days?:number, quietFrom?:string, quietTo?:string, done?:Set<string>, max?:number}} [opts]
 *   days   how many days ahead (default 7); iOS keeps at most 64 pending notifications per app
 *   done   practices already kept today; today's bell for those is dropped
 *   max    hard cap on the list, soonest first (default 60)
 * @returns {Array<{id:number,practiceId:string,title:string,body:string,at:Date}>}
 */
export function bellNotifications(practices, opts = {}) {
  const now = opts.now || new Date();
  const days = opts.days ?? 7, max = opts.max ?? 60;
  const done = opts.done || new Set();
  const out = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const dateS = ymd(day);
    for (const p of practices || []) {
      if (!p || !p.id || !p.time || !/^\d{2}:\d{2}$/.test(p.time)) continue;
      if (!(p.days || []).includes(day.getDay())) continue;
      if (d === 0 && done.has(p.id)) continue;
      if (inQuietHours(p.time, opts)) continue;
      const [hh, mm] = p.time.split(":").map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      out.push({ id: notifId(p.id, dateS), practiceId: p.id, title: "The house rings · " + p.name,
        body: "It's time for " + p.name + (p.mins ? " · " + p.mins + " min" : "") + ".", at });
    }
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, max);
}
