/* Vita Plena — Tasks: plain-English quick add, projects, assignee (member or
   together), repeats, due dates, per-date completion. */
import { S, esc, rid, fmtT, todayS, ymd, addD, DOWS, saveField, addItem, updItem, delItem,
  taskDoneOn, repeatLabel, profOf, ordinal, ensureSection } from "../core/data.js";
import { $, A, ICON, openModal, closeModal, confirmModal, toast } from "../ui/dom.js";
import { who, assigneeOn, assignees } from "../core/people.js";
import { registerScreen } from "../app/shell.js";

let _projects=[];
function taskSort(x,y){ return ((x.repeat?0:(x.done?1:0))-(y.repeat?0:(y.done?1:0)))||((x.createdAt||0)-(y.createdAt||0)); }

function render(){
  const members=S.house.members||[]; const secsByArea=S.state.taskSections||{};
  const seen={}; _projects=[];
  Object.keys(secsByArea).forEach(area=>(secsByArea[area]||[]).forEach(sec=>{
    const k=(sec.name||"").toLowerCase().trim();
    if(!seen[k]){ seen[k]={name:sec.name,emoji:sec.emoji||"📌",ids:[]}; _projects.push(seen[k]); }
    seen[k].ids.push(sec.id); if(sec.emoji&&seen[k].emoji==="📌")seen[k].emoji=sec.emoji;
  }));
  const knownIds=new Set(_projects.flatMap(p=>p.ids));
  const today=todayS();
  const groups=assignees().map(w=>({key:w.key,label:(w.emoji?w.emoji+" ":"")+w.name}));
  const projectCard=(pr,idx,tasks)=>{
    const inner=groups.map(g=>{ const ts=tasks.filter(t=>assigneeOn(t,today)===g.key).sort(taskSort); if(!ts.length)return ""; return `<div class="fin-cat">${esc(g.label)}</div>`+ts.map(taskRow).join(""); }).join("");
    return `<div class="card"><div class="sec-row"><div class="proj-head"><span class="emoji" style="width:auto">${pr.emoji}</span><h2 class="sec">${esc(pr.name)}</h2></div>${idx>=0?`<button class="x" onclick="A.rmProject(${idx})">×</button>`:""}</div>${inner||'<div class="empty">Nothing here yet.</div>'}</div>`;
  };
  let html=_projects.map((pr,idx)=>projectCard(pr,idx,S.items.filter(i=>i.kind==="task"&&pr.ids.includes(i.sectionId)))).join("");
  const orphans=S.items.filter(i=>i.kind==="task"&&!knownIds.has(i.sectionId));
  if(orphans.length)html+=projectCard({name:"Unsorted",emoji:"🗂",ids:[]},-1,orphans);
  const open=S.items.filter(i=>i.kind==="task"&&!i.done&&["together",S.user.uid].includes(assigneeOn(i,today))).length;

  $("page-tasks").innerHTML=`
    <div class="card">
      <div class="sec-row"><h2 class="sec">Add a task</h2><span class="hint">${open} open for you</span></div>
      <div class="addline" style="margin-top:0"><input id="qa-in" placeholder="Wash the dogs every 14 days on Friday" onkeydown="if(event.key==='Enter')A.quickAddParse()"><button class="iconbtn" onclick="A.quickAddParse()">${ICON.plus}</button></div>
      <div class="qa-preview" id="qa-preview"></div>
      <div class="hint" style="margin-top:8px">Say it plainly: "vacuum Tuesdays", "call the plumber tomorrow", "together: plan Advent". Or tell Beacon.</div>
    </div>
    <div class="sec-row"><h2 class="sec">Projects</h2><button class="btn ghost sm" onclick="A.openCategoryModal()">${ICON.plus} Project</button></div>
    ${html||'<div class="card"><div class="empty">No projects yet.</div></div>'}`;
}
function taskRow(t){
  const today=todayS(), on=taskDoneOn(t,today), sub=repeatLabel(t);
  const w=who(assigneeOn(t,today));
  return `<div class="row"><button class="chk ${on?"on":""}" onclick="toggleTaskOn('${t.id}','${today}')">${ICON.check}</button><div class="grow"><div class="title ${on?"done-text":""}">${esc(t.text)}</div><div class="kind">${w.kind==="together"?"Together":"For "+esc(w.name)}${t.rotate?.length>1?" · rotates weekly":""}${sub?" · "+sub:""}</div></div><button class="editp" onclick="A.openTaskModal(null,null,'${t.id}')">${ICON.edit}</button></div>`;
}

