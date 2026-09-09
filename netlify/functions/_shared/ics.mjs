/* Vita Plena — iCalendar feed builder. Pure: takes household data, returns text.
   Practices become weekly recurring events (RRULE BYDAY); events become single
   VEVENTs. Times are floating local times, which Apple Calendar shows in the
   device's zone, the right behaviour for a household calendar. */

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** "YYYY-MM-DD" + "HH:MM" → "YYYYMMDDTHHMM00" (floating). Date only → "YYYYMMDD". */
export function icsStamp(dateS, timeS) {
  const d = dateS.replace(/-/g, "");
  if (!timeS) return d;
  return d + "T" + timeS.replace(":", "") + "00";
}
function addMinutes(timeS, mins) {
  const [h, m] = timeS.split(":").map(Number);
  const t = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return pad(Math.floor(t / 60)) + ":" + pad(t % 60);
}
/** Fold lines at 75 octets per RFC 5545. */
function fold(line) {
  const out = []; let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
  out.push(s); return out.join("\r\n");
}

/**
 * @param {object} opts
 * @param {string} opts.name household name
 * @param {string} opts.hid household id (for UIDs)
 * @param {Array}  opts.practices [{id,name,time,mins,days}]
 * @param {Array}  opts.events    [{id,title,date,time,endTime,location}]
 * @param {Date}   [opts.now]
 */
export function buildIcs({ name, hid, practices = [], events = [], now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vita Plena//Household//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + esc("Vita Plena · " + name), "X-WR-CALDESC:" + esc("The household's rule of life and events, from Vita Plena.")
  ];
  for (const p of practices) {
    if (!p.time) continue;
    const days = (p.days || []).filter((d) => d >= 0 && d <= 6);
    if (!days.length) continue;
    lines.push("BEGIN:VEVENT",
      "UID:" + esc(`practice-${p.id}@${hid}.vitaplena`),
      "DTSTAMP:" + stamp,
      "DTSTART:" + icsStamp(today, p.time),
      "DTEND:" + icsStamp(today, addMinutes(p.time, p.mins || 10)),
      "RRULE:FREQ=WEEKLY;BYDAY=" + days.map((d) => DAYS[d]).join(","),
      "SUMMARY:" + esc(p.name),
      "DESCRIPTION:" + esc("A practice from the household's rule of life."),
      "CATEGORIES:Prayer",
      "END:VEVENT");
  }
  for (const e of events) {
    if (!e.date) continue;
    const allDay = !e.time;
    lines.push("BEGIN:VEVENT",
      "UID:" + esc(`event-${e.id}@${hid}.vitaplena`),
      "DTSTAMP:" + stamp,
      allDay ? "DTSTART;VALUE=DATE:" + icsStamp(e.date) : "DTSTART:" + icsStamp(e.date, e.time),
      allDay ? "DTEND;VALUE=DATE:" + icsStamp(nextDay(e.date)) : "DTEND:" + icsStamp(e.date, e.endTime || addMinutes(e.time, 60)),
      "SUMMARY:" + esc(e.title || "Event"),
      ...(e.location ? ["LOCATION:" + esc(e.location)] : []),
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
function nextDay(dateS) {
  const d = new Date(dateS + "T12:00:00"); d.setDate(d.getDate() + 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
