/* Vita Plena — Pray: the liturgical day, the Mass readings, the rhythm, the prayer
   library with full-screen readers and guided flows (Rosary, Chaplet, Examen),
   confession, the plan of life, books, and the virtue of the month. */
import { S, db, esc, rid, fmtT, fmtMins, todayS, ymd, addD, dayIdx, SAINTS, EXAMEN_Q, DOWS, season,
  saveKey, saveField, addItem, updItem, delItem, doneSet, scheduledToday, isMine, profOf, toast,
  feastKey, usccbUrl, mysteriesFor, fastAbstinence, daysSince } from "../core/data.js";
import { PRAYERS, findPrayer, prayerById, rosarySteps, chapletSteps, examenSteps } from "../content/prayers.js";
import { $, A, ICON, openModal, closeModal, confirmModal, openSheet, closeSheet, haptic } from "../ui/dom.js";
import { registerScreen, renderAll, namesTheSame } from "../app/shell.js";

/* ---------------- the day's Mass readings ----------------
   Fetched from our own function, which talks to Universalis server-side and hands
   back clean JSON. The app used to inject Universalis' JSONP <script> directly;
   content blockers dropped it and there was no timeout, so the card sat on
   "Loading…" forever. A fetch we can time out and a card that always offers USCCB
   mean the reader is never stranded. */
let loadingFor=null;
export function loadReadings(force=false){
  const ds=todayS().replace(/-/g,"");
  if(loadingFor===ds)return;
  if(!force&&S.liturgy.date===ds&&S.liturgy.loaded)return;
  if(!force&&S.liturgy.date===ds&&S.liturgy.error)return;   // one failure per day; the retry button forces
  loadingFor=ds;
  const ctl=new AbortController();
  const bail=setTimeout(()=>ctl.abort(),9000);
  fetch("/.netlify/functions/readings?date="+ds,{signal:ctl.signal})
    .then(r=>r.ok?r.json():Promise.reject(new Error("HTTP "+r.status)))
    .then(j=>{
      if(j.error)throw new Error(j.error);
      S.liturgy={date:ds,day:j.day||"",readings:j.readings||[],copyright:j.copyright||"",loaded:true};
    })
    .catch(()=>{ S.liturgy={date:ds,loaded:false,error:true}; })
    .finally(()=>{ clearTimeout(bail); loadingFor=null; renderAll(); });
}
A.retryReadings=()=>{ S.liturgy={}; loadReadings(true); renderAll(); };

