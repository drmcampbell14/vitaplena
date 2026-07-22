/* VITA PLENA v4 — views/calendar.js */
import { $, esc, fmtT, todayS, ymd, addD, S, SAINTS, DOWS, addItem, delItem,
  taskOccursOn, profOf, tagCls } from "../data.js";
import { agendaTask } from "./today.js";

function eventsOn(dateS){
  return S.items.filter(i=>i.kind==="event"&&i.date===dateS&&(S.calFilter==="all"||i.owner===S.calFilter))
    .sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
}
function evRow(e){
  return `<div class="row"><div class="ev-time">${e.time?fmtT(e.time):"All day"}</div><div class="ev-dot ${tagCls(e)}"></div>
    <div class="grow"><div class="title">${esc(e.title)}</div>${e.location?`<div class="sub">${esc(e.location)}</div>`:""}</div>
    <span class="owner-tag ${tagCls(e)}">${esc(e.ownerInitials||"")}</span>
    ${e.source==="gcal"?'<span title="Google Calendar" style="font-size:12px;color:var(--faint)">G</span>':`<button class="x" onclick="delItem('${e.id}')">×</button>`}</div>`;
}
export function renderCalendar(){
  const cur=S.calCursor,y=cur.getFullYear(),m=cur.getMonth();
  $("cal-month").textContent=cur.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  $("cal-dows").innerHTML=DOWS.map(d=>`<div class="cal-dow">${d}</div>`).join("");
  const first=new Date(y,m,1),start=addD(first,-first.getDay());
  let html="";
  for(let i=0;i<42;i++){
    const d=addD(start,i),ds=ymd(d);
    const evs=S.items.filter(it=>it.kind==="event"&&it.date===ds);
    const sk=String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const nTasks=S.items.filter(it=>it.kind==="task"&&taskOccursOn(it,ds)).length;
    const dots=evs.slice(0,4).map(e=>`<span class="d ${e.owner!==S.user.uid?"p2":""}"></span>`).join("")+(nTasks?'<span class="d task"></span>':"")+(SAINTS[sk]?'<span class="saintdot"></span>':"");
    html+=`<button class="cal-cell ${d.getMonth()!==m?"dim":""} ${ds===todayS()?"today":""} ${ds===S.selDate?"sel":""}" onclick="selDay('${ds}')">${d.getDate()}<div class="dots">${dots}</div></button>`;
  }
  $("cal-grid").innerHTML=html;
  const members=S.house.members||[];
  $("cal-filter").innerHTML=`<button class="pill ${S.calFilter==="all"?"on":""}" onclick="setCalFilter('all')">Both</button>`+
    members.map(u=>`<button class="pill ${S.calFilter===u?"on":""}" onclick="setCalFilter('${u}')">${esc(profOf(u).name)}</button>`).join("");
  const sd=new Date(S.selDate+"T12:00");
  $("sel-day-title").textContent=S.selDate===todayS()?"Today":sd.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  const sk2=String(sd.getMonth()+1).padStart(2,"0")+"-"+String(sd.getDate()).padStart(2,"0");
  $("sel-day-feast").textContent=SAINTS[sk2]?"✝ "+SAINTS[sk2]:"";
  const evs=eventsOn(S.selDate);
  $("day-events").innerHTML=evs.length?evs.map(evRow).join(""):'<div class="empty">No events.</div>';
  const dayTasks=S.items.filter(t=>t.kind==="task"&&taskOccursOn(t,S.selDate)).filter(t=>S.calFilter==="all"||t.area===S.calFilter);
  $("day-tasks").innerHTML=dayTasks.length?dayTasks.map(t=>agendaTask(t,S.selDate)).join(""):'<div class="empty">No tasks for this day.</div>';
  $("gc-banner").style.display=S.gcalConnected?"none":"";
}
window.selDay=ds=>{S.selDate=ds;renderCalendar();};
window.setCalFilter=f=>{S.calFilter=f;window.busRender();};
window.calNav=n=>{S.calCursor=new Date(S.calCursor.getFullYear(),S.calCursor.getMonth()+n,1);renderCalendar();};
window.calToday=()=>{S.calCursor=new Date();S.selDate=todayS();renderCalendar();};

/* quick add event */
window.quickAddEvent=()=>{
  let v=$("ev-in").value.trim();if(!v)return;$("ev-in").value="";
  let time="";
  const m=v.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if(m){let h=+m[1]%12;if(m[3].toLowerCase()==="pm")h+=12;time=String(h).padStart(2,"0")+":"+(m[2]||"00");v=(v.slice(0,m.index)+v.slice(m.index+m[0].length)).trim().replace(/^[-–,·]+\s*/,"");}
  addItem({kind:"event",title:v||"Event",date:S.selDate,time,source:"manual"});
};
export function wireCalendarInputs(){
  $("ev-in").addEventListener("keydown",e=>{if(e.key==="Enter")window.quickAddEvent();});
}
