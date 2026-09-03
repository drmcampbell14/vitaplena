/* Vita Plena — small shared helpers. Nothing here touches the DOM at import time,
   so this module is safe to load in Node for tests. $/toast/setVal use `document`
   only when called. */
import { ymd } from "./liturgical.js";

export const $=id=>document.getElementById(id);
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const uid6=()=>Array.from({length:6},()=>"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*31)]).join("");
export const rid=()=>Math.random().toString(36).slice(2,10);
export const money=n=>"$"+(+n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
export const fmtT=t=>{if(!t)return"";const[h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";return((h%12)||12)+":"+String(m).padStart(2,"0")+" "+ap;};
export const todayS=()=>ymd(new Date());
export const dayIdx=d=>Math.floor(d.getTime()/864e5);
export function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2400);}
export function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
export function setVal(id,v){const el=$(id);if(el&&document.activeElement!==el)el.value=v??"";}
export function fmtMins(m){if(m<60)return m+" min";const h=Math.floor(m/60);return h+"h"+(m%60?" "+(m%60)+"m":"");}
export function ordinal(n){const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
export const DOWS=["Su","Mo","Tu","We","Th","Fr","Sa"];
