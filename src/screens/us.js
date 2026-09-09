/* Vita Plena — Us: the marriage. A prompt to talk over and three words a day sit
   on the surface, because they are daily and take seconds. Everything longer —
   the weekly check-in, the monthly sit-down, the virtue of the month, the
   reflections — is a tile you tap, and it opens full-screen. The screen stays a
   short menu instead of a wall of forms. */
import { S, esc, rid, todayS, dayIdx, PROMPTS, DOMAINS, THREE_WORDS, VIRTUES, saveKey, saveField,
  addItem, delItem, isMine, partnerName } from "../core/data.js";
import { $, A, ICON, openSheet, closeSheet, toast } from "../ui/dom.js";
import { registerScreen } from "../app/shell.js";

let promptIdx=null;
const daysSince=ts=>Math.floor((Date.now()-ts)/864e5);
const ago=ts=>{ const d=daysSince(ts); return d===0?"today":d===1?"yesterday":d+" days ago"; };
const checkins=()=>S.items.filter(i=>i.kind==="checkin").sort((a,b)=>b.createdAt-a.createdAt);
const sitdowns=()=>S.items.filter(i=>i.kind==="sitdown").sort((a,b)=>b.createdAt-a.createdAt);
const reflections=()=>S.items.filter(i=>i.kind==="reflection"&&(i.shared||isMine(i))).sort((a,b)=>b.createdAt-a.createdAt);
const fmtDate=ts=>new Date(ts).toLocaleDateString(undefined,{month:"long",day:"numeric"});

function render(){
  if(promptIdx===null)promptIdx=dayIdx(new Date())%PROMPTS.length;
  const twDone=new Set((((S.state.threeWords||{})[todayS()])||{})[S.user.uid]||[]);
  if(S.sdIdx==null)S.sdIdx=new Date().getMonth()%DOMAINS.length;
  const cis=checkins(), sds=sitdowns(), refl=reflections();
  const v=S.state.virtue||{};
  const month=new Date().toLocaleDateString(undefined,{month:"long"});

  $("page-us").innerHTML=`
    <div class="prompt-card" onclick="A.nextPrompt()"><div class="q">${esc(PROMPTS[promptIdx])}</div><div class="h">Tap for another · talk it over with ${esc(partnerName())}</div></div>

    <div class="card">
      <div class="sec-row"><h2 class="sec">Three words</h2><span class="hint">Please · thank you · sorry</span></div>
      ${THREE_WORDS.map(([k,em,nm,sub])=>`<div class="row"><div class="emoji">${em}</div><div class="grow"><div class="title ${twDone.has(k)?"done-text":""}">${nm}</div><div class="kind">${sub}</div></div><button class="chk ${twDone.has(k)?"on":""}" onclick="A.toggleTW('${k}')" aria-label="${twDone.has(k)?"Said":"Mark said"}">${ICON.check}</button></div>`).join("")}
    </div>

    <div class="sec-row" style="margin-top:6px"><h2 class="sec">Sit down together</h2></div>
    <div class="grid2">
      <button class="ptile" onclick="A.openCheckin()"><div class="t">Weekly check-in</div><div class="s">${cis.length?"Last "+ago(cis[0].createdAt):"Ten minutes on Sunday"}</div></button>
      <button class="ptile" onclick="A.openSitdown()"><div class="t">Monthly sit-down</div><div class="s">${sds.length?"Last "+fmtDate(sds[0].createdAt):"One domain a month"}</div></button>
      <button class="ptile" onclick="A.openVirtue()"><div class="t">Virtue of the month</div><div class="s">${v.name?esc(v.name)+" · "+month:"Choose one for "+month}</div></button>
      <button class="ptile" onclick="A.openReflections()"><div class="t">Reflections</div><div class="s">${refl.length?refl.length+" written":"Yours and shared"}</div></button>
    </div>`;
}

A.nextPrompt=()=>{ promptIdx=(promptIdx+1)%PROMPTS.length; render(); };
A.toggleTW=k=>{ const cur=new Set((((S.state.threeWords||{})[todayS()])||{})[S.user.uid]||[]); cur.has(k)?cur.delete(k):cur.add(k); saveField(`threeWords.${todayS()}.${S.user.uid}`,[...cur]); };
A.delItem=id=>delItem(id);

