/* Vita Plena — app shell: liturgical colour, header, tab bar, page routing, render bus.
   Screens register a render function by tab id; renderAll() redraws every screen
   from the current state, which is cheap at this size and keeps things simple. */
import { S, bus, esc, season, liturgicalColor, feastKey, SAINTS, fastAbstinence } from "../core/data.js";
import { $, A, ICON } from "../ui/dom.js";

export const TABS=[
  {id:"today",label:"Today",icon:ICON.today},
  {id:"pray",label:"Pray",icon:ICON.pray},
  {id:"calendar",label:"Calendar",icon:ICON.calendar},
  {id:"tasks",label:"Tasks",icon:ICON.tasks},
  {id:"us",label:"Us",icon:ICON.us}
];
const screens={};
export function registerScreen(id,render){ screens[id]=render; }

S.tab=S.tab||"today";
S.view=S.view||"me";        // "me" | "house" — the Today agenda filter
S.liturgy=S.liturgy||{};    // { day, readings, loaded } from Universalis (see screens/pray.js)

export function go(id){
  S.tab=id;
  document.querySelectorAll(".page").forEach(s=>s.classList.toggle("on",s.id==="page-"+id));
  document.querySelectorAll("#tabbar button").forEach(b=>b.classList.toggle("on",b.dataset.p===id));
  window.scrollTo({top:0});
  const r=screens[id]; if(r&&S.house)r();
}
A.go=go;

/** Wear the colour of the day: set the accent tokens and the browser chrome colour. */
export function applyLiturgy(d=new Date()){
  const c=liturgicalColor(d), root=document.documentElement.style;
  root.setProperty("--lit",c.hex); root.setProperty("--lit-deep",c.deep);
  root.setProperty("--lit-tint",c.tint); root.setProperty("--lit-ink",c.ink);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.setAttribute("content",c.hex);
  return c;
}

/** Universalis writes "St Peter Claver", our table writes "St. Peter Claver".
    Compare loosely so the same saint is never printed twice on one line. */
const loose=t=>String(t||"").toLowerCase().replace(/[^a-z]/g,"");
export function namesTheSame(haystack,name){ return loose(haystack).includes(loose(name)); }

/** The liturgical line under the date: Universalis' day title when loaded, else season + saint. */
export function liturgyLine(d=new Date()){
  const uni=S.liturgy?.day;
  const saint=SAINTS[feastKey(d)];
  const s=season(d).name;
  if(uni)return {main:uni,sub:saint&&!namesTheSame(uni,saint)?saint:""};
  return {main:s,sub:saint||""};
}

export function renderHeader(){
  const now=new Date();
  applyLiturgy(now);   // sets the accent tokens and the browser chrome colour
  const line=liturgyLine(now);
  const fa=fastAbstinence(now);
  /* Two lines and two buttons, and nothing else. The member avatars used to live
     here and collided with the date on a phone-width screen; who is in the
     household belongs on Us, not in the chrome of every screen. */
  $("hdr").innerHTML=`
    <div class="grow">
      <div class="hdr-date">${now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</div>
      <div class="hdr-lit"><b>${esc(line.main)}</b>${line.sub?" · "+esc(line.sub):""}${fa?" · "+esc(fa.label):""}</div>
    </div>
    <button class="iconbtn lit" onclick="A.openBeacon()" aria-label="Beacon">${ICON.beacon}</button>
    <button class="iconbtn" onclick="A.openMenu()" aria-label="Menu">${ICON.menu}</button>`;
}

export function renderTabbar(){
  $("tabbar").innerHTML=TABS.map(t=>`<button data-p="${t.id}" class="${S.tab===t.id?"on":""}" onclick="A.go('${t.id}')">${t.icon}<span>${t.label}</span></button>`).join("");
}

export function renderAll(){
  if(!S.house)return;
  renderHeader();
  Object.values(screens).forEach(r=>{ try{ r(); }catch(e){ console.error("render failed",e); } });
}
bus.render=renderAll;
window.busRender=renderAll;

let mounted=false;
export function mountShell(){
  if(mounted)return; mounted=true;
  $("loading").classList.add("hide");
  $("gate").classList.add("hide"); $("onboard").classList.add("hide");
  $("hdr").classList.remove("hide"); $("app").classList.remove("hide"); $("tabbar").classList.remove("hide");
  renderTabbar();
  go(S.tab);
}
export function unmountShell(){
  mounted=false;
  $("hdr").classList.add("hide"); $("app").classList.add("hide"); $("tabbar").classList.add("hide");
}
