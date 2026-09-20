/* Vita Plena — App Store / Play Store screenshots, from the sample household.
   Renders the built site in headless Chromium at each store's exact pixel size,
   then frames every shot with a caption on the Marian field.

   Needs the built site served and Playwright present (not a dependency of the
   app; install it for the run only):
     npm run build && npx vite preview --port 4313 &
     npm i --no-save playwright && node scripts/store-shots.mjs 4313
   Output: store/screenshots/<device>/<n>-<name>.png

   Sizes (App Store Connect, 2026): iPhone 6.7" 1290×2796 (required),
   iPad 13" 2048×2732 (required when the app runs on iPad). Google Play takes
   the phone set as-is (16:9 to 9:16, ≥ 320 px). */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const PORT = process.argv[2] || "4313";
const BASE = `http://localhost:${PORT}`;
const OUT = "store/screenshots";

const DEVICES = [
  { key: "iphone-6.7", vw: 430, vh: 932, dpr: 3, w: 1290, h: 2796, band: 430, radius: 64, scale: 0.86, fs: 0.075, sub: 0.03 },
  { key: "ipad-13",    vw: 1024, vh: 1366, dpr: 2, w: 2048, h: 2732, band: 440, radius: 48, scale: 0.80, fs: 0.05, sub: 0.021 }
];

/* Today's readings, so the reader has something to show wherever this runs.
   The live app takes them from the deploy-time index (public/data/lectionary). */
const TODAY = new Date();
const ymd = TODAY.getFullYear() + "-" + String(TODAY.getMonth() + 1).padStart(2, "0") + "-" + String(TODAY.getDate()).padStart(2, "0");
const READINGS = { day: "Sunday of the 25th week in Ordinary Time", readings: [
  { label: "First Reading", source: "Amos 8:4-7" }, { label: "Responsorial Psalm", source: "Psalm 112(113):1-2,4-6,7-8" },
  { label: "Second Reading", source: "1 Timothy 2:1-8" }, { label: "Gospel Acclamation", source: "cf. 2 Corinthians 8:9" }, { label: "Gospel", source: "Luke 16:1-13" } ] };

const SHOTS = [
  { name: "today", url: "/?demo=1", caption: "The house keeps the hours.", sub: "Prayer, work, family and rest, in one day." },
  { name: "bell", url: "/?demo=1", caption: "The house rings.", sub: "A bell at every hour of prayer, even when the app is closed.",
    setup: (p) => p.evaluate(() => window.A.showBell({ id: "p3", name: "Angelus", time: "12:00", mins: 5 })) },
  { name: "pray", url: "/?demo=1&tab=pray", caption: "Tradition speaks.", sub: "The Rosary, the Chaplet, the Examen, the readings of the day." },
  { name: "readings", url: "/?demo=1&tab=pray", caption: "Today at Mass.", sub: "The readings in the Douay-Rheims, in the app.",
    setup: async (p) => { await p.evaluate(() => window.A.openReadings()); await p.waitForTimeout(1500); } },
  { name: "calendar", url: "/?demo=1&tab=calendar", caption: "One calendar for the household.", sub: "Events, bills, feasts, and a photo of any schedule." },
  { name: "tasks", url: "/?demo=1&tab=tasks", caption: "Chores that rotate themselves.", sub: "Assigned to a person, a child, or the two of you." },
  { name: "us", url: "/?demo=1&tab=us", caption: "The weekly check-in.", sub: "Questions worth asking each other." }
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function frame(d, dataUrl, shot) {
  const sw = Math.round(d.w * d.scale), sh = Math.round(sw * d.vh / d.vw);
  return `<!DOCTYPE html><html><head><link rel="stylesheet" href="/fonts/fonts.css"><style>
    html,body{margin:0;width:${d.w}px;height:${d.h}px;overflow:hidden;background:linear-gradient(180deg,#1F4E8C 0%,#16386A 100%);font-family:'Source Sans 3',sans-serif;color:#F5F0E6}
    .cap{position:absolute;left:0;right:0;top:0;height:${d.band}px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;padding:0 ${Math.round(d.w * 0.07)}px ${Math.round(d.band * 0.16)}px;box-sizing:border-box}
    h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:${Math.round(d.w * d.fs)}px;line-height:1.05;margin:0 0 ${Math.round(d.w * 0.012)}px;letter-spacing:-.01em}
    p{margin:0;font-size:${Math.round(d.w * d.sub)}px;line-height:1.3;opacity:.86;font-weight:400}
    .shot{position:absolute;left:${Math.round((d.w - sw) / 2)}px;top:${d.band}px;width:${sw}px;height:${sh}px;border-radius:${d.radius}px;overflow:hidden;box-shadow:0 ${Math.round(d.w * 0.02)}px ${Math.round(d.w * 0.06)}px rgba(0,0,0,.35);border:${Math.max(2, Math.round(d.w * 0.003))}px solid rgba(245,240,230,.25)}
    .shot img{display:block;width:100%;height:100%}
  </style></head><body><div class="cap"><h1>${esc(shot.caption)}</h1><p>${esc(shot.sub)}</p></div><div class="shot"><img src="${dataUrl}"></div></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const d of DEVICES) {
  await mkdir(`${OUT}/${d.key}`, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: d.vw, height: d.vh }, deviceScaleFactor: d.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // the frame is drawn at 1× so the file is exactly d.w × d.h
  const frameCtx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1 });
  // the readings index, served from memory for the run
  await page.route(`**/data/lectionary/${ymd.slice(0, 4)}.json`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ [ymd]: READINGS }) }));
  let n = 0;
  for (const shot of SHOTS) {
    n++;
    await page.goto(BASE + shot.url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    if (shot.setup) await shot.setup(page);
    await page.waitForTimeout(400);
    const raw = await page.screenshot({ type: "png" });
    const framer = await frameCtx.newPage();
    await framer.goto(BASE + "/support.html", { waitUntil: "load" });
    await framer.evaluate((html) => { document.open(); document.write(html); document.close(); }, frame(d, "data:image/png;base64," + raw.toString("base64"), shot));
    await framer.evaluate(() => document.fonts.ready);
    await framer.waitForTimeout(300);
    const file = `${OUT}/${d.key}/${String(n).padStart(2, "0")}-${shot.name}.png`;
    await framer.screenshot({ path: file, type: "png" });
    await framer.close();
    console.log("wrote", file);
  }
  await ctx.close(); await frameCtx.close();
}
await browser.close();