/* ---------------- weekly check-in ---------------- */
const CI={scale:0,pray:null,date:null};
A.openCheckin=()=>{
  CI.scale=0; CI.pray=null; CI.date=null;
  const past=checkins().slice(0,4);
  openSheet(`<div class="reader"><div class="eyebrow lit">Weekly · state of the union</div><div class="r-title" style="font-size:30px">With ${esc(partnerName())}</div>
    <div class="r-note">Ten minutes on Sunday evening. Five questions, a number, and two yeses.</div>
    <label class="f">I appreciated when you…</label><textarea id="ci-appr" rows="2"></textarea>
    <label class="f">What went well this week</label><textarea id="ci-well" rows="2"></textarea>
    <label class="f">Where did we meet God together?</label><textarea id="ci-god" rows="2"></textarea>
    <label class="f">I feel… about… and I need…</label><textarea id="ci-name" rows="2"></textarea>
    <label class="f">One thing I need from you this week</label><textarea id="ci-need" rows="2"></textarea>
    <label class="f">How connected did we feel? 1–5</label><div class="scale" id="ci-scale">${[1,2,3,4,5].map(n=>`<button onclick="A.ciScale(${n})">${n}</button>`).join("")}</div>
    <label class="f">Did we pray together?</label><div class="yn" id="ci-pray"><button onclick="A.ciYN('pray',true)">Yes</button><button onclick="A.ciYN('pray',false)">No</button></div>
    <label class="f">Did we have a date?</label><div class="yn" id="ci-date"><button onclick="A.ciYN('date',true)">Yes</button><button onclick="A.ciYN('date',false)">No</button></div>
    <div class="amen"><button class="btn block" onclick="A.saveCheckin()">Save the check-in</button></div>
    ${past.length?`<div class="sec-row" style="margin-top:26px"><h2 class="sec">Past check-ins</h2></div>${past.map(c=>`<div class="row"><div class="emoji">💍</div><div class="grow"><div class="title">${esc(c.ownerName)} · connection ${c.scale||"—"}/5</div><div class="sub">${c.pray?"Prayed together ✓":"No shared prayer"} · ${c.dateNight?"Date night ✓":"No date night"} · ${fmtDate(c.createdAt)}</div>${c.appr?`<div class="qhist" style="font-size:16px;margin-top:4px">“${esc(c.appr)}”</div>`:""}</div>${isMine(c)?`<button class="x" onclick="A.delItem('${c.id}')">×</button>`:""}</div>`).join("")}`:""}
  </div>`,{cls:"full"});
};
A.ciScale=n=>{ CI.scale=n; [...$("ci-scale").children].forEach(b=>b.classList.toggle("on",+b.textContent===n)); };
A.ciYN=(k,v)=>{ CI[k]=v; [...$("ci-"+k).children].forEach((b,i)=>b.classList.toggle("on",(i===0)===v)); };
A.saveCheckin=()=>{
  addItem({kind:"checkin",scale:CI.scale,pray:CI.pray===true,dateNight:CI.date===true,appr:$("ci-appr").value.trim(),well:$("ci-well").value.trim(),god:$("ci-god").value.trim(),name:$("ci-name").value.trim(),need:$("ci-need").value.trim()});
  closeSheet(); toast("Check-in saved 💍");
};

