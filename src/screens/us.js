/* Vita Plena — Us: the marriage. A prompt to talk over, three words a day,
   the weekly check-in, the monthly sit-down, shared tasks and reflections. */
import { S, esc, rid, todayS, dayIdx, PROMPTS, DOMAINS, THREE_WORDS, saveKey, saveField, addItem, updItem, delItem, isMine, tagCls, partnerName } from "../core/data.js";
import { $, A, ICON, openSheet, closeSheet, toast } from "../ui/dom.js";
import { registerScreen } from "../app/shell.js";

let promptIdx=null;
const daysSince=ts=>Math.floor((Date.now()-ts)/864e5);

function render(){
  if(promptIdx===null)promptIdx=dayIdx(new Date())%PROMPTS.length;
  const twDone=new Set((((S.state.threeWords||{})[todayS()])||{})[S.user.uid]||[]);
  const cis=S.items.filter(i=>i.kind==="checkin").sort((a,b)=>b.createdAt-a.createdAt);
  if(S.sdIdx==null)S.sdIdx=new Date().getMonth()%DOMAINS.length;
  const dom=DOMAINS[S.sdIdx];
  const sds=S.items.filter(i=>i.kind==="sitdown").sort((a,b)=>b.createdAt-a.createdAt);
  const shared=S.items.filter(i=>i.kind==="sharedtodo").sort((a,b)=>(a.done-b.done)||(a.createdAt-b.createdAt));
  const refl=S.items.filter(i=>i.kind==="reflection"&&(i.shared||isMine(i))).sort((a,b)=>b.createdAt-a.createdAt).slice(0,8);

  $("page-us").innerHTML=`
    <div class="prompt-card" onclick="A.nextPrompt()"><div class="q">${esc(PROMPTS[promptIdx])}</div><div class="h">Tap for another · talk it over with ${esc(partnerName())}</div></div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">Three words</h2><span class="hint">Please · thank you · sorry</span></div>
      ${THREE_WORDS.map(([k,em,nm,sub])=>`<div class="row"><div class="emoji">${em}</div><div class="grow"><div class="title ${twDone.has(k)?"done-text":""}">${nm}</div><div class="kind">${sub}</div></div><button class="donebtn ${twDone.has(k)?"on":""}" onclick="A.toggleTW('${k}')">${twDone.has(k)?"Said":"Done"}</button></div>`).join("")}
    </div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">Weekly check-in</h2><span class="hint">${cis.length?(daysSince(cis[0].createdAt)===0?"done today":daysSince(cis[0].createdAt)+"d ago"):"none yet"}</span></div>
      <div class="hint">Ten minutes on Sunday evening. Five questions, a number, and two yeses.</div>
      <button class="btn block" style="margin-top:12px" onclick="A.openCheckin()">${ICON.us} Begin the check-in</button>
      ${cis.slice(0,4).map(c=>`<div class="row"><div class="emoji">💍</div><div class="grow"><div class="title">${esc(c.ownerName)} · connection ${c.scale||"—"}/5</div><div class="sub">${c.pray?"Prayed together ✓":"No shared prayer"} · ${c.dateNight?"Date night ✓":"No date night"} · ${new Date(c.createdAt).toLocaleDateString()}</div>${c.appr?`<div class="qhist" style="font-size:16px;margin-top:4px">“${esc(c.appr)}”</div>`:""}</div>${isMine(c)?`<button class="x" onclick="A.delItem('${c.id}')">×</button>`:""}</div>`).join("")}
    </div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">Monthly sit-down</h2><button class="link" onclick="A.cycleDomain()">${esc(dom.name)} →</button></div>
      ${dom.qs.map(q=>`<div class="row"><div class="emoji">⚜</div><div class="grow qhist" style="font-size:16.5px">${esc(q)}</div></div>`).join("")}
      <label class="f">Notes</label><textarea id="sd-notes" rows="2" placeholder="What came up"></textarea>
      <label class="f">One resolution</label><input id="sd-res" placeholder="e.g. Rosary before bed on weeknights">
      <div class="actions"><button class="btn" onclick="A.saveSitdown()">Save the sit-down</button></div>
      ${sds.slice(0,3).map(sd=>`<div class="row"><div class="emoji">✝</div><div class="grow"><div class="title">${esc(sd.domain)}</div>${sd.resolution?`<div class="sub">Resolution: ${esc(sd.resolution)}</div>`:""}<div class="sub">${new Date(sd.createdAt).toLocaleDateString(undefined,{month:"long",year:"numeric"})}</div></div>${isMine(sd)?`<button class="x" onclick="A.delItem('${sd.id}')">×</button>`:""}</div>`).join("")}
    </div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">Ours to do</h2></div>
      ${shared.map(t=>`<div class="row"><button class="chk ${t.done?"on":""}" onclick="A.updItem('${t.id}',${!t.done})">${ICON.check}</button><div class="grow title ${t.done?"done-text":""}">${esc(t.text)}</div><span class="owner-tag ${tagCls(t)}">${esc(t.ownerInitials||"")}</span><button class="x" onclick="A.delItem('${t.id}')">×</button></div>`).join("")||'<div class="empty">Things for the two of you.</div>'}
      <div class="addline"><input id="sharedtodo-in" placeholder="Add something for us" onkeydown="if(event.key==='Enter')A.addSharedTodo()"><button class="iconbtn" onclick="A.addSharedTodo()">${ICON.plus}</button></div>
    </div>
    <div class="card">
      <div class="sec-row"><h2 class="sec">Reflections</h2></div>
      <div class="seg" style="margin-bottom:10px"><button class="${!S.shareRefl?"on":""}" onclick="A.setVis(false)">🔒 Private</button><button class="${S.shareRefl?"on":""}" onclick="A.setVis(true)">👫 Share with ${esc(partnerName())}</button></div>
      <textarea id="refl-in" rows="3" placeholder="On today's prompt, or anything"></textarea>
      <div class="actions"><button class="btn" onclick="A.saveReflection()">Save</button></div>
      ${refl.map(r=>`<div class="row"><div class="emoji">${r.shared?"👫":"🔒"}</div><div class="grow"><div class="qhist" style="font-size:16px">“${esc(r.text)}”</div><div class="sub">${esc(r.ownerName)} · ${new Date(r.createdAt).toLocaleDateString()}${r.shared?"":" · private"}</div></div>${isMine(r)?`<button class="x" onclick="A.delItem('${r.id}')">×</button>`:""}</div>`).join("")}
    </div>`;
}
A.nextPrompt=()=>{ promptIdx=(promptIdx+1)%PROMPTS.length; render(); };
A.toggleTW=k=>{ const cur=new Set((((S.state.threeWords||{})[todayS()])||{})[S.user.uid]||[]); cur.has(k)?cur.delete(k):cur.add(k); saveField(`threeWords.${todayS()}.${S.user.uid}`,[...cur]); };
A.cycleDomain=()=>{ S.sdIdx=(S.sdIdx+1)%DOMAINS.length; render(); };
A.saveSitdown=()=>{
  const dom=DOMAINS[S.sdIdx]; const notes=$("sd-notes").value.trim(), res=$("sd-res").value.trim();
  if(!notes&&!res)return toast("Write a note or a resolution first");
  addItem({kind:"sitdown",domain:dom.name,notes,resolution:res});
  if(res)saveKey("focus",(S.state.focus||[]).concat([{id:rid(),text:res,done:false}]));
  toast(res?"Saved. Resolution added to this week's focus ✝":"Sit-down saved ✝");
};
A.setVis=v=>{ S.shareRefl=v; render(); };
A.saveReflection=()=>{ const v=$("refl-in").value.trim(); if(!v)return; addItem({kind:"reflection",text:v,prompt:PROMPTS[promptIdx],shared:!!S.shareRefl}); toast(S.shareRefl?"Shared 👫":"Saved privately 🔒"); };
A.addSharedTodo=()=>{ const v=$("sharedtodo-in").value.trim(); if(!v)return; addItem({kind:"sharedtodo",text:v,done:false}); };
A.updItem=(id,done)=>updItem(id,{done});

