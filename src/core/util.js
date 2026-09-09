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

/* ---------------- text coming in from the outside ----------------
   Universalis serves HTML, so its strings carry entities (&rsquo;, &#8217;, &nbsp;).
   esc() would re-escape the ampersand and the reader would see the entity spelled
   out. Decode first, then strip tags, then esc() on the way into the page. */
const ENTITIES={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"–",mdash:"—",
  lsquo:"‘",rsquo:"’",ldquo:"“",rdquo:"”",hellip:"…",
  eacute:"é",egrave:"è",agrave:"à",ccedil:"ç",uuml:"ü",ouml:"ö",
  auml:"ä",iacute:"í",oacute:"ó",aacute:"á",uacute:"ú",ntilde:"ñ",
  deg:"°",sect:"§",dagger:"†",bull:"•",middot:"·",times:"×",
  copy:"©",reg:"®",trade:"™",laquo:"«",raquo:"»",prime:"′"};

/** Turn HTML entities back into the characters they stand for. */
export function unentity(s){
  return String(s??"").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,(m,body)=>{
    if(body[0]==="#"){
      const n=body[1]==="x"||body[1]==="X"?parseInt(body.slice(2),16):parseInt(body.slice(1),10);
      return Number.isFinite(n)&&n>0&&n<=0x10FFFF?String.fromCodePoint(n):m;
    }
    const c=ENTITIES[body]??ENTITIES[body.toLowerCase()];
    return c===undefined?m:c;
  });
}

/** Outside HTML to a clean single line: decode entities, drop tags, tidy whitespace. */
export function plain(v){
  const raw=v&&typeof v==="object"?(v.text??v.source??""):v;
  return unentity(String(raw??"").replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g,""))
    .replace(/\s+/g," ").trim();
}

