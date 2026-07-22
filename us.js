/* VITA PLENA v4 — views/faith.js — rhythm, readings, examen, confession, books, virtue */
import { $, esc, rid, fmtT, fmtMins, todayS, ymd, addD, dayIdx, S, SAINTS, EXAMEN_Q, VIRTUES, DOWS, season,
  saveKey, saveField, addItem, updItem, delItem, doneSet, scheduledToday, isMine, setVal, toast } from "../data.js";

function practiceWeight(mins){ return mins<=5?"light":mins<=20?"med":"heavy"; }
function weightBars(w){
  const n=w==="light"?1:w==="med"?2:3;
  return `<div class="weight" title="${w==="light"?"a light moment":w==="med"?"a little time":"a fuller practice"}">${[0,1,2].map(i=>`<i class="${i<n?"fill":""}"></i>`).join("")}</div>`;
}
function practiceRow(p,dn,editable){
  const on=dn.has(p.id);
  const w=practiceWeight(p.mins||5);
  return `<div class="practice w-${w} ${on?"done-p":""}" id="prow-${p.id}">
    <div class="emoji">${p.emoji||"🙏"}</div>
    <div class="grow">
      <div class="nm">${esc(p.name)}</div>
      <div class="meta-lite">${fmtT(p.time)} · ${p.mins} min${editable?" · "+(p.days||[]).map(d=>DOWS[d]).join(" "):""}</div>
      ${weightBars(w)}
    </div>
    <span class="deo" id="deo-${p.id}">Deo gratias</span>
    <button class="donebtn ${on?"lit-done":""}" onclick="togglePractice('${p.id}')">${on?"✓":"Done"}</button>
    ${editable?`<button class="editp" onclick="editPractice('${p.id}')">✎</button><button class="x" onclick="rmPractice('${p.id}')">×</button>`:""}</div>`;
}
export function renderFaith(){
  const dn=doneSet(todayS());
  const todayPr=(S.state.practices||[]).filter(p=>scheduledToday(p));
  const doneToday=todayPr.filter(p=>dn.has(p.id)).length;
  const totalToday=todayPr.length;
  const yest=doneSet(ymd(addD(new Date(),-1)));
  const returned = yest.size===0 && doneToday>0;
  let candle="";
  if(totalToday>0){
    if(doneToday===0){
      candle=`<div class="rhythm-candle"><span class="flame">🕯️</span><div class="rc-text">Your rhythm waits for you. <b>Begin whenever you're ready.</b></div></div>`;
    }else if(doneToday<totalToday){
      const note = returned ? "Welcome back — the return itself is grace." : "Held faithfully so far today.";
      candle=`<div class="rhythm-candle"><span class="flame">🕯️</span><div class="rc-text">${doneToday} of ${totalToday} kept today. <b>${note}</b></div></div>`;
    }else{
      candle=`<div class="rhythm-candle"><span class="flame">🔥</span><div class="rc-text">The whole rhythm kept today. <b>Deo gratias.</b></div></div>`;
    }
  }
  $("faith-rhythm").innerHTML=candle+((S.state.practices||[]).map(p=>practiceRow(p,dn,true)).join("")||'<div class="empty">Add your first practice.</div>');
  $("plan-list").innerHTML=(S.state.plan||[]).map(p=>`<div class="row"><div class="emoji">✝️</div><div class="grow title">${esc(p.text)}</div><button class="x" onclick="rmPlan('${p.id}')">×</button></div>`).join("")||'<div class="empty">Nothing yet.</div>';
  /* readings tab — the liturgical season lives here now, as a text detail */
  const now=new Date(),sea=season(now);
  $("rd-season").textContent=sea.name+(sea.name==="Ordinary Time"?"":" — a season of grace");
  const sk=String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
  $("rd-saint").textContent=SAINTS[sk]?("Today: "+SAINTS[sk]):"Feria";
  const mm=String(now.getMonth()+1).padStart(2,"0"),dd=String(now.getDate()).padStart(2,"0"),yy=String(now.getFullYear()).slice(2);
  $("rd-usccb").href=`https://bible.usccb.org/bible/readings/${mm}${dd}${yy}.cfm`;
  $("lectio-list").innerHTML=S.items.filter(i=>i.kind==="lectio"&&isMine(i)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,10)
    .map(l=>`<div class="row"><div class="grow"><div class="qhist">\u201C${esc(l.text)}\u201D</div><div class="sub">${new Date(l.createdAt).toLocaleDateString()}</div></div><button class="x" onclick="delItem('${l.id}')">×</button></div>`).join("")||'<div class="empty">No notes yet.</div>';
  $("examen-quote").textContent="\u201C"+EXAMEN_Q[dayIdx(now)%EXAMEN_Q.length]+"\u201D";
  $("examen-list").innerHTML=S.items.filter(i=>i.kind==="examen"&&isMine(i)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,14)
    .map(l=>`<div class="row"><div class="emoji">🕯️</div><div class="grow"><div class="qhist">${esc(l.text)}</div><div class="sub">${new Date(l.createdAt).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</div></div><button class="x" onclick="delItem('${l.id}')">×</button></div>`).join("")||'<div class="empty">Your examens are private to you.</div>';
  /* confession */
  const conf=(S.state.confession||{})[S.user.uid]||{};
  const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).slice().sort();
  const cad=conf.cadence||14;
  if(document.activeElement!==$("conf-cadence"))$("conf-cadence").value=cad;
  if(clog.length){
    const lastS=clog[clog.length-1];
    const last=new Date(lastS+"T12:00"),days=Math.floor((new Date()-last)/864e5);
    $("conf-last").textContent="Last confession: "+last.toLocaleDateString(undefined,{month:"long",day:"numeric"})+` (${days}d ago)`;
    const due=cad-days;
    $("conf-due").textContent=due>0?`Next suggested within ${due} day${due===1?"":"s"}`:"It's time — schedule confession soon 🕊️";
  }else{$("conf-last").textContent="No confession logged yet";$("conf-due").textContent="Log your first visit below.";}
  $("conf-log").innerHTML=clog.slice().reverse().slice(0,20).map(ds=>{
    const idx=clog.indexOf(ds);
    const gap=idx>0?Math.round((new Date(ds+"T12:00")-new Date(clog[idx-1]+"T12:00"))/864e5):null;
    return `<div class="row"><div class="emoji">🕯</div><div class="grow"><div class="title">${new Date(ds+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"long",day:"numeric",year:"numeric"})}</div>${gap!==null?`<div class="sub">${gap} days after the previous</div>`:""}</div><button class="x" onclick="rmConfession('${ds}')">×</button></div>`;
  }).join("")||'<div class="empty">Your visits will be listed here.</div>';
  renderBooks();
  const v=S.state.virtue||{};
  const monName=new Date().toLocaleDateString(undefined,{month:"long"});
  $("virtue-note").textContent="One virtue, one month, one concrete practice — "+monName+".";
  renderVirtueSel(v.name);setVal("virtue-res",v.res);
}
window.togglePractice=pid=>{
  const dn=doneSet(todayS());
  const completing=!dn.has(pid);
  completing?dn.add(pid):dn.delete(pid);
  saveField(`rhythmDone.${todayS()}.${S.user.uid}`,[...dn]);
  if(completing){
    const row=document.getElementById("prow-"+pid);
    const deo=document.getElementById("deo-"+pid);
    if(row){row.classList.add("just-done");setTimeout(()=>row.classList.remove("just-done"),1100);}
    if(deo){deo.classList.add("rise");setTimeout(()=>deo.classList.remove("rise"),1300);}
  }
};
window.rmPractice=pid=>window.confirmModal("Remove this practice?",()=>saveKey("practices",(S.state.practices||[]).filter(p=>p.id!==pid)));
window.openPracticeModal=(pid)=>{
  const p=pid?(S.state.practices||[]).find(x=>x.id===pid):null;
  window.openModal(`<h3>${p?"Edit practice":"New practice"}</h3>
    <label class="f">Name</label><input id="m-p-name" value="${p?esc(p.name):""}" placeholder="e.g. Divine Mercy Chaplet">
    <label class="f">Emoji</label><input id="m-p-emoji" value="${p?esc(p.emoji||""):""}" placeholder="🙏" maxlength="4">
    <label class="f">Time</label><input id="m-p-time" type="time" value="${p?p.time:"15:00"}">
    <label class="f">Minutes</label><input id="m-p-mins" type="number" value="${p?p.mins:10}">
    <label class="f">Days</label><div class="yn" id="m-p-days" style="flex-wrap:wrap">${DOWS.map((d,i)=>`<button data-d="${i}" class="${!p||(p.days||[]).includes(i)?"on":""}" style="flex:none;padding:9px 12px" onclick="this.classList.toggle('on')">${d}</button>`).join("")}</div>
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createPractice('${pid||""}')">${p?"Save":"Add"}</button></div>`);
};
window.editPractice=pid=>window.openPracticeModal(pid);
window.createPractice=(pid)=>{
  const name=$("m-p-name").value.trim();if(!name)return;
  const days=[...document.querySelectorAll("#m-p-days button.on")].map(b=>+b.dataset.d);
  const obj={id:pid||rid(),name,emoji:$("m-p-emoji").value.trim()||"🙏",time:$("m-p-time").value||"12:00",mins:+$("m-p-mins").value||10,days:days.length?days:[0,1,2,3,4,5,6]};
  const list=S.state.practices||[];
  saveKey("practices",pid?list.map(p=>p.id===pid?obj:p):list.concat([obj]));
  window.closeModal();
};
window.addPlan=()=>{const v=$("plan-in").value.trim();if(!v)return;$("plan-in").value="";saveKey("plan",(S.state.plan||[]).concat([{id:rid(),text:v}]));};
window.rmPlan=id=>saveKey("plan",(S.state.plan||[]).filter(p=>p.id!==id));
window.saveLectio=()=>{const v=$("lectio-in").value.trim();if(!v)return;$("lectio-in").value="";addItem({kind:"lectio",text:v});toast("Saved 📖");};
window.saveExamen=()=>{const v=$("examen-in").value.trim();if(!v)return;$("examen-in").value="";addItem({kind:"examen",text:v});toast("Examen saved 🕯️");};
window.logConfession=()=>{
  const conf=(S.state.confession||{})[S.user.uid]||{};
  const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).slice();
  if(clog.includes(todayS()))return toast("Already logged today 🕊️");
  clog.push(todayS());clog.sort();
  saveField(`confession.${S.user.uid}.log`,clog);
  toast("Deo gratias 🕊️");
};
window.rmConfession=(ds)=>{
  const conf=(S.state.confession||{})[S.user.uid]||{};
  const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).filter(d=>d!==ds);
  saveField(`confession.${S.user.uid}.log`,clog);
};
/* books */
function bookStreak(b){
  let n=0,d=new Date();const log=b.log||{};
  if(!log[ymd(d)])d=addD(d,-1);
  while((log[ymd(d)]||0)>0){n++;d=addD(d,-1);if(n>999)break;}
  return n;
}
function renderBooks(){
  if(!S._bookMigrated&&(S.state.books||[]).length){
    S._bookMigrated=true;
    (S.state.books||[]).forEach(b=>addItem({kind:"book",title:b.title,author:"",start:todayS(),goal:15,log:{},notes:[],finished:!!b.done}));
    saveKey("books",[]);
  }
  const books=S.items.filter(i=>i.kind==="book").sort((a,b)=>(a.finished-b.finished)||(b.createdAt-a.createdAt));
  const last7=[...Array(7)].map((_,i)=>addD(new Date(),i-6));
  $("book-list").innerHTML=books.map(b=>{
    const log=b.log||{};const total=Object.values(log).reduce((x,y)=>x+(+y||0),0);
    const days=Object.keys(log).filter(k=>log[k]>0).length;
    const st=bookStreak(b);const today=log[todayS()]||0;const goal=b.goal||15;
    const wk=last7.map(d=>{const ds=ymd(d);return `<span class="${(log[ds]||0)>0?"hit":""}" title="${ds}">${"SMTWTFS"[d.getDay()]}</span>`;}).join("");
    const notes=(b.notes||[]).slice(-2).reverse().map(n=>`<div class="row"><div class="grow"><div class="qhist">\u201C${esc(n.t)}\u201D</div><div class="sub">${new Date(n.d).toLocaleDateString()}</div></div></div>`).join("");
    return `<div class="book ${b.finished?"finished":""}">
      <div class="sec-row" style="margin:0"><div class="grow"><div class="bt ${b.finished?"done-text":""}">${esc(b.title)}</div><div class="bstats">${b.author?esc(b.author)+" · ":""}started ${new Date((b.start||todayS())+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div></div>
      <button class="editp" onclick="openBookModal('${b.id}')">✎</button><button class="x" onclick="confirmModal('Remove this book and its log?',()=>delItem('${b.id}'))">×</button></div>
      <div class="bstats" style="margin-top:8px">${st>1?st+"-day streak · ":""}${fmtMins(total)} total · ${days} day${days===1?"":"s"} in the book${today?` · today: ${fmtMins(today)} ${today>=goal?"✅":"of "+goal}`:` · goal ${goal} min/day`}</div>
      <div class="wk7">${wk}</div>
      ${b.finished?"":`<div class="logbtns"><button class="btn ghost sm" onclick="logRead('${b.id}',5)">+5 min</button><button class="btn ghost sm" onclick="logRead('${b.id}',15)">+15 min</button><button class="btn ghost sm" onclick="logRead('${b.id}',30)">+30 min</button><button class="btn ghost sm" onclick="finishBook('${b.id}',true)">Finished ✝</button></div>`}
      ${b.finished?`<div class="logbtns"><button class="btn ghost sm" onclick="finishBook('${b.id}',false)">Reopen</button></div>`:""}
      ${notes}
      <div class="addline"><input id="bn-${b.id}" placeholder="A line that struck you…" onkeydown="if(event.key==='Enter')addBookNote('${b.id}')"><button class="iconbtn" onclick="addBookNote('${b.id}')">+</button></div>
    </div>`;
  }).join("")||'<div class="empty">Nothing on the shelf yet — Introduction to the Devout Life, Story of a Soul, the Catechism… Add your first book.</div>';
}
window.openBookModal=(id)=>{
  const b=id?S.items.find(i=>i.id===id):null;
  window.openModal(`<h3>${b?"Edit book":"Add a book"}</h3>
    <label class="f">Title</label><input id="m-bk-title" value="${b?esc(b.title):""}" placeholder="Introduction to the Devout Life">
    <label class="f">Author</label><input id="m-bk-author" value="${b?esc(b.author||""):""}" placeholder="St. Francis de Sales">
    <label class="f">Start date</label><input id="m-bk-start" type="date" value="${(b&&b.start)||todayS()}">
    <label class="f">Daily goal (minutes)</label><input id="m-bk-goal" type="number" min="1" value="${(b&&b.goal)||15}">
    <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveBookModal('${id||""}')">${b?"Save":"Add to shelf"}</button></div>`);
};
window.saveBookModal=(id)=>{
  const title=$("m-bk-title").value.trim();if(!title)return;
  const data={title,author:$("m-bk-author").value.trim(),start:$("m-bk-start").value||todayS(),goal:Math.max(1,+$("m-bk-goal").value||15)};
  if(id)updItem(id,data);else addItem({kind:"book",...data,log:{},notes:[],finished:false});
  window.closeModal();
};
window.logRead=(id,mins)=>{
  const b=S.items.find(i=>i.id===id);if(!b)return;
  const log={...(b.log||{})};log[todayS()]=(log[todayS()]||0)+mins;
  updItem(id,{log});
  const nowTotal=log[todayS()];
  toast(nowTotal>=(b.goal||15)?`+${mins} min — goal reached today ✅`:`+${mins} min — well read 📖`);
};
window.finishBook=(id,fin)=>{updItem(id,{finished:fin});if(fin)toast("Book finished — Deo gratias ✝");};
window.addBookNote=(id)=>{
  const el=$("bn-"+id);const v=el.value.trim();if(!v)return;el.value="";
  const b=S.items.find(i=>i.id===id);if(!b)return;
  updItem(id,{notes:(b.notes||[]).concat([{t:v,d:Date.now()}])});
};
/* virtue */
function renderVirtueSel(cur){
  const sel=$("virtue-sel");if(document.activeElement===sel)return;
  const isCustom=!!cur&&!VIRTUES.includes(cur);
  sel.innerHTML='<option value="">— choose a virtue —</option>'+VIRTUES.map(x=>`<option ${x===cur?"selected":""}>${x}</option>`).join("")+`<option value="__custom" ${isCustom?"selected":""}>Custom…</option>`;
  $("virtue-in").style.display=isCustom?"":"none";
  if(isCustom)setVal("virtue-in",cur);
}
window.virtueSelChange=()=>{$("virtue-in").style.display=$("virtue-sel").value==="__custom"?"":"none";};
window.saveVirtue=()=>{
  const selV=$("virtue-sel").value;
  const name=selV==="__custom"?$("virtue-in").value.trim():selV;
  if(!name)return toast("Choose a virtue first");
  saveKey("virtue",{name,res:$("virtue-res").value.trim(),month:new Date().getMonth()});toast("Virtue saved");
};
/* daily Mass readings (Universalis JSONP) */
let readingsLoaded=false;
export function loadReadings(){
  if(readingsLoaded)return;readingsLoaded=true;
  const d=new Date();
  const ds=""+d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  window.universalisCallback=j=>{try{renderReadings(j);}catch(e){$("readings-body").innerHTML='<div class="empty">Could not display readings — use the USCCB link above.</div>';}};
  const sc=document.createElement("script");
  sc.src="https://universalis.com/USA/"+ds+"/jsonpmass.js";
  sc.onerror=()=>{readingsLoaded=false;$("readings-body").innerHTML='<div class="empty">Readings could not load right now — use the USCCB link above, or try again later.</div>';};
  document.head.appendChild(sc);
}
function rdgBlock(label,val,open){
  if(!val)return"";
  const src=(val&&typeof val==="object")?(val.source||""):"";
  const text=(val&&typeof val==="object")?(val.text||""):val;
  if(!text)return"";
  return `<details class="rdg"${open?" open":""}><summary>${label}<span class="src">${esc(src)}</span></summary><div class="rtext">${text}</div></details>`;
}
function renderReadings(j){
  let h="";
  if(j.day)h+=`<div class="italic-note">${esc(typeof j.day==="object"?(j.day.text||""):j.day)}</div>`;
  h+=rdgBlock("First Reading",j.Mass_R1,true)
    +rdgBlock("Responsorial Psalm",j.Mass_Ps)
    +rdgBlock("Second Reading",j.Mass_R2)
    +rdgBlock("Gospel Acclamation",j.Mass_GA)
    +rdgBlock("Gospel",j.Mass_G);
  const cp=j.copyright?(typeof j.copyright==="object"?(j.copyright.text||""):j.copyright):"";
  if(cp)h+=`<div class="hint" style="font-size:11px;margin-top:6px;opacity:.75">${cp}</div>`;
  $("readings-body").innerHTML=h||'<div class="empty">No readings returned — use the USCCB link above.</div>';
}
