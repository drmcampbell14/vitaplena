/* Vita Plena — task recurrence engine. Pure: no Firebase, no DOM.
   A task either has a single `due` date or a `repeat` rule:
     { type: "weekly",  days: [0-6] }            0 = Sunday
     { type: "every",   n, anchor: "YYYY-MM-DD" } every n days from anchor
     { type: "monthly", dom }                    day of month, clamped to month length
   Dates are local calendar days as "YYYY-MM-DD" strings; noon is used to dodge DST. */
import { DOWS, ordinal } from "./util.js";

export function scheduledToday(p,d){const dt=d||new Date();return(p.days||[]).includes(dt.getDay());}
export function taskOccursOn(t,dateS){
  if(t.kind!=="task")return false;
  if(t.repeat){
    const d=new Date(dateS+"T12:00");
    if(t.repeat.type==="weekly")return (t.repeat.days||[]).includes(d.getDay());
    if(t.repeat.type==="every"){const a=new Date((t.repeat.anchor||dateS)+"T12:00");const diff=Math.round((d.getTime()-a.getTime())/864e5);return diff>=0&&diff%(Math.max(1,t.repeat.n||1))===0;}
    if(t.repeat.type==="monthly"){
      const dom=Math.max(1,Math.min(31,t.repeat.dom||1));
      const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
      return d.getDate()===Math.min(dom,lastDay);
    }
    return false;
  }
  return t.due===dateS;
}
export function taskDoneOn(t,dateS){return t.repeat?!!((t.doneDates||{})[dateS]):!!t.done;}

/* Events are done once, for the household — an event either happened or it did not,
   so there is nothing to record per person and nothing to record per date. Google
   Calendar events are stored the same way; the sync writes named fields only, so a
   `done` mark set here survives the next pull. */
export function eventDoneOn(e){ return !!e.done; }

/* ---------------- bills ----------------
   A bill is not a task: it has an amount, it is either monthly on a day of the
   month or once on a date, and "paid" is tracked per month rather than once.
   Keeping kind:"bill" separate means every task and event filter in the app
   ignores bills without any extra work. */
const lastDayOf=(y,m)=>new Date(y,m,0).getDate();      // m is 1-based
const pad2=n=>String(n).padStart(2,"0");

/** The day this bill falls due in a given month, clamped to short months. */
export function billDueInMonth(b,ym){ const [y,m]=ym.split("-").map(Number); return `${ym}-${pad2(Math.min(+b.dueDom||1,lastDayOf(y,m)))}`; }

/** Does this bill fall due on this date? */
export function billDueOn(b,dateS){
  if(b.kind!=="bill")return false;
  if(b.dueDom)return billDueInMonth(b,dateS.slice(0,7))===dateS;
  return !!b.due&&b.due===dateS;
}
/** The period a payment belongs to: "YYYY-MM" for a monthly bill, "once" otherwise. */
export function billPeriod(b,dateS){ return b.dueDom?dateS.slice(0,7):"once"; }
/** Has this bill been paid for the period containing this date? */
export function billPaidOn(b,dateS){ return b.dueDom?!!((b.paidMonths||{})[dateS.slice(0,7)]):!!b.paid; }
/** The next date this bill falls due on or after `fromS`, or null if it never will. */
export function nextBillDate(b,fromS){
  if(!b.dueDom)return b.due&&b.due>=fromS?b.due:null;
  const [y,m]=fromS.slice(0,7).split("-").map(Number);
  const here=billDueInMonth(b,fromS.slice(0,7));
  if(here>=fromS)return here;
  const ny=m===12?y+1:y, nm=m===12?1:m+1;
  return billDueInMonth(b,`${ny}-${pad2(nm)}`);
}

/** Is this item crossed off on this date, whatever kind it is. */
export function itemDoneOn(i,dateS){ return i.kind==="event"?eventDoneOn(i):taskDoneOn(i,dateS); }

export function repeatLabel(t){
  if(!t.repeat)return t.due?("Due "+new Date(t.due+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})):"";
  if(t.repeat.type==="weekly"){ const ds=t.repeat.days||[]; if(ds.length===7)return "↻ daily"; return "↻ "+[1,2,3,4,5,6,0].filter(d=>ds.includes(d)).map(d=>DOWS[d]).join(" · "); }
  if(t.repeat.type==="monthly")return "↻ the "+ordinal(t.repeat.dom||1)+" of each month";
  return "↻ every "+t.repeat.n+" days";
}
