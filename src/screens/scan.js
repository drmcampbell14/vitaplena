/* Vita Plena — scan a schedule into the calendar.
   Take or choose a photo; it is shrunk in the browser, read by the scan
   function, and the events come back for review. Nothing is added until you
   say so, and you can untick any row first. */
import { S, esc, addItem, todayS } from "../core/data.js";
import { callFn } from "../lib/api.js";
import { $, A, ICON, openSheet, closeSheet, toast } from "../ui/dom.js";

const MAX_EDGE = 1600;          // long side, in pixels — plenty to read a printed schedule
let found = [];                 // the last scan's events, for the review sheet

/** Shrink a photo to a JPEG the function will accept quickly. */
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

const fmtT = t => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return ((h % 12) || 12) + ":" + String(m).padStart(2, "0") + (h >= 12 ? " PM" : " AM"); };
const fmtD = ds => new Date(ds + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function reviewPane(note) {
  const rows = found.map((e, i) => `<div class="row">
    <button class="chk ${e.on ? "on" : ""}" onclick="A.scanToggle(${i})" aria-label="${e.on ? "Will add" : "Won't add"}">${ICON.check}</button>
    <div class="grow"><div class="title">${esc(e.title)}</div><div class="kind">${fmtD(e.date)}${e.time ? " · " + fmtT(e.time) : " · all day"}${e.endTime ? "–" + fmtT(e.endTime) : ""}${e.location ? " · " + esc(e.location) : ""}</div></div>
  </div>`).join("");
  const n = found.filter(e => e.on).length;
  return `<div class="reader" data-pane="scan"><div class="eyebrow lit">From the photo</div>
    <div class="r-title" style="font-size:30px">${found.length ? found.length + " event" + (found.length === 1 ? "" : "s") + " found" : "Nothing found"}</div>
    <div class="r-note">${found.length ? "Untick anything that's wrong, then add the rest. They go on the household calendar." : esc(note || "That didn't look like a schedule. Try a clearer photo, straight on, with the dates visible.")}</div>
    <div style="margin-top:14px">${rows}</div>
    <div class="amen" style="margin-top:22px">${found.length ? `<button class="btn block" onclick="A.scanAdd()" ${n ? "" : "disabled"}>Add ${n} to the calendar</button>` : `<button class="btn block" onclick="A.scanSchedule()">Try another photo</button>`}</div>
  </div>`;
}
function repaint(note) { if (document.querySelector('.sheet.open [data-pane="scan"]')) $("sheet-body").innerHTML = reviewPane(note); }

/** Open the camera or the photo picker. */
A.scanSchedule = () => {
  let input = $("scan-file");
  if (!input) {
    input = document.createElement("input"); input.type = "file"; input.id = "scan-file";
    input.accept = "image/*"; input.setAttribute("capture", "environment"); input.style.display = "none";
    input.addEventListener("change", () => { const f = input.files && input.files[0]; input.value = ""; if (f) A.scanFile(f); });
    document.body.appendChild(input);
  }
  input.click();
};

A.scanFile = async (file) => {
  found = [];
  openSheet(`<div class="reader" data-pane="scan"><div class="eyebrow lit">From the photo</div><div class="r-title" style="font-size:30px">Reading it…</div><div class="r-note">A few seconds. The photo is shrunk on your phone before it's sent.</div></div>`, { cls: "full" });
  try {
    const image = await shrink(file);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const r = await callFn("scan", { image, today: todayS(), tz });
    A.scanReview(r.events, r.note);
  } catch (e) {
    found = [];
    if (document.querySelector('.sheet.open [data-pane="scan"]'))
      $("sheet-body").innerHTML = `<div class="reader" data-pane="scan"><div class="eyebrow lit">From the photo</div><div class="r-title" style="font-size:30px">Couldn't read it</div><div class="r-note">${esc(e?.error || e?.message || "Something went wrong.")}</div><div class="amen" style="margin-top:22px"><button class="btn block" onclick="A.scanSchedule()">Try again</button></div></div>`;
  }
};
/** Show a list of found events for review. The seam between the function's answer and the sheet. */
A.scanReview = (events, note) => { found = (events || []).map(e => ({ ...e, on: true })); if (!document.querySelector('.sheet.open [data-pane="scan"]')) openSheet(reviewPane(note), { cls: "full" }); else repaint(note); };
A.scanToggle = i => { if (found[i]) { found[i].on = !found[i].on; repaint(); } };
A.scanAdd = async () => {
  const pick = found.filter(e => e.on);
  if (!pick.length) return;
  for (const e of pick) await addItem({ kind: "event", title: e.title, date: e.date, time: e.time || "", endTime: e.endTime || "", location: e.location || "", area: "together", source: "scan", note: e.note || "" });
  closeSheet(); toast(`${pick.length} event${pick.length === 1 ? "" : "s"} added`);
  if (S.tab !== "calendar") A.go("calendar");
};
