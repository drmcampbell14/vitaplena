/* Vita Plena — Today: the rhythm view.
   Greeting → capture bar (Beacon) → the next bell → Morning / The Day / Evening →
   kept ring → focus and countdowns. A Me / Household switch filters the agenda:
   Me is my practices, my tasks and events; Household is everyone's, with who has
   kept what. */
import { S, esc, rid, fmtT, todayS, dayIdx, QUOTES, saveKey, taskOccursOn, taskDoneOn, repeatLabel,
  doneSet, scheduledToday, profOf, partnerName, tagCls, fastAbstinence } from "../core/data.js";
import { findPrayer } from "../content/prayers.js";
import { who, assigneeOn, mineOn } from "../core/people.js";
import { $, A, ICON, openModal, closeModal, toast } from "../ui/dom.js";
import { registerScreen } from "../app/shell.js";

const nowHHMM=()=>{const n=new Date();return String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");};
const hourOf=t=>+(t||"23:59").slice(0,2);

/** Everything on today's timeline, as {t, kind, ...}, filtered by the Me/Household view. */
export function todayTimeline(view=S.view){
  const date=todayS(), me=S.user.uid, dn=doneSet(date);
  const mineEv=e=>e.area==="together"||(e.area?e.area===me:e.owner===me);
  const mineTask=t=>mineOn(t,date);
  const items=[];
  (S.state.practices||[]).filter(p=>scheduledToday(p)).forEach(p=>items.push({t:p.time||"23:58",kind:"practice",p,done:dn.has(p.id)}));
  S.items.filter(i=>i.kind==="event"&&i.date===date&&(view==="house"||mineEv(i))).forEach(e=>items.push({t:e.time||"00:00",kind:"event",e}));
  S.items.filter(i=>i.kind==="task"&&taskOccursOn(i,date)&&(view==="house"||mineTask(i))).forEach(tk=>{
    const w=tk.whenHint; const t=w&&w.includes(":")?w:w==="morning"?"08:30":w==="afternoon"?"13:00":w==="evening"?"18:30":"23:59";
    items.push({t,kind:"task",tk,done:taskDoneOn(tk,date)});
  });
  return items.sort((a,b)=>a.t.localeCompare(b.t));
}

function render(){
  const now=new Date(), date=todayS(), me=S.user.uid;
  const h=now.getHours();
  const q=QUOTES[dayIdx(now)%QUOTES.length];
  const tl=todayTimeline();
  const hhmm=nowHHMM();

  /* alerts */
  const alerts=[];
  const overdue=S.items.filter(i=>i.kind==="task"&&!i.repeat&&!i.done&&i.due&&i.due<date&&mineOn(i,date)).length;
  const conf=(S.state.confession||{})[me]||{};
  const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).slice().sort();
  if(clog.length){ const days=Math.floor((now-new Date(clog[clog.length-1]+"T12:00"))/864e5); if(days>=(conf.cadence||14))alerts.push(`<span class="chip gold">🕊 ${days} days since Confession</span>`); }
  const mr=S.state.marriageRhythm||"weekly", dow=now.getDay();
  if(mr==="daily"||(mr==="weekly"&&dow===0)||(mr==="monthly"&&now.getDate()===1))alerts.push(`<span class="chip lit" onclick="A.go('us')">💛 ${mr==="daily"?"Daily words":mr==="weekly"?"Weekly check-in":"Monthly sit-down"} with ${esc(partnerName())}</span>`);
  const fa=fastAbstinence(now); if(fa&&fa.abstinence)alerts.push(`<span class="chip warn">🐟 ${esc(fa.label)}</span>`);
  if(overdue)alerts.push(`<span class="chip warn" onclick="A.go('tasks')">${overdue} overdue task${overdue>1?"s":""}</span>`);

  /* next */
  const next=tl.find(x=>!x.done&&x.t>=hhmm&&x.kind!=="task");
  const nextHtml=next?nextCard(next):(tl.length?`<div class="card tint"><div class="eyebrow lit">The day</div><div class="disp" style="font-size:22px;margin-top:4px">${tl.every(x=>x.done||x.kind==="event")?"The rhythm is kept today. Deo gratias.":"Nothing more is scheduled. A quiet evening."}</div></div>`:`<div class="card tint"><div class="eyebrow lit">Your rule</div><div class="disp" style="font-size:22px;margin-top:4px">No practices yet. Set up your rule from the menu.</div></div>`);

  /* groups */
  const groups=[["Morning",x=>hourOf(x.t)<11],["The Day",x=>hourOf(x.t)>=11&&hourOf(x.t)<17],["Evening",x=>hourOf(x.t)>=17]];
  let firstNow=next;
  const tlHtml=groups.map(([label,f])=>{
    const rows=tl.filter(f); if(!rows.length)return "";
    return `<div class="tl-group"><div class="tl-head"><div class="t">${label}</div><div class="n">${rows.length}</div></div><div class="tl">${rows.map(x=>row(x,x===firstNow)).join("")}</div></div>`;
  }).join("")||`<div class="card"><div class="empty">Nothing scheduled. A quiet day, Deo gratias.</div></div>`;

  /* ring: my practices + my tasks */
  const mine=todayTimeline("me").filter(x=>x.kind!=="event"&&!(x.kind==="task"&&assigneeOn(x.tk,date)!==me&&assigneeOn(x.tk,date)!=="together"));
  const kept=mine.filter(x=>x.done).length, total=mine.length;
  const off=total?Math.round(163*(1-kept/total)):163;

  /* focus + countdowns */
  const focus=(S.state.focus||[]);
  const cds=(S.state.countdowns||[]).concat(S.house.countdown&&S.house.countdown.date?[{id:"house",label:S.house.countdown.label||"Goal",date:S.house.countdown.date}]:[]).filter(c=>c.date).sort((a,b)=>a.date.localeCompare(b.date));

  $("page-today").innerHTML=`
    <div class="greet">
      <div class="g1">${h<12?"Good morning":h<17?"Good afternoon":"Good evening"}, ${esc(S.profile?.name||"friend")}.</div>
      <div class="g2 verse-line">“${esc(q[0])}” <span class="muted" style="font-style:normal;font-family:var(--sans);font-size:13px">— ${esc(q[1])}</span></div>
    </div>
    ${alerts.length?`<div class="alerts">${alerts.join("")}</div>`:""}
    <div class="capture">
      <input id="cap-in" placeholder="Tell Beacon: rosary at 8, vacuum Tuesdays, Liz…" onkeydown="if(event.key==='Enter')A.captureSend()" autocomplete="off">
      <button class="iconbtn ghost" id="cap-mic" onclick="A.beaconMic('cap-in','cap-mic')" aria-label="Speak">${ICON.mic}</button>
      <button class="iconbtn lit" onclick="A.captureSend()" aria-label="Send">${ICON.send}</button>
    </div>
    ${S.lastBeacon?`<div class="beacon-reply"><div class="who">Beacon</div>${esc(S.lastBeacon.say)}${S.lastBeacon.chips?.length?`<div class="chips">${S.lastBeacon.chips.map(c=>`<span class="chip ${c.terra?"warn":"lit"}">${esc(c.label)}</span>`).join("")}</div>`:""}</div>`:""}
    <div class="seg" style="margin-bottom:14px"><button class="${S.view==="me"?"on":""}" onclick="A.setView('me')">Me</button><button class="${S.view==="house"?"on":""}" onclick="A.setView('house')">Household</button></div>
    ${nextHtml}
    ${S.briefing?`<div class="card tint"><div class="eyebrow lit">The week ahead · ${new Date(S.briefing.weekOf+"T12:00").toLocaleDateString(undefined,{month:"long",day:"numeric"})}</div><div class="brief">${esc(S.briefing.text)}</div></div>`:""}
    ${tlHtml}
    <div class="card" style="margin-top:18px"><div class="ring-wrap">
      <svg class="ring" viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="26"/><circle class="fg" cx="30" cy="30" r="26" stroke-dasharray="163" stroke-dashoffset="${off}"/></svg>
      <div><div class="ring-lbl">${kept} of ${total} kept</div><div class="ring-sub">${total&&kept===total?"The whole rule, today. Deo gratias.":kept?"Underway.":"Begin whenever you're ready."}</div></div>
    </div></div>
    <div class="two">
      <div class="card"><div class="sec-row"><div class="sec-sm">This week</div><button class="editp" onclick="A.addFocusModal()">${ICON.plus}</button></div>
        ${focus.map(f=>`<div class="row"><button class="chk ${f.done?"on":""}" onclick="A.toggleFocus('${f.id}')">${ICON.check}</button><div class="grow title ${f.done?"done-text":""}" style="font-size:15px">${esc(f.text)}</div><button class="x" onclick="A.rmFocus('${f.id}')">×</button></div>`).join("")||'<div class="empty">One focus for the week.</div>'}
      </div>
      <div class="card"><div class="sec-row"><div class="sec-sm">Counting toward</div><button class="editp" onclick="A.openCountdownModal()">${ICON.plus}</button></div>
        ${cds.map(c=>{const d=Math.ceil((new Date(c.date+"T12:00")-now)/864e5);return `<div class="row"><div class="grow"><div class="title" style="font-size:15px">${esc(c.label)}</div><div class="sub">${new Date(c.date+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div></div><div class="disp" style="font-size:24px;color:var(--lit-deep)">${d>=0?d+"d":"past"}</div></div>`;}).join("")||'<div class="empty">A feast, a trip, a due date.</div>'}
      </div>
    </div>`;
}

function nextCard(x){
  if(x.kind==="practice"){
    const pr=findPrayer(x.p.name);
    return `<div class="card lit next">
      <div class="nx-time">${fmtT(x.p.time).replace(/ (AM|PM)/,"")}<small>${fmtT(x.p.time).slice(-2)} · the house rings</small></div>
      <div class="grow"><div class="nx-title">${esc(x.p.name)}</div><div class="nx-sub">${x.p.mins} min${pr?" · "+esc(pr.why):""}</div></div>
      <button class="btn paper sm" onclick="${pr?`A.openPrayer('${esc(x.p.name)}')`:`A.togglePractice('${x.p.id}')`}">${pr?"Pray":"Kept"}</button>
    </div>`;
  }
  return `<div class="card lit next">
    <div class="nx-time">${x.e.time?fmtT(x.e.time).replace(/ (AM|PM)/,""):"All"}<small>${x.e.time?fmtT(x.e.time).slice(-2):"day"} · next</small></div>
    <div class="grow"><div class="nx-title">${esc(x.e.title)}</div><div class="nx-sub">${x.e.location?esc(x.e.location):(x.e.ownerName?esc(x.e.ownerName):"Event")}</div></div>
  </div>`;
}

function row(x,isNow){
  const date=todayS();
  if(x.kind==="practice"){
    const p=x.p, pr=findPrayer(p.name);
    const keptBy=(S.house.members||[]).filter(u=>(((S.state.rhythmDone||{})[date]||{})[u]||[]).includes(p.id));
    const avs=S.view==="house"&&keptBy.length?`<span class="kept">${keptBy.map(u=>`<span class="av sm ${u===S.user.uid?"me":""}">${esc(profOf(u).initials)}</span>`).join("")}</span>`:"";
    return `<div class="tl-row ${x.done?"done":""} ${isNow?"now":""}">
      <div class="tl-time"><b>${fmtT(p.time).replace(/ (AM|PM)/,"")}</b>${fmtT(p.time).slice(-2)}</div>
      <div class="tl-ico pr">${p.emoji||"🙏"}</div>
      <div class="grow"><div class="title ${x.done?"done-text":""}">${esc(p.name)}</div><div class="kind">${p.mins} min${pr?` · <button class="link" style="font-size:12.5px" onclick="A.openPrayer('${esc(p.name)}')">pray →</button>`:""}${avs}</div></div>
      <button class="donebtn ${x.done?"on":""}" onclick="A.togglePractice('${p.id}')">${x.done?"Kept":"Done"}</button>
    </div>`;
  }
  if(x.kind==="event"){
    const e=x.e;
    return `<div class="tl-row ${isNow?"now":""}" onclick="A.openEventModal('${e.id}')">
      <div class="tl-time"><b>${e.time?fmtT(e.time).replace(/ (AM|PM)/,""):"—"}</b>${e.time?fmtT(e.time).slice(-2):"all day"}</div>
      <div class="tl-ico ev">${e.protected?"🛡":e.source==="gcal"?"G":"📅"}</div>
      <div class="grow"><div class="title">${esc(e.title)}</div><div class="kind">${e.location?esc(e.location):e.protected?"Protected time":"Event"}${e.endTime?" · until "+fmtT(e.endTime):""}</div></div>
      <span class="owner-tag ${tagCls(e)}">${esc(e.ownerInitials||"")}</span>
    </div>`;
  }
  const t=x.tk;
  return `<div class="tl-row ${x.done?"done":""}">
    <button class="chk ${x.done?"on":""}" onclick="A.toggleTaskOn('${t.id}','${date}')">${ICON.check}</button>
    <div class="grow"><div class="title ${x.done?"done-text":""}">${esc(t.text)}</div><div class="kind">${(w=>w.kind==="together"?"Together":"For "+esc(w.name))(who(assigneeOn(t,date)))}${t.rotate?.length>1?" · rotates":""}${repeatLabel(t)?" · "+repeatLabel(t):""}</div></div>
    <button class="editp" onclick="A.openTaskModal(null,null,'${t.id}')">${ICON.edit}</button>
  </div>`;
}

A.setView=v=>{ S.view=v; render(); };
A.toggleTaskOn=(id,dateS)=>{ window.toggleTaskOn(id,dateS); };
A.captureSend=async()=>{
  const inp=$("cap-in"); const text=inp.value.trim(); if(!text)return;
  inp.value=""; inp.placeholder="Beacon is ordering the day…";
  const reply=await A.beaconSend(text,{inline:true});
  inp.placeholder="Tell Beacon: rosary at 8, vacuum Tuesdays, Liz…";
  if(reply){ S.lastBeacon=reply; render(); setTimeout(()=>{ if(S.lastBeacon===reply){S.lastBeacon=null;render();} },20000); }
};
A.addFocusModal=()=>openModal(`<h3>This week's focus</h3><label class="f">One thing</label><input id="m-focus" placeholder="e.g. Finish the case notes by Thursday">
  <div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.addFocus()">Add</button></div>`);
A.addFocus=()=>{ const v=$("m-focus").value.trim(); if(!v)return; saveKey("focus",(S.state.focus||[]).concat([{id:rid(),text:v,done:false}])); closeModal(); };
A.toggleFocus=id=>saveKey("focus",(S.state.focus||[]).map(f=>f.id===id?{...f,done:!f.done}:f));
A.rmFocus=id=>saveKey("focus",(S.state.focus||[]).filter(f=>f.id!==id));
A.openCountdownModal=()=>openModal(`<h3>Counting toward</h3><label class="f">What</label><input id="m-cd-label" placeholder="Easter · the trip · the due date"><label class="f">When</label><input id="m-cd-date" type="date">
  <div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createCountdown()">Add</button></div>`);
A.createCountdown=()=>{ const l=$("m-cd-label").value.trim(), d=$("m-cd-date").value; if(!l||!d)return toast("Add a label and a date"); saveKey("countdowns",(S.state.countdowns||[]).concat([{id:rid(),label:l,date:d}])); closeModal(); };

registerScreen("today",render);
