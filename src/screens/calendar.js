/* Vita Plena — Calendar: month grid, the selected day's events and tasks,
   quick add, Google Calendar connect. Events carry a source badge (G for Google). */
import { S, esc, fmtT, todayS, ymd, addD, SAINTS, DOWS, addItem, updItem, delItem,
  taskOccursOn, taskDoneOn, repeatLabel, profOf, tagCls, feastKey, liturgicalColor } from "../core/data.js";
import { $, A, ICON, openModal, closeModal, confirmModal, toast } from "../ui/dom.js";
import { registerScreen } from "../app/shell.js";
import { who, assigneeOn } from "../core/people.js";

function eventsOn(dateS){
  return S.items.filter(i=>i.kind==="event"&&i.date===dateS&&(S.calFilter==="all"||i.owner===S.calFilter||i.area===S.calFilter))
    .sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
}
function render(){
  const cur=S.calCursor, y=cur.getFullYear(), m=cur.getMonth();
  const first=new Date(y,m,1), start=addD(first,-first.getDay());
  let cells="";
  for(let i=0;i<42;i++){
    const d=addD(start,i), ds=ymd(d);
    const evs=S.items.filter(it=>it.kind==="event"&&it.date===ds);
    const nTasks=S.items.filter(it=>it.kind==="task"&&taskOccursOn(it,ds)).length;
    const dots=evs.slice(0,3).map(e=>`<span class="d ${e.owner!==S.user.uid?"p2":""}"></span>`).join("")+(nTasks?'<span class="d task"></span>':"");
    cells+=`<button class="cal-cell ${d.getMonth()!==m?"dim":""} ${ds===todayS()?"today":""} ${ds===S.selDate?"sel":""}" onclick="A.selDay('${ds}')">${d.getDate()}<div class="dots">${dots}</div></button>`;
  }
  const members=S.house.members||[];
  const sd=new Date(S.selDate+"T12:00");
  const saint=SAINTS[feastKey(sd)];
  const c=liturgicalColor(sd);
  const evs=eventsOn(S.selDate);
  const dayTasks=S.items.filter(t=>t.kind==="task"&&taskOccursOn(t,S.selDate)).filter(t=>S.calFilter==="all"||assigneeOn(t,S.selDate)===S.calFilter);
  const weekStart=addD(sd,-sd.getDay());
  const weekHtml=[0,1,2,3,4,5,6].map(i=>{ const d=addD(weekStart,i), ds=ymd(d); const evs=eventsOn(ds); const ts=S.items.filter(t=>t.kind==="task"&&taskOccursOn(t,ds)).filter(t=>S.calFilter==="all"||assigneeOn(t,ds)===S.calFilter); const sk=SAINTS[feastKey(d)];
    return `<div class="wk-day ${ds===todayS()?"today":""}" onclick="A.selDay('${ds}')"><div class="wd"><b>${d.toLocaleDateString(undefined,{weekday:"long"})}</b><span>${d.toLocaleDateString(undefined,{month:"short",day:"numeric"})}${sk?" · ✝ "+esc(sk):""}</span></div>${evs.map(e=>`<div class="wk-item"><span class="t">${e.time?fmtT(e.time):"all day"}</span><span>${esc(e.title)}</span></div>`).join("")}${ts.map(t=>`<div class="wk-item"><span class="t">task</span><span class="${taskDoneOn(t,ds)?"done-text":""}">${esc(t.text)} <span class="muted">· ${esc(who(assigneeOn(t,ds)).name)}</span></span></div>`).join("")}${!evs.length&&!ts.length?'<div class="wk-item muted">—</div>':""}</div>`; }).join("");

  $("page-calendar").innerHTML=`
    ${S.gcalConnected?"":`<div class="card tint gc-banner"><div class="grow"><div class="title" style="font-weight:600">Google Calendar</div><div class="hint">Pull your events in. Reconnects each session for now.</div></div><button class="btn sm" onclick="connectGcal()">Connect</button></div>`}
    <div class="card">
      <div class="seg" style="margin-bottom:12px"><button class="${S.calMode!=="week"?"on":""}" onclick="A.calMode('month')">Month</button><button class="${S.calMode==="week"?"on":""}" onclick="A.calMode('week')">Week</button></div>
      ${S.calMode==="week"?`<div class="cal-head"><button class="iconbtn ghost" onclick="A.weekNav(-1)">${ICON.back}</button><div class="mo">Week of ${weekStart.toLocaleDateString(undefined,{month:"long",day:"numeric"})}</div><button class="iconbtn ghost" onclick="A.weekNav(1)">${ICON.chevron}</button></div>${weekHtml}`:`<div class="cal-head"><button class="iconbtn ghost" onclick="A.calNav(-1)">${ICON.back}</button><div class="mo">${cur.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</div><button class="iconbtn ghost" onclick="A.calNav(1)">${ICON.chevron}</button></div>
      <div class="cal-grid">${DOWS.map(d=>`<div class="cal-dow">${d}</div>`).join("")}</div>
      <div class="cal-grid">${cells}</div>`}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
        <div class="pills"><button class="pill ${S.calFilter==="all"?"on":""}" onclick="A.setCalFilter('all')">Everyone</button>${members.map(u=>`<button class="pill ${S.calFilter===u?"on":""}" onclick="A.setCalFilter('${u}')">${esc(profOf(u).name)}</button>`).join("")}</div>
        <button class="link" onclick="A.calToday()">Today</button>
      </div>
    </div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">${S.selDate===todayS()?"Today":sd.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</h2><span class="dayfeast">${saint?"✝ "+esc(saint):c.name}</span></div>
      ${evs.map(e=>`<div class="row" onclick="A.openEventModal('${e.id}')" style="cursor:pointer"><div class="ev-time">${e.time?fmtT(e.time):"All day"}</div><div class="ev-dot ${tagCls(e)}"></div><div class="grow"><div class="title">${esc(e.title)}</div>${e.location?`<div class="sub">${esc(e.location)}</div>`:""}</div><span class="owner-tag ${tagCls(e)}">${e.source==="gcal"?"G":esc(e.ownerInitials||"")}</span></div>`).join("")||'<div class="empty">No events.</div>'}
      <div class="addline"><input id="ev-in" placeholder="Add… 6:30pm Dinner with the Smiths" onkeydown="if(event.key==='Enter')A.quickAddEvent()"><button class="iconbtn" onclick="A.quickAddEvent()">${ICON.plus}</button></div>
      <button class="link" style="margin-top:10px" onclick="A.openEventModal()">More options</button>
    </div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">Tasks that day</h2></div>
      ${dayTasks.map(t=>{const on=taskDoneOn(t,S.selDate);return `<div class="row"><button class="chk ${on?"on":""}" onclick="toggleTaskOn('${t.id}','${S.selDate}')">${ICON.check}</button><div class="grow"><div class="title ${on?"done-text":""}">${esc(t.text)}</div><div class="kind">${(w=>w.kind==="together"?"Together":"For "+esc(w.name))(who(assigneeOn(t,S.selDate)))}${repeatLabel(t)?" · "+repeatLabel(t):""}</div></div><button class="editp" onclick="A.openTaskModal(null,null,'${t.id}')">${ICON.edit}</button></div>`;}).join("")||'<div class="empty">No tasks for this day.</div>'}
    </div>`;
}
A.selDay=ds=>{ S.selDate=ds; render(); };
A.setCalFilter=f=>{ S.calFilter=f; render(); };
A.calNav=n=>{ S.calCursor=new Date(S.calCursor.getFullYear(),S.calCursor.getMonth()+n,1); render(); };
A.calToday=()=>{ S.calCursor=new Date(); S.selDate=todayS(); render(); };
A.calMode=m=>{ S.calMode=m; render(); };
A.weekNav=n=>{ const d=addD(new Date(S.selDate+"T12:00"),7*n); S.selDate=ymd(d); S.calCursor=new Date(d.getFullYear(),d.getMonth(),1); render(); };
A.quickAddEvent=()=>{
  let v=$("ev-in").value.trim(); if(!v)return; $("ev-in").value="";
  let time="";
  const m=v.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if(m){ let h=+m[1]%12; if(m[3].toLowerCase()==="pm")h+=12; time=String(h).padStart(2,"0")+":"+(m[2]||"00"); v=(v.slice(0,m.index)+v.slice(m.index+m[0].length)).trim().replace(/^[-–,·]+\s*/,""); }
  addItem({kind:"event",title:v||"Event",date:S.selDate,time,source:"manual",area:"together"});
  toast("Added");
};
A.openEventModal=id=>{
  const e=id?S.items.find(i=>i.id===id):null;
  if(e&&e.source==="gcal")return toast("That one comes from Google Calendar. Edit it there.");
  const members=S.house.members||[];
  const area=e?(e.area||e.owner):"together";
  openModal(`<h3>${e?"Edit event":"New event"}</h3>
    <label class="f">What</label><input id="m-e-title" value="${e?esc(e.title):""}" placeholder="Dinner with the Smiths">
    <label class="f">Date</label><input id="m-e-date" type="date" value="${e?e.date:S.selDate}">
    <div class="two"><div><label class="f">Starts</label><input id="m-e-time" type="time" value="${e?.time||""}"></div><div><label class="f">Ends</label><input id="m-e-end" type="time" value="${e?.endTime||""}"></div></div>
    <label class="f">Where</label><input id="m-e-loc" value="${e?esc(e.location||""):""}" placeholder="Optional">
    <label class="f">Whose</label><select id="m-e-area"><option value="together" ${area==="together"?"selected":""}>Household</option>${members.map(u=>`<option value="${u}" ${area===u?"selected":""}>${esc(profOf(u).name)}</option>`).join("")}</select>
    <div class="actions">${e?`<button class="btn ghost" onclick="A.rmEvent('${id}')">Delete</button>`:`<button class="btn ghost" onclick="A.closeModal()">Cancel</button>`}<button class="btn" onclick="A.saveEvent('${id||""}')">${e?"Save":"Add"}</button></div>`);
};
A.saveEvent=id=>{
  const title=$("m-e-title").value.trim(); if(!title)return toast("Give it a name");
  const data={kind:"event",title,date:$("m-e-date").value||S.selDate,time:$("m-e-time").value||"",endTime:$("m-e-end").value||"",location:$("m-e-loc").value.trim(),area:$("m-e-area").value,source:"manual"};
  id?updItem(id,data):addItem(data); closeModal();
};
A.rmEvent=id=>{ closeModal(); confirmModal("Delete this event?",()=>delItem(id)); };

registerScreen("calendar",render);
