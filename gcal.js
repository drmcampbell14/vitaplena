/* VITA PLENA v4 — views/tasks.js — tasks, sections, quick-add parser, task modal */
import { $, esc, rid, fmtT, todayS, ymd, addD, S, DOWS, saveField, addItem, updItem, delItem,
  taskDoneOn, repeatLabel, areaTag, profOf, ordinal, toast } from "../data.js";

export function renderTasks(){
  const members=S.house.members||[];const secs=S.state.taskSections||{};
  const areas=[...members.map(u=>({key:u,label:profOf(u).name,mine:u===S.user.uid})),{key:"together",label:"Together",mine:true}];
  $("task-areas").innerHTML=areas.map(a=>{
    const list=secs[a.key]||[];
    const inner=list.map(sec=>{
      const tasks=S.items.filter(i=>i.kind==="task"&&i.area===a.key&&i.sectionId===sec.id)
        .sort((x,y)=>((x.repeat?0:(x.done?1:0))-(y.repeat?0:(y.done?1:0)))||((x.createdAt||0)-(y.createdAt||0)));
      return `<div style="margin-bottom:16px">
        <div class="sec-row" style="margin-bottom:4px"><div style="display:flex;align-items:center;gap:8px"><span class="emoji" style="width:auto">${sec.emoji||"📌"}</span><b style="font-size:13.5px;letter-spacing:.04em;color:var(--sage-deep)">${esc(sec.name)}</b></div>
        <button class="x" onclick="rmSection('${a.key}','${sec.id}')">×</button></div>
        ${tasks.map(taskRow).join("")||'<div class="empty">No tasks.</div>'}
      </div>`;}).join("");
    return `<div class="card"><h2 class="sec" style="color:${a.key==="together"?"var(--ink)":a.mine?"var(--sage-deep)":"var(--wheat)"}">${esc(a.label)}</h2>
      ${inner||'<div class="empty">No categories yet — tap + Category above.</div>'}</div>`;
  }).join("");
}
function taskRow(t){
  const today=todayS();const on=taskDoneOn(t,today);
  const sub=repeatLabel(t);
  return `<div class="agenda-row"><button class="chk ${on?"on":""}" onclick="toggleTaskOn('${t.id}','${today}')">✓</button><div class="grow"><div class="title ${on?"done-text":""}">${esc(t.text)}</div><div class="kind">${t.area==="together"?"Together":"For "+esc(profOf(t.area).name)}${sub?" · "+sub:""}</div></div>${areaTag(t)}<button class="editp" onclick="openTaskModal(null,null,'${t.id}')">✎</button><button class="x" onclick="delItem('${t.id}')">×</button></div>`;
}