function render(){
  loadReadings();
  const now=new Date(), date=todayS(), me=S.user.uid;
  const sea=season(now).name, saint=SAINTS[feastKey(now)], fa=fastAbstinence(now);
  const L=S.liturgy||{};
  const dn=doneSet(date);
  const pr=(S.state.practices||[]);
  const todayPr=pr.filter(p=>scheduledToday(p));
  const mys=mysteriesFor(now);
  const easter=sea==="Easter";
  /* Only the four proclaimed at Mass get a reference line; the acclamation is a verse. */
  const refs=(L.readings||[]).filter(x=>x.label!=="Gospel Acclamation"&&x.source);

  const conf=(S.state.confession||{})[me]||{};
  const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).slice().sort();
  const cad=conf.cadence||14;
  let confLine="No confession logged yet.", confDue="Log your first visit.", confTile="Not logged yet", confDueNow=false;
  if(clog.length){
    const lastS=clog[clog.length-1], last=new Date(lastS+"T12:00"), days=daysSince(lastS), due=cad-days;
    confLine=`Last: ${last.toLocaleDateString(undefined,{month:"long",day:"numeric"})} · ${days===0?"today":days+"d ago"}`;
    confDue=due>0?`Next within ${due} day${due===1?"":"s"}`:"It's time. The font of mercy is open.";
    confDueNow=due<=0;
    confTile=days===0?"Went today ✓":due<=0?"It's time":`${days} day${days===1?"":"s"} ago`;
  }

  const examens=myExamens();
  const plan=S.state.plan||[];
  const books=S.items.filter(i=>i.kind==="book");
  const reading=books.filter(b=>!b.finished);
  const bookTile=reading.length?(reading.length===1?reading[0].title:reading.length+" on the shelf"):(books.length?"All finished ✝":"Add what you're reading");

  $("page-pray").innerHTML=`
    <div class="card lit-card"><div class="bar"></div><div class="body">
      <div class="eyebrow lit">${esc(sea)}</div>
      <div class="day">${esc(L.day||saint||"Feria")}</div>
      <div class="meta">${saint&&L.day&&!namesTheSame(L.day,saint)?esc(saint)+" · ":""}${fa?esc(fa.label)+" · ":""}${easter?"Regina Caeli replaces the Angelus":"Rosary: "+esc(mys.name)}</div>
    </div></div>

    <div class="card readings">
      <div class="sec-row"><h2 class="sec">Today at Mass</h2></div>
      ${refs.length
        ?refs.map(x=>`<div class="ref"><div class="l">${esc(x.label)}</div><div class="v">${esc(x.source)}</div></div>`).join("")
        :L.error
          ?`<div class="empty">The readings didn't load. <button class="link" onclick="A.retryReadings()">Try again</button></div>`
          :`<div class="ref skeleton"><div class="l">First Reading</div><div class="v">&nbsp;</div></div><div class="ref skeleton"><div class="l">Psalm</div><div class="v">&nbsp;</div></div><div class="ref skeleton"><div class="l">Gospel</div><div class="v">&nbsp;</div></div>`}
      <div class="ref-actions">
        ${refs.length?`<button class="btn sm" onclick="A.openReadings()">Read them</button>`:""}
        <a class="btn sm ghost" href="${usccbUrl(now)}" target="_blank" rel="noopener">${ICON.ext} USCCB</a>
      </div>
    </div>

    <div class="sec-row" style="margin-top:6px"><h2 class="sec">Pray</h2></div>
    <div class="grid2" style="margin-bottom:14px">
      <button class="ptile lit" onclick="A.openPrayer('rosary')"><div class="t">The Rosary</div><div class="s">${esc(mys.name.replace("The ",""))} today</div></button>
      <button class="ptile" onclick="A.openPrayer('${easter?"reginacaeli":"angelus"}')"><div class="t">${easter?"Regina Caeli":"The Angelus"}</div><div class="s">Morning, noon, and evening</div></button>
      <button class="ptile" onclick="A.openPrayer('chaplet')"><div class="t">Divine Mercy</div><div class="s">The three o'clock hour</div></button>
      <button class="ptile" onclick="A.openPrayer('examen')"><div class="t">The Examen</div><div class="s">Close the day with God</div></button>
      <button class="ptile" onclick="A.openPrayer('offering')"><div class="t">Morning Offering</div><div class="s">The first act of the day</div></button>
      <button class="ptile" onclick="A.openLibrary()"><div class="t">All prayers</div><div class="s">${PRAYERS.length} in the library</div></button>
    </div>

    <div class="card">
      <div class="sec-row"><h2 class="sec">Your rule</h2><button class="btn ghost sm" onclick="A.openPracticeModal()">${ICON.plus} Practice</button></div>
      ${pr.map(p=>practiceRow(p,dn)).join("")||'<div class="empty">Add your first practice, or set up your rule from the menu.</div>'}
      ${todayPr.length?`<div class="hint" style="margin-top:10px">${todayPr.filter(p=>dn.has(p.id)).length} of ${todayPr.length} kept today. ${todayPr.every(p=>dn.has(p.id))?"Deo gratias.":""}</div>`:""}
    </div>

    <div class="sec-row" style="margin-top:6px"><h2 class="sec">Keep the rule</h2></div>
    <div class="grid2">
      <button class="ptile ${confDueNow?"lit":""}" onclick="A.openConfession()"><div class="t">Confession</div><div class="s">${esc(confTile)}</div></button>
      <button class="ptile" onclick="A.openExamens()"><div class="t">The Examen</div><div class="s">${examens.length?examens.length+" written":"Close the day with God"}</div></button>
      <button class="ptile" onclick="A.openPlan()"><div class="t">Plan of life</div><div class="s">${plan.length?plan.length+" commitment"+(plan.length===1?"":"s"):"What you've promised"}</div></button>
      <button class="ptile" onclick="A.openBooks()"><div class="t">Spiritual reading</div><div class="s">${esc(bookTile)}</div></button>
    </div>`;
}

function practiceRow(p,dn){
  const on=dn.has(p.id), pr=findPrayer(p.name);
  return `<div class="practice ${on?"done-p":""}">
    <div class="emoji">${p.emoji||"🙏"}</div>
    <div class="grow"><div class="nm">${esc(p.name)}</div><div class="meta">${fmtT(p.time)} · ${p.mins} min · ${(p.days||[]).length===7?"daily":(p.days||[]).map(d=>DOWS[d]).join(" ")}${pr?` · <button class="link" style="font-size:12.5px" onclick="A.openPrayer('${esc(p.name)}')">pray →</button>`:""}</div></div>
    <button class="editp" onclick="A.openPracticeModal('${p.id}')">${ICON.edit}</button>
    <button class="donebtn ${on?"on":""}" onclick="A.togglePractice('${p.id}')">${on?"Kept":"Done"}</button>
  </div>`;
}

/* ---------------- the four panes behind "Keep the rule" ----------------
   Each is a full-screen sheet. After a write we repaint the sheet body in place
   rather than calling openSheet() again, which would jump the scroll back to the
   top — jarring when you tap "+15 min" halfway down the shelf. The data-pane
   marker means a repaint can only ever land on the pane it belongs to. */
const myExamens=()=>S.items.filter(i=>i.kind==="examen"&&isMine(i)).sort((a,b)=>b.createdAt-a.createdAt);
const longDate=ds=>new Date(ds+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"long",day:"numeric",year:"numeric"});

function repaint(name){
  if(!document.querySelector(`.sheet.open [data-pane="${name}"]`))return;
  $("sheet-body").innerHTML=PANES[name]();
}
function showPane(name){ openSheet(PANES[name](),{cls:"full"}); }

const PANES={
  confession(){
    const conf=(S.state.confession||{})[S.user.uid]||{};
    const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).slice().sort();
    const cad=conf.cadence||14, now=new Date();
    let line="No confession logged yet.", due="Log your first visit.";
    if(clog.length){
      const lastS=clog[clog.length-1], last=new Date(lastS+"T12:00"), days=daysSince(lastS), left=cad-days;
      line=`Last: ${last.toLocaleDateString(undefined,{month:"long",day:"numeric"})} · ${days===0?"today":days+"d ago"}`;
      due=left>0?`Next within ${left} day${left===1?"":"s"}`:"It's time. The font of mercy is open.";
    }
    return `<div class="reader" data-pane="confession"><div class="eyebrow lit">The font of mercy</div>
      <div class="r-title" style="font-size:30px">Confession</div>
      <div class="r-note">${esc(line)} · ${esc(due)}</div>
      <div class="amen" style="margin-top:20px"><button class="btn block" onclick="A.logConfession()">${ICON.dove} I went today</button></div>
      <label class="f">How often</label>
      <select onchange="A.setCadence(this.value)"><option value="7"${cad==7?" selected":""}>Weekly</option><option value="14"${cad==14?" selected":""}>Every two weeks</option><option value="30"${cad==30?" selected":""}>Monthly</option></select>
      ${clog.length?`<div class="sec-row" style="margin-top:26px"><h2 class="sec">Past visits</h2><span class="hint">${clog.length}</span></div>
        ${clog.slice().reverse().slice(0,24).map(ds=>`<div class="row"><div class="emoji">🕯</div><div class="grow title" style="font-size:15px">${longDate(ds)}</div><button class="x" onclick="A.rmConfession('${ds}')">×</button></div>`).join("")}`:""}
    </div>`;
  },

  examens(){
    const list=myExamens().slice(0,30);
    return `<div class="reader" data-pane="examens"><div class="eyebrow lit">Tonight</div>
      <div class="r-title" style="font-size:30px">The Examen</div>
      <div class="r-note">Five minutes before sleep: give thanks, ask light, review the day, ask pardon, resolve.</div>
      <div class="verse-line" style="margin-top:18px">“${esc(EXAMEN_Q[dayIdx(new Date())%EXAMEN_Q.length])}”</div>
      <div class="amen"><button class="btn block" onclick="A.openPrayer('examen')">${ICON.candle} Make tonight's examen</button></div>
      ${list.length?`<div class="sec-row" style="margin-top:26px"><h2 class="sec">Past examens</h2><span class="hint">private to you</span></div>
        ${list.map(l=>`<div class="row"><div class="emoji">🕯</div><div class="grow"><div class="qhist" style="font-size:16px">${esc(l.text)}</div><div class="sub">${new Date(l.createdAt).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</div></div><button class="x" onclick="A.delExamen('${l.id}')">×</button></div>`).join("")}`:""}
    </div>`;
  },

  plan(){
    const plan=S.state.plan||[];
    return `<div class="reader" data-pane="plan"><div class="eyebrow lit">What you've promised</div>
      <div class="r-title" style="font-size:30px">Plan of life</div>
      <div class="r-note">The commitments you have made before God. Few, and kept.</div>
      <div style="margin-top:18px">${plan.map(x=>`<div class="row"><div class="emoji">✝</div><div class="grow title">${esc(x.text)}</div><button class="x" onclick="A.rmPlan('${x.id}')">×</button></div>`).join("")||'<div class="empty">Daily Mass. The Rosary. Weekly confession. Add what you have resolved.</div>'}</div>
      <div class="addline"><input id="plan-in" placeholder="Add a commitment" onkeydown="if(event.key==='Enter')A.addPlan()"><button class="iconbtn" onclick="A.addPlan()">${ICON.plus}</button></div>
    </div>`;
  },

  books(){
    const books=S.items.filter(i=>i.kind==="book").sort((a,b)=>(a.finished-b.finished)||(b.createdAt-a.createdAt));
    const last7=[...Array(7)].map((_,i)=>addD(new Date(),i-6));
    return `<div class="reader" data-pane="books"><div class="eyebrow lit">The shelf</div>
      <div class="r-title" style="font-size:30px">Spiritual reading</div>
      <div class="r-note">Fifteen minutes a day outlasts an hour once a month.</div>
      <div class="amen" style="margin-top:18px"><button class="btn block" onclick="A.openBookModal()">${ICON.plus} Add a book</button></div>
      <div style="margin-top:20px">${books.map(b=>{
        const log=b.log||{}, total=Object.values(log).reduce((x,y)=>x+(+y||0),0), st=bookStreak(b);
        const today=log[todayS()]||0, goal=b.goal||15;
        const wk=last7.map(d=>`<span class="${(log[ymd(d)]||0)>0?"hit":""}">${"SMTWTFS"[d.getDay()]}</span>`).join("");
        return `<div style="padding:14px 0;border-top:1px solid var(--line-2)">
          <div class="sec-row" style="margin:0"><div class="grow"><div class="title ${b.finished?"done-text":""}" style="font-weight:600;font-size:17px">${esc(b.title)}</div><div class="sub">${b.author?esc(b.author)+" · ":""}${st>1?st+"-day streak · ":""}${fmtMins(total)} total${today?` · today ${fmtMins(today)}${today>=goal?" ✓":""}`:""}</div></div><button class="x" onclick="A.confirmDel('${b.id}','Remove this book and its log?')">×</button></div>
          <div class="wk7">${wk}</div>
          ${b.finished
            ?`<div class="chips" style="margin-top:10px"><button class="chip" onclick="A.finishBook('${b.id}',false)">Reopen</button></div>`
            :`<div class="chips" style="margin-top:10px"><button class="chip lit" onclick="A.logRead('${b.id}',5)">+5 min</button><button class="chip lit" onclick="A.logRead('${b.id}',15)">+15</button><button class="chip lit" onclick="A.logRead('${b.id}',30)">+30</button><button class="chip" onclick="A.finishBook('${b.id}',true)">Finished ✝</button></div>`}
        </div>`; }).join("")||'<div class="empty">Introduction to the Devout Life. Story of a Soul. The Imitation of Christ.</div>'}</div>
    </div>`;
  }
};

A.openConfession=()=>showPane("confession");
A.openExamens=()=>showPane("examens");
A.openPlan=()=>showPane("plan");
A.openBooks=()=>showPane("books");

/* ---------------- actions: practices, confession, plan, virtue ---------------- */
A.togglePractice=pid=>{
  const dn=doneSet(todayS()); const completing=!dn.has(pid);
  completing?dn.add(pid):dn.delete(pid);
  saveField(`rhythmDone.${todayS()}.${S.user.uid}`,[...dn]);
  if(completing){ haptic([12,30,12]); toast("Deo gratias"); }
};
A.openPracticeModal=pid=>{
  const p=pid?(S.state.practices||[]).find(x=>x.id===pid):null;
  openModal(`<h3>${p?"Edit practice":"New practice"}</h3>
    <label class="f">Name</label><input id="m-p-name" value="${p?esc(p.name):""}" placeholder="e.g. Divine Mercy Chaplet">
    <label class="f">Emoji</label><input id="m-p-emoji" value="${p?esc(p.emoji||""):""}" placeholder="🙏" maxlength="4">
    <label class="f">Time (the house rings then)</label><input id="m-p-time" type="time" value="${p?p.time:"15:00"}">
    <label class="f">Minutes</label><input id="m-p-mins" type="number" inputmode="numeric" value="${p?p.mins:10}">
    <label class="f">Days</label><div class="yn" id="m-p-days" style="flex-wrap:wrap">${DOWS.map((d,i)=>`<button data-d="${i}" class="${!p||(p.days||[]).includes(i)?"on":""}" style="flex:none;padding:9px 12px" onclick="this.classList.toggle('on')">${d}</button>`).join("")}</div>
    <div class="actions">${p?`<button class="btn ghost" onclick="A.rmPractice('${pid}')">Remove</button>`:`<button class="btn ghost" onclick="A.closeModal()">Cancel</button>`}<button class="btn" onclick="A.savePractice('${pid||""}')">${p?"Save":"Add"}</button></div>`);
};
A.savePractice=pid=>{
  const name=$("m-p-name").value.trim(); if(!name)return toast("Name the practice");
  const days=[...document.querySelectorAll("#m-p-days button.on")].map(b=>+b.dataset.d);
  const obj={id:pid||rid(),name,emoji:$("m-p-emoji").value.trim()||"🙏",time:$("m-p-time").value||"12:00",mins:+$("m-p-mins").value||10,days:days.length?days:[0,1,2,3,4,5,6]};
  const list=S.state.practices||[];
  saveKey("practices",pid?list.map(p=>p.id===pid?obj:p):list.concat([obj]).sort((a,b)=>a.time.localeCompare(b.time)));
  closeModal();
};
A.rmPractice=pid=>{ closeModal(); confirmModal("Remove this practice from the rule?",()=>saveKey("practices",(S.state.practices||[]).filter(p=>p.id!==pid))); };
A.logConfession=()=>{
  const conf=(S.state.confession||{})[S.user.uid]||{};
  const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).slice();
  if(clog.includes(todayS()))return toast("Already logged today");
  clog.push(todayS()); clog.sort();
  saveField(`confession.${S.user.uid}.log`,clog).then(()=>repaint("confession"));
  toast("Deo gratias 🕊");
};
A.rmConfession=ds=>{ const conf=(S.state.confession||{})[S.user.uid]||{}; const clog=(conf.log&&conf.log.length?conf.log:(conf.last?[conf.last]:[])).filter(d=>d!==ds); saveField(`confession.${S.user.uid}.log`,clog).then(()=>repaint("confession")); };
A.setCadence=v=>saveField(`confession.${S.user.uid}.cadence`,+v).then(()=>repaint("confession"));
A.addPlan=()=>{ const v=$("plan-in").value.trim(); if(!v)return; saveKey("plan",(S.state.plan||[]).concat([{id:rid(),text:v}])).then(()=>repaint("plan")); };
A.rmPlan=id=>saveKey("plan",(S.state.plan||[]).filter(p=>p.id!==id)).then(()=>repaint("plan"));
A.delExamen=id=>delItem(id).then(()=>repaint("examens"));

/* ---------------- readers ---------------- */
A.openReadings=()=>{
  const L=S.liturgy||{}, list=L.readings||[];
  if(!list.length)return toast("The readings haven't loaded yet");
  const block=(r,i)=>`<details class="rdg"${i===0?" open":""}><summary><span>${esc(r.label)}</span><span class="src">${esc(r.source)}</span></summary>
    ${r.heading?`<div class="rhead">${esc(r.heading)}</div>`:""}
    <div class="rtext">${r.body.map(p=>`<p>${esc(p)}</p>`).join("")}</div></details>`;
  openSheet(`<div class="reader"><div class="eyebrow lit">Today at Mass</div><div class="r-title" style="font-size:28px">${esc(L.day||"")}</div>
    <div class="r-note">Jerusalem Bible, via Universalis. For the NABRE as read at Mass in the United States, <a href="${usccbUrl(new Date())}" target="_blank" rel="noopener">open USCCB</a>.</div>
    <div style="margin-top:14px">${list.map(block).join("")}</div>
    ${L.copyright?`<div class="hint" style="margin-top:16px;opacity:.8">${esc(L.copyright)}</div>`:""}</div>`,{cls:"full"});
};
A.openLibrary=()=>{
  const easter=season(new Date()).name==="Easter";
  const list=PRAYERS.filter(p=>!(p.id==="angelus"&&easter)&&!(p.id==="reginacaeli"&&!easter));
  openSheet(`<div class="reader"><div class="eyebrow lit">The library</div><div class="r-title" style="font-size:30px">Prayers</div>
    <div style="margin-top:14px">${list.map(p=>`<div class="row" style="cursor:pointer" onclick="A.openPrayer('${p.id}')"><div class="grow"><div class="title">${esc(p.title)}${p.latin?` <span class="muted" style="font-family:var(--disp);font-style:italic">${esc(p.latin)}</span>`:""}</div><div class="sub">${esc(p.why)}</div></div>${ICON.chevron.replace('<svg','<svg style="width:18px;height:18px;color:var(--faint)"')}</div>`).join("")}</div></div>`,{cls:"full"});
};
/** Open a prayer by id or by a practice name. Guided prayers open the stepper. */
A.openPrayer=key=>{
  let p=prayerById(key)||findPrayer(key);
  if(!p)return toast("No text for that one yet");
  if(p.id==="angelus"&&season(new Date()).name==="Easter")p=prayerById("reginacaeli");
  if(p.guided)return openGuided(p);
  const practice=(S.state.practices||[]).find(x=>findPrayer(x.name)?.id===p.id);
  openSheet(`<div class="reader">
    <div class="eyebrow lit">${p.time?({morning:"Morning",noon:"Noon",afternoon:"Afternoon",evening:"Evening",night:"Night",meal:"At table"})[p.time]||"":"Prayer"}</div>
    <div class="r-title">${esc(p.title)}</div>${p.latin?`<div class="r-latin">${esc(p.latin)}</div>`:""}
    ${p.note?`<div class="r-note">${esc(p.note)}</div>`:""}
    <div class="two-lines"><div class="trad"><b>The tradition says</b>${esc(p.why)}</div><div class="sci"><b>The evidence says</b>${esc(p.does)}</div></div>
    <div class="r-body">${p.body.map(t=>`<p class="${/^V\./.test(t)?"vr":""}">${esc(t)}</p>`).join("")}</div>
    <div class="amen"><button class="btn block" onclick="A.amen('${practice?practice.id:""}')">Amen</button></div>
  </div>`,{cls:"full"});
};
A.amen=pid=>{ closeSheet(); if(pid&&!doneSet(todayS()).has(pid))A.togglePractice(pid); };

/* ---------------- guided flows ---------------- */
const G={steps:[],i:0,n:0,prayer:null,notes:""};
function openGuided(p){
  const now=new Date();
  G.prayer=p; G.i=0; G.n=0; G.notes="";
  if(p.guided==="rosary")G.steps=rosarySteps(mysteriesFor(now));
  else if(p.guided==="chaplet")G.steps=chapletSteps();
  else G.steps=examenSteps(EXAMEN_Q[dayIdx(now)%EXAMEN_Q.length]);
  openSheet("",{cls:"full"}); renderGuided();
}
function renderGuided(){
  const s=G.steps[G.i], total=G.steps.length, pct=Math.round((G.i/(total-1))*100);
  const beads=s.count?`<div class="g-count">${Array.from({length:s.count},(_,k)=>`<span class="bead ${k<G.n?"on":""}"></span>`).join("")}</div><div class="g-big">${G.n} <span style="font-size:24px;color:var(--muted)">/ ${s.count}</span></div>`:"";
  $("sheet-body").innerHTML=`<div class="guide">
    <div class="eyebrow lit">${esc(G.prayer.title)}</div>
    <div class="g-prog"><i style="width:${pct}%"></i></div>
    <div class="g-step">${G.i+1} of ${total}</div>
    <div class="g-title">${esc(s.title)}</div>${s.sub?`<div class="g-sub">${esc(s.sub)}</div>`:""}
    ${s.mystery?`<div class="g-mys"><div class="m">${esc(s.mystery)}</div><div class="f">Fruit of the mystery: ${esc(s.fruit)} · ${esc(s.ref)}</div></div>`:""}
    <div class="g-text" ${s.count?`onclick="A.gTap()"`:""}>${s.mystery?"":esc(s.text)}${s.mystery?`<span class="muted" style="font-size:17px">Consider the mystery for a moment, then continue.</span>`:""}</div>
    ${beads}
    ${s.prompt?`<textarea id="g-notes" rows="4" placeholder="A line or two. Private to you.">${esc(G.notes)}</textarea>`:""}
    <div class="g-nav">
      ${G.i>0?`<button class="btn ghost" onclick="A.gBack()">Back</button>`:`<button class="btn ghost" onclick="A.closeSheet()">Close</button>`}
      ${s.count?`<button class="btn" onclick="A.gTap()">${G.n<s.count?(G.n===0?"Say it, tap each":"Next bead"):"Continue"}</button>`:`<button class="btn" onclick="A.gNext()">${s.last?"Amen":"Continue"}</button>`}
    </div>
  </div>`;
}
A.gTap=()=>{ const s=G.steps[G.i]; if(!s.count)return A.gNext(); if(G.n<s.count){ G.n++; haptic(8); if(G.n===s.count){ setTimeout(A.gNext,350); } renderGuided(); } else A.gNext(); };
A.gBack=()=>{ if(G.i>0){ G.i--; G.n=0; renderGuided(); } };
A.gNext=()=>{
  const s=G.steps[G.i];
  if(s.prompt){ G.notes=($("g-notes")?.value||"").trim(); }
  if(s.last){ finishGuided(); return; }
  G.i++; G.n=0; renderGuided();
};
function finishGuided(){
  const p=G.prayer; closeSheet();
  if(p.guided==="examen"&&G.notes)addItem({kind:"examen",text:G.notes});   // the examens pane picks it up next open
  const practice=(S.state.practices||[]).find(x=>findPrayer(x.name)?.id===p.id);
  if(practice&&!doneSet(todayS()).has(practice.id))A.togglePractice(practice.id); else toast("Amen");
}

/* ---------------- the bell overlay ---------------- */
A.showBell=p=>{
  const pr=findPrayer(p.name);
  const b=$("bell");
  b.innerHTML=`<div><div class="bo-ico">🔔</div><div class="eyebrow" style="color:inherit;opacity:.8;margin-top:10px">The house rings</div><div class="bo-t">${esc(p.name)}</div><div class="bo-s">${fmtT(p.time)} · ${p.mins} min${pr?" · "+esc(pr.why):""}</div>
    <div class="bo-btns">${pr?`<button class="btn paper block" onclick="A.hideBell();A.openPrayer('${esc(p.name)}')">Pray now</button>`:""}<button class="btn block" style="background:rgba(255,255,255,.18);color:inherit" onclick="A.hideBell();A.togglePractice('${p.id}')">Mark kept</button><button class="btn block" style="background:transparent;color:inherit;opacity:.8" onclick="A.hideBell()">Later</button></div></div>`;
  b.classList.add("on");
};
A.hideBell=()=>$("bell").classList.remove("on");

/* ---------------- books (the shelf) ---------------- */
function bookStreak(b){ let n=0,d=new Date(); const log=b.log||{}; if(!log[ymd(d)])d=addD(d,-1); while((log[ymd(d)]||0)>0){n++;d=addD(d,-1);if(n>999)break;} return n; }
A.openBookModal=()=>openModal(`<h3>Add a book</h3><label class="f">Title</label><input id="m-bk-title" placeholder="Introduction to the Devout Life"><label class="f">Author</label><input id="m-bk-author" placeholder="St. Francis de Sales"><label class="f">Daily goal (minutes)</label><input id="m-bk-goal" type="number" inputmode="numeric" value="15">
  <div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.saveBook()">Add to shelf</button></div>`);
A.saveBook=()=>{ const title=$("m-bk-title").value.trim(); if(!title)return; addItem({kind:"book",title,author:$("m-bk-author").value.trim(),start:todayS(),goal:Math.max(1,+$("m-bk-goal").value||15),log:{},notes:[],finished:false}).then(()=>repaint("books")); closeModal(); };
A.logRead=(id,mins)=>{ const b=S.items.find(i=>i.id===id); if(!b)return; const log={...(b.log||{})}; log[todayS()]=(log[todayS()]||0)+mins; updItem(id,{log}).then(()=>repaint("books")); toast(log[todayS()]>=(b.goal||15)?"Goal reached today ✓":"+"+mins+" min"); };
A.finishBook=(id,fin)=>{ updItem(id,{finished:fin}).then(()=>repaint("books")); if(fin)toast("Finished. Deo gratias ✝"); };
A.confirmDel=(id,msg)=>confirmModal(msg,()=>delItem(id).then(()=>repaint("books")));

registerScreen("pray",render);
