/* VITA PLENA v4 — views/today.js — the Today page (ritual home in step 4; agenda now) */
import { $, esc, rid, fmtT, todayS, ymd, addD, dayIdx, S, QUOTES, saveKey, saveField, delItem,
  taskOccursOn, taskDoneOn, repeatLabel, areaTag, doneSet, scheduledToday, profOf, partnerName, tagCls, toast } from "../data.js";

export function renderHome(){
  const now=new Date();
  const q=QUOTES[Math.floor(dayIdx(now))%QUOTES.length];
  $("dq-text").textContent="\u201C"+q[0]+"\u201D";$("dq-who").textContent="— "+q[1];
  const h=now.getHours();
  $("greeting").textContent=(h<12?"Good morning":h<17?"Good afternoon":"Good evening")+", "+(S.profile?.name||"friend")+".";
  $("greet-date").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  const dateS=todayS();
  const overdue=S.items.filter(i=>i.kind==="task"&&!i.repeat&&!i.done&&i.due&&i.due<dateS&&(i.area===S.user.uid||i.area==="together")).length;
  const myConf=(S.state.confession||{})[S.user.uid]||{};
  const myClog=(myConf.log&&myConf.log.length?myConf.log:(myConf.last?[myConf.last]:[])).slice().sort();
  let confChip="";
  if(myClog.length){
    const daysC=Math.floor((new Date()-new Date(myClog[myClog.length-1]+"T12:00"))/864e5);
    const cadC=myConf.cadence||14;
    if(daysC>=cadC)confChip=`<div class="overdue" style="margin-right:8px">🕊️ ${daysC} days since Confession — the font of mercy is open</div>`;
  }
  let relChip="";
  const mr=S.state.marriageRhythm||"weekly";
  const dow=now.getDay();
  if(mr==="daily") relChip=`<div class="overdue" style="margin-right:8px">💛 Daily words with ${partnerName()} today</div>`;
  else if(mr==="weekly" && dow===0) relChip=`<div class="overdue" style="margin-right:8px">💛 Weekly check-in with ${partnerName()} today</div>`;
  else if(mr==="monthly" && now.getDate()===1) relChip=`<div class="overdue" style="margin-right:8px">💛 Monthly sit-down with ${partnerName()} today</div>`;
  $("greet-alerts").innerHTML=confChip+relChip+(overdue?`<div class="overdue">${overdue} overdue task${overdue>1?"s":""}</div>`:"");
  const evToday=S.items.filter(i=>i.kind==="event"&&i.date===dateS).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  $("st-events").textContent=evToday.length;
  const cds=(S.state.countdowns||[]).concat(S.house.countdown&&S.house.countdown.date?[{label:S.house.countdown.label||"Goal",date:S.house.countdown.date}]:[]);
  const next=cds.filter(c=>c.date>=dateS).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(next){const d=Math.ceil((new Date(next.date)-now)/864e5);$("st-count").textContent=d;$("st-count-l").textContent="days · "+next.label;}
  else{$("st-count").textContent="—";$("st-count-l").textContent="Countdown";}
  /* one clean chronological agenda */
  const dn=doneSet(dateS);
  const pr=(S.state.practices||[]).filter(p=>scheduledToday(p));
  const myTasks=S.items.filter(t=>t.kind==="task"&&(t.area===S.user.uid||t.area==="together")&&taskOccursOn(t,dateS));
  const timeline=[];
  pr.forEach(p=>timeline.push({t:p.time||"23:58",html:agendaPractice(p,dn)}));
  evToday.forEach(e=>timeline.push({t:e.time||"00:00",html:agendaEvent(e)}));
  myTasks.forEach(t=>{
    const tm=t.whenHint&&t.whenHint.includes(":")?t.whenHint:(t.whenHint==="morning"?"08:30":t.whenHint==="afternoon"?"13:00":t.whenHint==="evening"?"18:30":"23:59");
    timeline.push({t:tm,html:agendaTask(t,dateS)});
  });
  timeline.sort((a,b)=>a.t.localeCompare(b.t));
  $("home-plan").innerHTML=timeline.map(x=>x.html).join("")||'<div class="empty">Nothing scheduled — a quiet day, Deo gratias.</div>';
  const doneCount=pr.filter(p=>dn.has(p.id)).length+myTasks.filter(t=>taskDoneOn(t,dateS)).length;
  const total=pr.length+myTasks.length;
  $("ring-label").textContent=`${doneCount}/${total} done`;
  $("ring-fg").style.strokeDashoffset=104-(total?doneCount/total*104:0);
  $("streak-chip").textContent = (total>0&&doneCount===total)?"all kept today":(doneCount>0?"underway":"");
  $("focus-list").innerHTML=(S.state.focus||[]).map(f=>`<div class="row"><button class="chk ${f.done?"on":""}" onclick="toggleFocus('${f.id}')">✓</button><div class="grow title ${f.done?"done-text":""}">${esc(f.text)}</div><button class="x" onclick="rmFocus('${f.id}')">×</button></div>`).join("")||'<div class="empty">Nothing added yet.</div>';
  $("countdown-list").innerHTML=cds.length?cds.sort((a,b)=>a.date.localeCompare(b.date)).map(c=>{const d=Math.ceil((new Date(c.date)-now)/864e5);return `<div class="row"><div class="emoji">⏳</div><div class="grow"><div class="title">${esc(c.label)}</div><div class="sub">${new Date(c.date+"T12:00").toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</div></div><div class="title" style="color:var(--sage-deep)">${d>=0?d+"d":"past"}</div></div>`;}).join(""):'<div class="empty">No countdowns yet.</div>';
}
export function agendaPractice(p,dn){
  const on=dn.has(p.id);
  return `<div class="agenda-row"><div class="agenda-time">${fmtT(p.time)}</div><div class="emoji" style="width:26px">${p.emoji||"🙏"}</div><div class="grow"><div class="title ${on?"done-text":""}">${esc(p.name)}</div><div class="kind">Rhythm · ${p.mins} min</div></div><button class="editp" onclick="editPractice('${p.id}')">✎</button><button class="donebtn ${on?"undone":""}" onclick="togglePractice('${p.id}')">${on?"Undo":"Done"}</button></div>`;
}
export function agendaEvent(e){
  return `<div class="agenda-row"><div class="agenda-time">${e.time?fmtT(e.time):"All day"}</div><div class="ev-dot ${tagCls(e)}"></div><div class="grow"><div class="title">${esc(e.title)}</div><div class="kind">Event${e.location?" · "+esc(e.location):""}</div></div><span class="owner-tag ${tagCls(e)}">${esc(e.ownerInitials||"")}</span></div>`;
}
export function agendaTask(t,dateS){
  const on=taskDoneOn(t,dateS);
  return `<div class="agenda-row"><button class="chk ${on?"on":""}" onclick="toggleTaskOn('${t.id}','${dateS}')">✓</button><div class="grow"><div class="title ${on?"done-text":""}">${esc(t.text)}</div><div class="kind">${t.area==="together"?"Together":"For "+esc(profOf(t.area).name)}${repeatLabel(t)?" · "+repeatLabel(t):""}</div></div>${areaTag(t)}<button class="editp" onclick="openTaskModal(null,null,'${t.id}')">✎</button></div>`;
}
/* focus + countdown handlers */
window.addFocus=()=>{const v=$("focus-in").value.trim();if(!v)return;$("focus-in").value="";saveKey("focus",(S.state.focus||[]).concat([{id:rid(),text:v,done:false}]));};
window.toggleFocus=id=>saveKey("focus",(S.state.focus||[]).map(f=>f.id===id?{...f,done:!f.done}:f));
window.rmFocus=id=>saveKey("focus",(S.state.focus||[]).filter(f=>f.id!==id));
window.openCountdownModal=()=>window.openModal(`<h3>New countdown</h3>
  <label class="f">Label</label><input id="m-cd-label" placeholder="Ponte Vedra opening">
  <label class="f">Date</label><input id="m-cd-date" type="date">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createCountdown()">Add</button></div>`);
window.createCountdown=()=>{const l=$("m-cd-label").value.trim(),d=$("m-cd-date").value;if(!l||!d)return;saveKey("countdowns",(S.state.countdowns||[]).concat([{id:rid(),label:l,date:d}]));window.closeModal();};
