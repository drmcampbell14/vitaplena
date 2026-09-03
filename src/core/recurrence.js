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
    if(t.repeat.type==="every"){const a=new Date((t.repeat.anchor||dateS)+"T12:00");const diff=Math.round((d-a)/864e5);return diff>=0&&diff%(Math.max(1,t.repeat.n||1))===0;}
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

export function repeatLabel(t){
  if(!t.repeat)return t.due?("Due "+new Date(t.due+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})):"";
  if(t.repeat.type==="weekly")return "↻ "+[1,2,3,4,5,6,0].filter(d=>(t.repeat.days||[]).includes(d)).map(d=>DOWS[d]).join(" · ");
  if(t.repeat.type==="monthly")return "↻ the "+ordinal(t.repeat.dom||1)+" of each month";
  return "↻ every "+t.repeat.n+" days";
}
