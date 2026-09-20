/* Vita Plena — the plan: what the household is on, and the paywall.
   Soft and honest. Nothing here locks the rule of life, the calendar or the
   prayers; the subscription keeps Beacon and the Sunday briefing going once
   the trial ends. Stores require the renewal terms to be shown before a
   purchase, so they are, in plain words. */
import { S, esc, todayS } from "../core/data.js";
import { $, A, openSheet, closeSheet, toast } from "../ui/dom.js";
import { renderAll } from "../app/shell.js";
import { billingOn, offerings, buy, restore, packageName } from "../lib/billing.js";
import { SITE, platform } from "../lib/native.js";

/** One line on where the household stands. Used by Settings and by Today. */
export function planLine(house = S.house) {
  const sub = house?.subscription;
  if (!sub) return "Founders' household · no subscription needed";
  if (sub.status === "trial") {
    const left = Math.ceil((new Date(sub.trialEndsAt + "T12:00").getTime() - Date.now()) / 864e5);
    return "Free trial · " + (left > 0 ? left + " days left" : "ended");
  }
  if (sub.status === "active") return "Family plan · active" + (sub.cancelled ? " until " + esc(sub.renewsAt || "the period ends") : sub.renewsAt ? " · renews " + esc(sub.renewsAt) : "");
  if (sub.status === "lapsed") return "Family plan · lapsed";
  return esc(String(sub.status));
}

/** True when the trial has run out and nobody has subscribed. */
export function trialOver(house = S.house) {
  const sub = house?.subscription;
  return !!sub && sub.status === "trial" && !!sub.trialEndsAt && sub.trialEndsAt < todayS();
}

let pkgs = [], chosen = 0, busy = false;

function paywall() {
  const store = platform() === "ios" ? "your Apple ID" : "your Google account";
  const list = pkgs.length
    ? pkgs.map((p, i) => `<button class="choice ${i === chosen ? "on" : ""}" onclick="A.planPick(${i})"><span><div class="c-name">${esc(packageName(p))}</div><div class="c-meta">${esc(p.product?.priceString || "")}${p.packageType === "ANNUAL" ? " a year" : p.packageType === "MONTHLY" ? " a month" : ""}</div></span></button>`).join("")
    : `<div class="hint">Loading plans…</div>`;
  return `<div class="p-body" data-pane="plan">
    <div class="eyebrow">The family plan</div>
    <h2 class="h-sheet">One household. Every member.</h2>
    <p class="hint">Your ${planLine().toLowerCase().replace(" · ", ", ")}. The rule of life, the calendar, the prayers and the bells are yours regardless. The plan keeps Beacon and the Sunday briefing going, and keeps the lights on.</p>
    ${list}
    <div class="amen" style="margin-top:18px"><button class="btn block" onclick="A.planBuy()" ${pkgs.length && !busy ? "" : "disabled"}>${busy ? "One moment…" : "Subscribe"}</button></div>
    <button class="link block" style="margin-top:10px" onclick="A.planRestore()">Restore a purchase</button>
    <p class="hint" style="margin-top:16px;font-size:12.5px">Payment is charged to ${store} when you confirm. The subscription renews automatically at the same price unless you cancel at least 24 hours before the period ends; manage or cancel it in your account settings at any time. <a href="${SITE}/terms.html" target="_blank" rel="noopener">Terms</a> · <a href="${SITE}/privacy.html" target="_blank" rel="noopener">Privacy</a></p>
  </div>`;
}
function repaint() { const el = $("sheet-body"); if (el && el.querySelector('[data-pane="plan"]')) el.innerHTML = paywall(); }

A.openFamilyPlan = async () => {
  if (!billingOn()) {
    openSheet(`<div class="p-body"><div class="eyebrow">The family plan</div><h2 class="h-sheet">${planLine()}</h2>
      <p class="hint">Family subscriptions open with the App Store and Google Play release. Nothing is charged before then, and nothing is locked.</p></div>`);
    return;
  }
  pkgs = []; chosen = 0; busy = false;
  openSheet(paywall());
  try { pkgs = await offerings(); }
  catch (e) { toast("The store isn't answering: " + String(e?.message || e)); }
  if (!pkgs.length) toast("No plans are on offer right now. Try again in a moment.");
  // yearly first when there is one
  pkgs.sort((a, b) => (a.packageType === "ANNUAL" ? -1 : 0) - (b.packageType === "ANNUAL" ? -1 : 0));
  repaint();
};
A.planPick = (i) => { chosen = i; repaint(); };
A.planBuy = async () => {
  const pkg = pkgs[chosen]; if (!pkg || busy) return;
  busy = true; repaint();
  const r = await buy(pkg);
  busy = false;
  if (r.ok) { closeSheet(); toast(r.active ? "Thank you. The household is subscribed." : "Purchase recorded. The plan will show here in a moment."); renderAll(); }
  else if (!r.cancelled) { repaint(); toast(r.error); }
  else repaint();
};
A.planRestore = async () => {
  try { const active = await restore(); toast(active ? "Restored. The household is subscribed." : "No purchase to restore on this account."); if (active) { closeSheet(); renderAll(); } }
  catch (e) { toast("Couldn't restore: " + String(e?.message || e)); }
};