/* the check-in, as a guided sheet */
const CI={scale:0,pray:null,date:null};
A.openCheckin=()=>{
  CI.scale=0; CI.pray=null; CI.date=null;
  openSheet(`<div class="reader"><div class="eyebrow lit">Weekly · state of the union</div><div class="r-title" style="font-size:30px">With ${esc(partnerName())}</div>
    <label class="f">I appreciated when you…</label><textarea id="ci-appr" rows="2"></textarea>
    <label class="f">What went well this week</label><textarea id="ci-well" rows="2"></textarea>
    <label class="f">Where did we meet God together?</label><textarea id="ci-god" rows="2"></textarea>
    <label class="f">I feel… about… and I need…</label><textarea id="ci-name" rows="2"></textarea>
    <label class="f">One thing I need from you this week</label><textarea id="ci-need" rows="2"></textarea>
    <label class="f">How connected did we feel? 1–5</label><div class="scale" id="ci-scale">${[1,2,3,4,5].map(n=>`<button onclick="A.ciScale(${n})">${n}</button>`).join("")}</div>
    <label class="f">Did we pray together?</label><div class="yn" id="ci-pray"><button onclick="A.ciYN('pray',true)">Yes</button><button onclick="A.ciYN('pray',false)">No</button></div>
    <label class="f">Did we have a date?</label><div class="yn" id="ci-date"><button onclick="A.ciYN('date',true)">Yes</button><button onclick="A.ciYN('date',false)">No</button></div>
    <div class="amen"><button class="btn block" onclick="A.saveCheckin()">Save the check-in</button></div></div>`,{cls:"full"});
};
A.ciScale=n=>{ CI.scale=n; [...$("ci-scale").children].forEach(b=>b.classList.toggle("on",+b.textContent===n)); };
A.ciYN=(k,v)=>{ CI[k]=v; [...$("ci-"+k).children].forEach((b,i)=>b.classList.toggle("on",(i===0)===v)); };
A.saveCheckin=()=>{
  addItem({kind:"checkin",scale:CI.scale,pray:CI.pray===true,dateNight:CI.date===true,appr:$("ci-appr").value.trim(),well:$("ci-well").value.trim(),god:$("ci-god").value.trim(),name:$("ci-name").value.trim(),need:$("ci-need").value.trim()});
  closeSheet(); toast("Check-in saved 💍");
};

registerScreen("us",render);