/* ---- natural-language quick add (local parser) ---- */
const QA_DOW={sunday:0,sun:0,monday:1,mon:1,tuesday:2,tue:2,tues:2,wednesday:3,wed:3,thursday:4,thu:4,thurs:4,friday:5,fri:5,saturday:6,sat:6};
const QA_ORD={daily:1,everyday:1,weekly:7,biweekly:14,fortnightly:14,monthly:30};
function qaParse(raw){
  let s=" "+raw.toLowerCase()+" ";
  const out={text:raw.trim(),repeat:null,due:"",when:null,area:S.user.uid};
  if(/\b(together|for us|our |shared)\b|^together:/.test(s.trim()))out.area="together";
  for(const a of assignees()){ if(a.kind==="me"||a.kind==="together")continue; const nm=(a.name||"").toLowerCase(); if(nm&&new RegExp("\\b"+nm+"\\b").test(s)){ out.area=a.key; break; } }
  let dow=null; for(const k in QA_DOW){ if(new RegExp("\\b"+k+"s?\\b").test(s)){dow=QA_DOW[k];break;} }
  let m=s.match(/every\s+(\d+)\s*(day|days|week|weeks)/);
  if(m){ let n=parseInt(m[1]); if(/week/.test(m[2]))n*=7; out.repeat={type:"every",n,anchor:qaAnchorForDow(dow)}; }
  if(!out.repeat){ for(const k in QA_ORD){ if(new RegExp("\\b"+k+"\\b").test(s)){ const n=QA_ORD[k];
    if(k==="weekly"&&dow!=null)out.repeat={type:"weekly",days:[dow]};
    else if(k==="monthly")out.repeat={type:"monthly",dom:qaMonthDay(s)};
    else if(n===1)out.repeat={type:"weekly",days:[0,1,2,3,4,5,6]};
    else out.repeat={type:"every",n,anchor:qaAnchorForDow(dow)};
    break; } } }
  if(!out.repeat&&dow!=null&&/\b(on|every)\s+/.test(s)&&/s\b/.test(s.match(new RegExp("\\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\\b"))?.[0]||""))out.repeat={type:"weekly",days:[dow]};
  if(!out.repeat&&dow!=null&&/\bevery\s+/.test(s))out.repeat={type:"weekly",days:[dow]};
  if(!out.repeat){ if(/\btomorrow\b/.test(s))out.due=ymd(addD(new Date(),1)); else if(/\btoday\b/.test(s))out.due=todayS(); else if(dow!=null)out.due=qaNextDow(dow); }
  out.when=qaTimeHint(s); out.text=qaCleanText(raw); return out;
}
function qaAnchorForDow(dow){ return dow==null?todayS():qaNextDow(dow); }
function qaNextDow(dow){ const d=new Date(); const diff=(dow-d.getDay()+7)%7; return ymd(addD(d,diff)); }
function qaMonthDay(s){ const m=s.match(/(\d{1,2})(st|nd|rd|th)/); return m?Math.min(31,Math.max(1,+m[1])):1; }
function qaTimeHint(s){ const m=s.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/); if(m){let h=+m[1];if(m[3]==="pm"&&h<12)h+=12;if(m[3]==="am"&&h===12)h=0;return String(h).padStart(2,"0")+(m[2]||":00");} if(/after work|evening|tonight/.test(s))return "evening"; if(/morning/.test(s))return "morning"; if(/afternoon|lunch|noon/.test(s))return "afternoon"; return null; }
function qaCleanText(raw){
  let t=raw.trim().replace(/^together:\s*/i,"");
  assignees().forEach(a=>{ if(a.kind==="me"||a.kind==="together")return; const nm=a.name; if(nm)t=t.replace(new RegExp("\\b(for\\s+)?"+nm+"\\b","ig"),""); });
  t=t.replace(/\bevery\s+\d+\s*(days?|weeks?)\b/ig,"").replace(/\b(daily|everyday|weekly|biweekly|fortnightly|monthly|every day)\b/ig,"")
    .replace(/\bon\s+the\s+\d{1,2}(st|nd|rd|th)\b/ig,"").replace(/\bthe\s+\d{1,2}(st|nd|rd|th)(\s+of\s+(the\s+|each\s+|every\s+)?month)?\b/ig,"").replace(/\bof\s+(the\s+|each\s+|every\s+)?month\b/ig,"")
    .replace(/\b(on|every)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thurs|fri|sat)s?\b/ig,"").replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/ig,"")
    .replace(/\b(tomorrow|today|tonight|after work|in the morning|morning|evening|afternoon|typically|usually)\b/ig,"").replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/ig,"").replace(/\b(for us|together|shared)\b/ig,"")
    .replace(/[,\.\s]+$/,"").replace(/^\s*[,\.]+/,"").replace(/\s{2,}/g," ").trim();
  return t.charAt(0).toUpperCase()+t.slice(1);
}
function qaDescribe(p){
  let sched="";
  if(p.repeat){ if(p.repeat.type==="weekly")sched=p.repeat.days.length===7?"every day":"every "+p.repeat.days.map(d=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(" & "); else if(p.repeat.type==="every")sched="every "+p.repeat.n+" day"+(p.repeat.n>1?"s":""); else if(p.repeat.type==="monthly")sched="the "+ordinal(p.repeat.dom)+" of each month"; }
  else if(p.due)sched="on "+new Date(p.due+"T12:00").toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"}); else sched="no set date";
  const whenLabel=p.when==="evening"?"evening":p.when==="morning"?"morning":p.when==="afternoon"?"afternoon":p.when&&p.when.includes(":")?fmtT(p.when):null;
  return {sched,whenLabel};
}
A.quickAddParse=()=>{
  const raw=$("qa-in").value.trim(); if(!raw)return;
  const p=qaParse(raw); window._qaPending=p;
  const {sched,whenLabel}=qaDescribe(p);
  $("qa-preview").innerHTML=`<div class="qa-parsed"><div style="font-weight:600;margin-bottom:6px">${esc(p.text||"(untitled)")}</div><div class="chips"><span class="chip">↻ ${sched}</span><span class="chip">${p.area==="together"?"Together":"For "+esc(who(p.area).name)}</span>${whenLabel?`<span class="chip">🕐 ${whenLabel}</span>`:""}</div>
    <div class="qa-actions"><button class="btn sm" onclick="A.quickAddConfirm()">Add it</button><button class="btn ghost sm" onclick="A.quickAddEditFull()">Adjust</button></div></div>`;
  $("qa-preview").classList.add("show");
};
A.quickAddConfirm=()=>{
  const p=window._qaPending; if(!p)return;
  const sec=ensureSection(p.area,"");
  const data={kind:"task",text:p.text,area:p.area,sectionId:sec.id,due:p.due||"",repeat:p.repeat,doneDates:{},done:false};
  if(p.when)data.whenHint=p.when;
  addItem(data); $("qa-in").value=""; $("qa-preview").classList.remove("show"); window._qaPending=null; toast("Added ✓");
};
A.quickAddEditFull=()=>{
  const p=window._qaPending; if(!p)return; $("qa-preview").classList.remove("show");
  A.openTaskModal(p.area,p.due||null);
  setTimeout(()=>{ const el=$("m-t-text"); if(el)el.value=p.text;
    if(p.repeat){ A.taskMode(p.repeat.type); if(p.repeat.type==="every")$("m-t-n").value=p.repeat.n; if(p.repeat.type==="monthly")$("m-t-dom").value=p.repeat.dom; if(p.repeat.type==="weekly")document.querySelectorAll("#m-t-days button").forEach(b=>b.classList.toggle("on",p.repeat.days.includes(+b.dataset.d))); }
    else if(p.due){ A.taskMode("due"); $("m-t-due").value=p.due; } },30);
};

/* ---- task + project modals ---- */
A.openTaskModal=(areaPre,duePre,editId)=>{
  const t=editId?S.items.find(i=>i.id===editId):null;
  const area=t?t.area:(areaPre&&areaPre!=="all"?areaPre:S.user.uid);
  const rot=(t&&Array.isArray(t.rotate))?t.rotate:[];
  const areaOpts=assignees().map(w=>`<option value="${w.key}" ${area===w.key?"selected":""}>${w.emoji?w.emoji+" ":""}${esc(w.name)}</option>`).join("");
  const rotChips=assignees().filter(w=>w.kind!=="together").map(w=>`<button type="button" class="chip ${rot.includes(w.key)?"lit":""}" data-k="${w.key}" onclick="this.classList.toggle('lit')">${w.emoji?w.emoji+" ":""}${esc(w.name)}</button>`).join("");
  const rep=t&&t.repeat?t.repeat:null;
  const mode=rep?rep.type:(t&&t.due?"due":(duePre?"due":"none"));
  const MODES=[["none","No date"],["due","A date"],["weekly","Weekdays"],["every","Every N days"],["monthly","Monthly"]];
  openModal(`<h3>${t?"Edit task":"New task"}</h3>
    <label class="f">Task</label><input id="m-t-text" value="${t?esc(t.text):""}" placeholder="e.g. Vacuum the house">
    <label class="f">For</label><select id="m-t-area" onchange="A.taskAreaChange()">${areaOpts}</select>
    <label class="f">Rotate weekly between</label><div class="chips" id="m-t-rot">${rotChips}</div><div class="hint" style="margin-top:6px">Pick two or more and the chore passes to the next person each week.</div>
    <label class="f">Project</label><select id="m-t-sec"></select>
    <label class="f">Schedule</label>
    <div class="pills" id="m-t-mode" data-v="${mode}">${MODES.map(([v,l])=>`<button class="pill ${mode===v?"on":""}" data-m="${v}" onclick="A.taskMode('${v}')">${l}</button>`).join("")}</div>
    <div id="m-t-due-wrap" style="display:none"><label class="f">Date</label><input id="m-t-due" type="date" value="${(t&&t.due)||duePre||todayS()}"></div>
    <div id="m-t-days-wrap" style="display:none"><label class="f">Days</label><div class="yn" id="m-t-days" style="flex-wrap:wrap">${[1,2,3,4,5,6,0].map(i=>`<button data-d="${i}" class="${rep&&rep.type==="weekly"&&(rep.days||[]).includes(i)?"on":""}" style="flex:none;padding:9px 13px" onclick="this.classList.toggle('on')">${DOWS[i]}</button>`).join("")}</div></div>
    <div id="m-t-n-wrap" style="display:none"><label class="f">Every how many days?</label><input id="m-t-n" type="number" inputmode="numeric" min="1" value="${rep&&rep.n?rep.n:14}"><label class="f">Starting</label><input id="m-t-anchor" type="date" value="${(rep&&rep.anchor)||duePre||todayS()}"></div>
    <div id="m-t-dom-wrap" style="display:none"><label class="f">Day of the month</label><input id="m-t-dom" type="number" inputmode="numeric" min="1" max="31" value="${rep&&rep.dom?rep.dom:1}"></div>
    <div class="actions">${t?`<button class="btn ghost" onclick="A.rmTask('${editId}')">Delete</button>`:`<button class="btn ghost" onclick="A.closeModal()">Cancel</button>`}<button class="btn" onclick="A.saveTaskModal('${editId||""}')">${t?"Save":"Add"}</button></div>`);
  A.taskAreaChange(t?t.sectionId:null); A.taskMode(mode);
};
A.taskMode=v=>{ $("m-t-mode").dataset.v=v; document.querySelectorAll("#m-t-mode .pill").forEach(b=>b.classList.toggle("on",b.dataset.m===v)); $("m-t-due-wrap").style.display=v==="due"?"":"none"; $("m-t-days-wrap").style.display=v==="weekly"?"":"none"; $("m-t-n-wrap").style.display=v==="every"?"":"none"; $("m-t-dom-wrap").style.display=v==="monthly"?"":"none"; };
A.taskAreaChange=selId=>{
  const secsByArea=S.state.taskSections||{}; const seen={}; const all=[];
  Object.keys(secsByArea).forEach(area=>(secsByArea[area]||[]).forEach(x=>{ const k=(x.name||"").toLowerCase().trim(); if(!seen[k]){seen[k]=true;all.push(x);} else if(selId&&x.id===selId)all.push(x); }));
  $("m-t-sec").innerHTML=all.map(x=>`<option value="${x.id}" ${x.id===selId?"selected":""}>${x.emoji||""} ${esc(x.name)}</option>`).join("")+'<option value="__none">(General)</option>';
  if(!all.length)$("m-t-sec").value="__none";
};
A.saveTaskModal=editId=>{
  const text=$("m-t-text").value.trim(); if(!text)return toast("Name the task");
  const rotate=[...document.querySelectorAll("#m-t-rot .chip.lit")].map(b=>b.dataset.k);
  const area=rotate.length>=2?rotate[0]:$("m-t-area").value; let sectionId=$("m-t-sec").value;
  if(sectionId==="__none"){ const secs=S.state.taskSections||{}; let gen=null; Object.keys(secs).forEach(a=>{const hit=(secs[a]||[]).find(x=>(x.name||"").toLowerCase()==="general");if(hit&&!gen)gen=hit;}); if(!gen){gen={id:rid(),name:"General",emoji:"📌"};saveField("taskSections.together",(secs.together||[]).concat([gen]));} sectionId=gen.id; }
  const rv=$("m-t-mode").dataset.v; let repeat=null,due="";
  if(rv==="due")due=$("m-t-due").value||todayS();
  if(rv==="weekly"){ const days=[...document.querySelectorAll("#m-t-days button.on")].map(b=>+b.dataset.d); if(!days.length)return toast("Tap at least one day"); repeat={type:"weekly",days}; }
  if(rv==="every")repeat={type:"every",n:Math.max(1,+$("m-t-n").value||14),anchor:$("m-t-anchor").value||todayS()};
  if(rv==="monthly")repeat={type:"monthly",dom:Math.max(1,Math.min(31,+$("m-t-dom").value||1))};
  const prev=editId?S.items.find(i=>i.id===editId):null;
  const data={kind:"task",text,area,sectionId,due,repeat,rotate:rotate.length>=2?rotate:null,doneDates:(prev&&prev.doneDates)||{},done:prev?!!prev.done:false};
  editId?updItem(editId,data):addItem(data); closeModal();
};
A.rmTask=id=>{ closeModal(); confirmModal("Delete this task?",()=>delItem(id)); };
A.openCategoryModal=()=>openModal(`<h3>New project</h3><label class="f">Name</label><input id="m-cat-name" placeholder="Household · The move · Pets"><label class="f">Emoji</label><input id="m-cat-emoji" placeholder="🎯" maxlength="4">
  <div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createCategory()">Add</button></div>`);
A.createCategory=()=>{
  const name=$("m-cat-name").value.trim(); if(!name)return toast("Name the project");
  const secs=S.state.taskSections||{};
  if(Object.keys(secs).some(a=>(secs[a]||[]).some(x=>(x.name||"").toLowerCase().trim()===name.toLowerCase())))return toast("That project already exists");
  saveField("taskSections.together",(secs.together||[]).concat([{id:rid(),name,emoji:$("m-cat-emoji").value.trim()||"📌"}])); closeModal();
};
A.rmProject=idx=>{
  const pr=_projects[idx]; if(!pr)return;
  confirmModal(`Delete "${pr.name}" and every task in it?`,()=>{
    const secs=S.state.taskSections||{};
    Object.keys(secs).forEach(a=>{ const kept=(secs[a]||[]).filter(x=>!pr.ids.includes(x.id)); if(kept.length!==(secs[a]||[]).length)saveField("taskSections."+a,kept); });
    S.items.filter(i=>i.kind==="task"&&pr.ids.includes(i.sectionId)).forEach(t=>delItem(t.id));
  });
};

registerScreen("tasks",render);
