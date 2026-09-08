/* Vita Plena — tiny DOM layer.
   No framework: screens render HTML strings into their page element and wire
   behaviour through `A`, a global action registry used by inline handlers
   (onclick="A.togglePractice('p1')"). Keeping handlers on one object instead of
   scattered window globals makes them greppable and lets screens register and
   replace their own actions cleanly. */
import { $, esc } from "../core/util.js";
export { $, esc };

/** Action registry. Screens assign: A.doThing = (...) => {}. */
export const A = (window.A = window.A || {});

/** Haptic tap where supported (Android, Capacitor); silently nothing elsewhere. */
export function haptic(pattern=12){ try{ navigator.vibrate && navigator.vibrate(pattern); }catch{ /* no-op */ } }

/* ---------------- modal (small dialogs: forms, confirms) ---------------- */
export function openModal(html){
  $("modal-body").innerHTML=html;
  $("modal").classList.add("open");
  document.body.classList.add("no-scroll");
  setTimeout(()=>{ const f=$("modal-body").querySelector("input:not([type=hidden]),textarea,select"); if(f)f.focus(); },60);
}
export function closeModal(){
  $("modal").classList.remove("open");
  $("modal-body").innerHTML="";
  if(!$("sheet").classList.contains("open"))document.body.classList.remove("no-scroll");
}
let _confirmFn=null;
export function confirmModal(message,fn,{danger=true,yes="Yes, do it"}={}){
  _confirmFn=fn;
  openModal(`<h3>Are you sure?</h3><p class="modal-p">${esc(message)}</p>
    <div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button>
    <button class="btn ${danger?"danger":""}" onclick="A._confirmYes()">${esc(yes)}</button></div>`);
}
A.closeModal=closeModal;
A._confirmYes=()=>{ const f=_confirmFn; _confirmFn=null; closeModal(); if(f)f(); };

/* ---------------- sheet (full-height readers: prayers, Beacon, settings) ---------------- */
export function openSheet(html,{cls=""}={}){
  const s=$("sheet");
  $("sheet-body").innerHTML=html;
  s.className="sheet open "+cls;
  document.body.classList.add("no-scroll");
  $("sheet-body").scrollTop=0;
}
export function closeSheet(){
  const s=$("sheet");
  s.classList.remove("open");
  setTimeout(()=>{ if(!s.classList.contains("open")){ $("sheet-body").innerHTML=""; s.className="sheet"; } },260);
  if(!$("modal").classList.contains("open"))document.body.classList.remove("no-scroll");
}
A.closeSheet=closeSheet;

/* ---------------- toast ---------------- */
let _toastT=null;
export function toast(msg,ms=2200){
  const t=$("toast"); if(!t)return;
  t.textContent=msg; t.classList.add("show");
  clearTimeout(_toastT); _toastT=setTimeout(()=>t.classList.remove("show"),ms);
}

/* ---------------- small formatters ---------------- */
export const initialsOf=name=>(name||"").split(/\s+/).filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"·";

/** Inline SVG icons, stroke-based so they take `currentColor`. */
export const ICON={
  today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  pray:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5v19M7.5 8h9"/><path d="M9 21.5h6" stroke-width="1.6"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l2 2 4-4M4 17l2 2 4-4M13 7h7M13 17h7"/></svg>',
  us:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
  beacon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4.5 4.5L19 7"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v7H4V6h7"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>',
  candle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.5 2 1.5 3.5 0 5-1.5-1.5-1.5-3 0-5z"/><rect x="9" y="9" width="6" height="12" rx="1.5"/></svg>',
  dove:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c4 0 6-2 8-5 1 3 3 4 6 4l4 1-3 2c-2 1-4 5-9 5-3 0-5-2-6-4z"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