/* ---------------- monthly sit-down ---------------- */
A.openSitdown=()=>{
  const dom=DOMAINS[S.sdIdx], past=sitdowns().slice(0,3);
  openSheet(`<div class="reader"><div class="eyebrow lit">Monthly · one domain at a time</div>
    <div class="r-title" style="font-size:30px">${esc(dom.name)}</div>
    <div class="r-note">Not the whole marriage every month — one part of it, properly. <button class="link" onclick="A.cycleDomain()">Another domain →</button></div>
    <div style="margin-top:18px">${dom.qs.map(q=>`<div class="row"><div class="emoji">⚜</div><div class="grow qhist" style="font-size:16.5px">${esc(q)}</div></div>`).join("")}</div>
    <label class="f">Notes</label><textarea id="sd-notes" rows="3" placeholder="What came up"></textarea>
    <label class="f">One resolution</label><input id="sd-res" placeholder="e.g. Rosary before bed on weeknights">
    <div class="hint" style="margin-top:8px">A resolution is added to this week's focus on Today.</div>
    <div class="amen"><button class="btn block" onclick="A.saveSitdown()">Save the sit-down</button></div>
    ${past.length?`<div class="sec-row" style="margin-top:26px"><h2 class="sec">Past sit-downs</h2></div>${past.map(sd=>`<div class="row"><div class="emoji">✝</div><div class="grow"><div class="title">${esc(sd.domain)}</div>${sd.resolution?`<div class="sub">Resolution: ${esc(sd.resolution)}</div>`:""}<div class="sub">${new Date(sd.createdAt).toLocaleDateString(undefined,{month:"long",year:"numeric"})}</div></div>${isMine(sd)?`<button class="x" onclick="A.delItem('${sd.id}')">×</button>`:""}</div>`).join("")}`:""}
  </div>`,{cls:"full"});
};
A.cycleDomain=()=>{ S.sdIdx=(S.sdIdx+1)%DOMAINS.length; A.openSitdown(); };
A.saveSitdown=()=>{
  const dom=DOMAINS[S.sdIdx], notes=$("sd-notes").value.trim(), res=$("sd-res").value.trim();
  if(!notes&&!res)return toast("Write a note or a resolution first");
  addItem({kind:"sitdown",domain:dom.name,notes,resolution:res});
  if(res)saveKey("focus",(S.state.focus||[]).concat([{id:rid(),text:res,done:false}]));
  closeSheet(); toast(res?"Saved. Resolution added to this week's focus ✝":"Sit-down saved ✝");
};

/* ---------------- virtue of the month ---------------- */
A.openVirtue=()=>{
  const v=S.state.virtue||{}, month=new Date().toLocaleDateString(undefined,{month:"long"});
  openSheet(`<div class="reader"><div class="eyebrow lit">${esc(month)}</div>
    <div class="r-title" style="font-size:30px">Virtue of the month</div>
    <div class="r-note">One virtue, one month, one concrete practice. The saints did not work on everything at once.</div>
    <label class="f">Virtue</label>
    <select id="virtue-sel"><option value="">— choose —</option>${VIRTUES.map(x=>`<option ${x===v.name?"selected":""}>${x}</option>`).join("")}</select>
    <label class="f">The practice</label>
    <input id="virtue-res" value="${esc(v.res||"")}" placeholder="One small, repeatable act">
    <div class="amen"><button class="btn block" onclick="A.saveVirtue()">Save the virtue</button></div>
  </div>`,{cls:"full"});
};
A.saveVirtue=()=>{
  const name=$("virtue-sel").value; if(!name)return toast("Choose a virtue first");
  saveKey("virtue",{name,res:$("virtue-res").value.trim(),month:new Date().getMonth()});
  closeSheet(); toast("Virtue saved");
};

/* ---------------- reflections ---------------- */
A.openReflections=()=>{
  const refl=reflections().slice(0,20);
  openSheet(`<div class="reader"><div class="eyebrow lit">On today's prompt, or anything</div>
    <div class="r-title" style="font-size:30px">Reflections</div>
    <div class="seg" style="margin:16px 0 10px"><button class="${!S.shareRefl?"on":""}" onclick="A.setVis(false)">🔒 Private</button><button class="${S.shareRefl?"on":""}" onclick="A.setVis(true)">👫 Share with ${esc(partnerName())}</button></div>
    <textarea id="refl-in" rows="4" placeholder="${esc(PROMPTS[promptIdx])}"></textarea>
    <div class="amen"><button class="btn block" onclick="A.saveReflection()">Save</button></div>
    ${refl.length?`<div style="margin-top:26px">${refl.map(r=>`<div class="row"><div class="emoji">${r.shared?"👫":"🔒"}</div><div class="grow"><div class="qhist" style="font-size:16px">“${esc(r.text)}”</div><div class="sub">${esc(r.ownerName)} · ${fmtDate(r.createdAt)}${r.shared?"":" · private"}</div></div>${isMine(r)?`<button class="x" onclick="A.delItem('${r.id}')">×</button>`:""}</div>`).join("")}</div>`:""}
  </div>`,{cls:"full"});
};
A.setVis=v=>{ S.shareRefl=v; A.openReflections(); };
A.saveReflection=()=>{
  const val=$("refl-in").value.trim(); if(!val)return toast("Write something first");
  addItem({kind:"reflection",text:val,prompt:PROMPTS[promptIdx],shared:!!S.shareRefl});
  closeSheet(); toast(S.shareRefl?"Shared 👫":"Saved privately 🔒");
};

registerScreen("us",render);