/* ---- natural-language quick add (local parser) ---- */
const QA_DOW = {sunday:0,sun:0,monday:1,mon:1,tuesday:2,tue:2,tues:2,wednesday:3,wed:3,thursday:4,thu:4,thurs:4,friday:5,fri:5,saturday:6,sat:6};
const QA_ORD = {daily:1,everyday:1,weekly:7,biweekly:14,fortnightly:14,monthly:30};
function qaParse(raw){
  let s=" "+raw.toLowerCase()+" ";
  const out={text:raw.trim(), repeat:null, due:"", when:null, area:S.user.uid};
  if(/\b(together|for us|our |shared)\b/.test(s)){out.area="together";}
  let dow=null;
  for(const k in QA_DOW){ if(new RegExp("\\b"+k+"s?\\b").test(s)){dow=QA_DOW[k];break;} }
  let m=s.match(/every\s+(\d+)\s*(day|days|week|weeks)/);
  if(m){ let n=parseInt(m[1]); if(/week/.test(m[2]))n*=7; out.repeat={type:"every",n,anchor:qaAnchorForDow(dow)}; }
  if(!out.repeat){
    for(const k in QA_ORD){ if(new RegExp("\\b"+k+"\\b").test(s)){
      const n=QA_ORD[k];
      if(k==="weekly"&&dow!=null){ out.repeat={type:"weekly",days:[dow]}; }
      else if(k==="monthly"){ out.repeat={type:"monthly",dom:qaMonthDay(s)}; }
      else if(n===1){ out.repeat={type:"weekly",days:[0,1,2,3,4,5,6]}; }
      else { out.repeat={type:"every",n,anchor:qaAnchorForDow(dow)}; }
      break;
    }}
  }
  if(!out.repeat && dow!=null && /\bon\s+/.test(s)){ out.repeat={type:"weekly",days:[dow]}; }
  if(!out.repeat){
    if(/\btomorrow\b/.test(s)) out.due=ymd(addD(new Date(),1));
    else if(/\btoday\b/.test(s)) out.due=todayS();
    else if(dow!=null){ out.due=qaNextDow(dow); }
  }
  out.when=qaTimeHint(s);
  out.text = qaCleanText(raw);
  return out;
}
function qaAnchorForDow(dow){ if(dow==null)return todayS(); return qaNextDow(dow); }
function qaNextDow(dow){ const d=new Date(); const diff=(dow-d.getDay()+7)%7; return ymd(addD(d,diff===0?0:diff)); }
function qaMonthDay(s){ const m=s.match(/(\d{1,2})(st|nd|rd|th)/); return m?Math.min(31,Math.max(1,+m[1])):1; }
function qaTimeHint(s){
  const m=s.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/);
  if(m){let h=+m[1];if(m[3]==="pm"&&h<12)h+=12;if(m[3]==="am"&&h===12)h=0;return String(h).padStart(2,"0")+(m[2]||":00");}
  if(/after work|evening|tonight/.test(s))return "evening";
  if(/morning/.test(s))return "morning";
  if(/afternoon|lunch|noon/.test(s))return "afternoon";
  return null;
}
function qaCleanText(raw){
  let t=raw.trim();
  t=t.replace(/\bevery\s+\d+\s*(days?|weeks?)\b/ig,"");
  t=t.replace(/\b(daily|everyday|weekly|biweekly|fortnightly|monthly|every day)\b/ig,"");
  t=t.replace(/\bon\s+the\s+\d{1,2}(st|nd|rd|th)\b/ig,"");
  t=t.replace(/\bthe\s+\d{1,2}(st|nd|rd|th)(\s+of\s+(the\s+|each\s+|every\s+)?month)?\b/ig,"");
  t=t.replace(/\bof\s+(the\s+|each\s+|every\s+)?month\b/ig,"");
  t=t.replace(/\bon\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thurs|fri|sat)s?\b/ig,"");
  t=t.replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/ig,"");
  t=t.replace(/\b(tomorrow|today|tonight|after work|in the morning|morning|evening|afternoon|typically|usually|i'?ll do that|i do that)\b/ig,"");
  t=t.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/ig,"");
  t=t.replace(/\b(for us|together|shared|with)\b/ig,"");
  t=t.replace(/[,\.\s]+$/,"").replace(/^\s*[,\.]+/,"").replace(/\s{2,}/g," ").trim();
  return t.charAt(0).toUpperCase()+t.slice(1);
}
function qaDescribe(p){
  let sched="";
  if(p.repeat){
    if(p.repeat.type==="weekly"){
      if(p.repeat.days.length===7) sched="every day";
      else sched="every "+p.repeat.days.map(d=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(" & ");
    } else if(p.repeat.type==="every") sched="every "+p.repeat.n+" day"+(p.repeat.n>1?"s":"");
    else if(p.repeat.type==="monthly") sched="the "+ordinal(p.repeat.dom)+" of each month";
  } else if(p.due){
    sched="on "+new Date(p.due+"T12:00").toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
  } else sched="no set date";
  const whenLabel = p.when==="evening"?"after work / evening":p.when==="morning"?"morning":p.when==="afternoon"?"afternoon":p.when&&p.when.includes(":")?fmtT(p.when):null;
  return {sched,whenLabel};
}
window.quickAddParse=()=>{
  const raw=$("qa-in").value.trim();
  if(!raw)return;
  const p=qaParse(raw);
  window._qaPending=p;
  const {sched,whenLabel}=qaDescribe(p);
  const areaName = p.area==="together"?"Together":"For "+esc(profOf(p.area).name);
  $("qa-preview").innerHTML=`
    <div class="qa-parsed">
      <div style="font-size:15px;margin-bottom:4px"><b>${esc(p.text||"(untitled task)")}</b></div>
      <span class="qa-chip">↻ ${sched}</span>
      <span class="qa-chip">${areaName}</span>
      ${whenLabel?`<span class="qa-chip">🕐 ${whenLabel}</span>`:""}
      <div class="qa-actions">
        <button class="qa-confirm" onclick="quickAddConfirm()">Add to my life</button>
        <button class="qa-edit" onclick="quickAddEditFull()">Adjust details</button>
      </div>
    </div>`;
  $("qa-preview").classList.add("show");
};
window.quickAddConfirm=()=>{
  const p=window._qaPending; if(!p)return;
  const secs=S.state.taskSections||{};
  let sec=(secs[p.area]||[])[0];
  if(!sec){ sec={id:rid(),name:"General",emoji:"📌"}; saveField("taskSections."+p.area,(secs[p.area]||[]).concat([sec])); }
  const data={kind:"task",text:p.text,area:p.area,sectionId:sec.id,due:p.due||"",repeat:p.repeat,doneDates:{},done:false};
  if(p.when) data.whenHint=p.when;
  addItem(data);
  $("qa-in").value=""; $("qa-preview").classList.remove("show"); window._qaPending=null;
  toast("Added ✓");
};
window.quickAddEditFull=()=>{
  const p=window._qaPending; if(!p)return;
  $("qa-preview").classList.remove("show");
  window.openTaskModal(p.area,p.due||null);
  setTimeout(()=>{const el=$("m-t-text");if(el)el.value=p.text;
    if(p.repeat){window.taskMode(p.repeat.type);
      if(p.repeat.type==="every"){$("m-t-n").value=p.repeat.n;}
      if(p.repeat.type==="monthly"){$("m-t-dom").value=p.repeat.dom;}
      if(p.repeat.type==="weekly"){document.querySelectorAll("#m-t-days button").forEach(b=>b.classList.toggle("on",p.repeat.days.includes(+b.dataset.d)));}
    } else if(p.due){window.taskMode("due");$("m-t-due").value=p.due;}
  },30);
};

/* ---- task + category modals ---- */
window.openTaskModal=(areaPre,duePre,editId)=>{
  const t=editId?S.items.find(i=>i.id===editId):null;
  const members=S.house.members||[];
  const area=t?t.area:(areaPre&&areaPre!=="all"?areaPre:S.user.uid);
  const areaOpts=members.map(u=>`<option value="${u}" ${area===u?"selected":""}>${esc(profOf(u).name)}</option>`).join("")+`<option value="together" ${area==="together"?"selected":""}>Together</option>`;
  const rep=t&&t.repeat?t.repeat:null;
  const mode=rep?rep.type:(t&&t.due?"due":(duePre?"due":"none"));
  const MODES=[["none","No date"],["due","Pick a date"],["weekly","Days of week"],["every","Every N days"],["monthly","Day of month"]];
  window.openModal(`<h3>${t?"Edit task":"New task"}</h3>
    <label class="f">Task</label><input id="m-t-text" value="${t?esc(t.text):""}" placeholder="e.g. Vacuum the house">
    <label class="f">For</label><select id="m-t-area" onchange="taskAreaChange()">${areaOpts}</select>
    <label class="f">List / project</label><select id="m-t-sec"></select>
    <label class="f">Schedule</label>
    <div class="pills" id="m-t-mode" data-v="${mode}" style="margin-bottom:2px">${MODES.map(([v,l])=>`<button class="pill ${mode===v?"on":""}" data-m="${v}" onclick="taskMode('${v}')">${l}</button>`).join("")}</div>
    <div id="m-t-due-wrap" style="display:none"><label class="f">Date</label><input id="m-t-due" type="date" value="${(t&&t.due)||duePre||todayS()}"></div>
    <div id="m-t-days-wrap" style="display:none"><label class="f">Tap every day this task should appear</label><div class="yn" id="m-t-days" style="flex-wrap:wrap">${[1,2,3,4,5,6,0].map(i=>`<button data-d="${i}" class="${rep&&rep.type==="weekly"&&(rep.days||[]).includes(i)?"on":""}" style="flex:none;padding:9px 13px" onclick="this.classList.toggle('on')">${DOWS[i]}</button>`).join("")}</div></div>
    <div id="m-t-n-wrap" style="display:none"><label class="f">Every how many days?</label><input id="m-t-n" type="number" min="1" value="${rep&&rep.n?rep.n:14}"><label class="f">Starting from</label><input id="m-t-anchor" type="date" value="${(rep&&rep.anchor)||duePre||todayS()}"></div>
    <div id="m-t-dom-wrap" style="display:none"><label class="f">On which day of the month?</label><input id="m-t-dom" type="number" min="1" max="31" value="${rep&&rep.dom?rep.dom:1}"><div class="hint" style="margin-top:6px">1 = the 1st of every month. In shorter months it lands on the last day.</div></div>
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveTaskModal('${editId||""}')">${t?"Save":"Add"}</button></div>`);
  window.taskAreaChange(t?t.sectionId:null);
  window.taskMode(mode);
};
window.taskMode=(v)=>{
  $("m-t-mode").dataset.v=v;
  document.querySelectorAll("#m-t-mode .pill").forEach(b=>b.classList.toggle("on",b.dataset.m===v));
  $("m-t-due-wrap").style.display=v==="due"?"":"none";
  $("m-t-days-wrap").style.display=v==="weekly"?"":"none";
  $("m-t-n-wrap").style.display=v==="every"?"":"none";
  $("m-t-dom-wrap").style.display=v==="monthly"?"":"none";
};
window.taskAreaChange=(selId)=>{
  const area=$("m-t-area").value;const secs=(S.state.taskSections||{})[area]||[];
  $("m-t-sec").innerHTML=secs.map(x=>`<option value="${x.id}" ${x.id===selId?"selected":""}>${x.emoji||""} ${esc(x.name)}</option>`).join("")+'<option value="__none">(General)</option>';
  if(!secs.length)$("m-t-sec").value="__none";
};
window.saveTaskModal=(editId)=>{
  const text=$("m-t-text").value.trim();if(!text)return;
  const area=$("m-t-area").value;let sectionId=$("m-t-sec").value;
  if(sectionId==="__none"){
    const secs=S.state.taskSections||{};let gen=(secs[area]||[]).find(x=>x.name==="General");
    if(!gen){gen={id:rid(),name:"General",emoji:"📌"};saveField("taskSections."+area,(secs[area]||[]).concat([gen]));}
    sectionId=gen.id;
  }
  const rv=$("m-t-mode").dataset.v;
  let repeat=null,due="";
  if(rv==="due")due=$("m-t-due").value||todayS();
  if(rv==="weekly"){const days=[...document.querySelectorAll("#m-t-days button.on")].map(b=>+b.dataset.d);if(!days.length)return toast("Tap at least one day");repeat={type:"weekly",days};}
  if(rv==="every")repeat={type:"every",n:Math.max(1,+$("m-t-n").value||14),anchor:$("m-t-anchor").value||todayS()};
  if(rv==="monthly")repeat={type:"monthly",dom:Math.max(1,Math.min(31,+$("m-t-dom").value||1))};
  const prev=editId?S.items.find(i=>i.id===editId):null;
  const data={kind:"task",text,area,sectionId,due,repeat,doneDates:(prev&&prev.doneDates)||{},done:prev?!!prev.done:false};
  editId?updItem(editId,data):addItem(data);
  window.closeModal();
};
window.openCategoryModal=()=>{
  const members=S.house.members||[];
  const opts=[...members.map(u=>[u,profOf(u).name]),["together","Together"]];
  const defA=opts.find(([v])=>v===S.user.uid)?S.user.uid:opts[0][0];
  window.openModal(`<h3>New category</h3>
    <label class="f">For</label>
    <div class="pills" id="m-cat-for" data-v="${defA}">${opts.map(([v,l])=>`<button class="pill ${v===defA?"on":""}" data-a="${v}" onclick="catForPick('${v}')">${esc(l)}</button>`).join("")}</div>
    <label class="f">Category name</label><input id="m-cat-name" placeholder="e.g. Household — Career & Goals — Pets">
    <label class="f">Emoji</label><input id="m-cat-emoji" placeholder="🎯" maxlength="4">
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createCategory()">Add</button></div>`);
};
window.catForPick=(v)=>{$("m-cat-for").dataset.v=v;document.querySelectorAll("#m-cat-for .pill").forEach(b=>b.classList.toggle("on",b.dataset.a===v));};
window.createCategory=()=>{
  const name=$("m-cat-name").value.trim();if(!name)return toast("Name the category first");
  const area=$("m-cat-for").dataset.v;
  const secs=S.state.taskSections||{};
  const list=(secs[area]||[]).concat([{id:rid(),name,emoji:$("m-cat-emoji").value.trim()||"📌"}]);
  saveField("taskSections."+area,list);window.closeModal();toast("Category added");
};
window.rmSection=(area,sid)=>{
  window.confirmModal("Delete this list and its tasks?",()=>{
    const secs=S.state.taskSections||{};saveField("taskSections."+area,(secs[area]||[]).filter(x=>x.id!==sid));
    S.items.filter(i=>i.kind==="task"&&i.sectionId===sid).forEach(t=>delItem(t.id));
  });
};
