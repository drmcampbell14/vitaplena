/* VITA PLENA v4 — views/us.js — Three Words, State of the Union, Sit-Down, reflections */
import { $, esc, rid, todayS, dayIdx, S, PROMPTS, DOMAINS, THREE_WORDS,
  saveKey, saveField, addItem, updItem, delItem, isMine, tagCls, toast } from "./data.js";

let promptIdx=null;
function daysSince(ts){return Math.floor((Date.now()-ts)/864e5);}
export function renderUs(){
  if(promptIdx===null)promptIdx=dayIdx(new Date())%PROMPTS.length;
  $("prompt-q").textContent=PROMPTS[promptIdx];
  const twDone=new Set((((S.state.threeWords||{})[todayS()])||{})[S.user.uid]||[]);
  $("tw-list").innerHTML=THREE_WORDS.map(([k,em,nm,sub])=>`<div class="agenda-row"><div class="emoji" style="width:30px">${em}</div><div class="grow"><div class="title ${twDone.has(k)?"done-text":""}">${nm}</div><div class="kind">${sub}</div></div><button class="donebtn ${twDone.has(k)?"undone":""}" onclick="toggleTW('${k}')">${twDone.has(k)?"Undo":"Done"}</button></div>`).join("");
  const cis=S.items.filter(i=>i.kind==="checkin").sort((a,b)=>b.createdAt-a.createdAt);
  $("ci-last").textContent=cis.length?(daysSince(cis[0].createdAt)===0?"done today":daysSince(cis[0].createdAt)+"d since last"):"no check-ins yet";
  if(S.sdIdx==null)S.sdIdx=new Date().getMonth()%DOMAINS.length;
  const dom=DOMAINS[S.sdIdx];
  $("sd-domain").textContent="This month: "+dom.name;
  $("sd-questions").innerHTML=dom.qs.map(q=>`<div class="row"><div class="emoji">⚜</div><div class="grow qhist">${esc(q)}</div></div>`).join("");
  const sds=S.items.filter(i=>i.kind==="sitdown").sort((a,b)=>b.createdAt-a.createdAt);
  $("sd-last").textContent=sds.length?(daysSince(sds[0].createdAt)+"d since last"):"no sit-downs yet";
  $("sitdown-list").innerHTML=sds.slice(0,6).map(sd=>`<div class="row"><div class="emoji">✝</div><div class="grow"><div class="title">${esc(sd.domain)}</div>${sd.resolution?`<div class="sub">Resolution: ${esc(sd.resolution)}</div>`:""}${sd.notes?`<div class="qhist" style="margin-top:3px">${esc(sd.notes)}</div>`:""}<div class="sub">${new Date(sd.createdAt).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</div></div>${isMine(sd)?`<button class="x" onclick="delItem('${sd.id}')">×</button>`:""}</div>`).join("");
  $("sharedtodo-list").innerHTML=S.items.filter(i=>i.kind==="sharedtodo").sort((a,b)=>(a.done-b.done)||(a.createdAt-b.createdAt))
    .map(t=>`<div class="row"><button class="chk ${t.done?"on":""}" onclick="updItem('${t.id}',{done:${!t.done}})">✓</button><div class="grow title ${t.done?"done-text":""}">${esc(t.text)}</div><span class="owner-tag ${tagCls(t)}">${esc(t.ownerInitials)}</span><button class="x" onclick="delItem('${t.id}')">×</button></div>`).join("")||'<div class="empty">No shared tasks yet.</div>';
  $("shared-refl-list").innerHTML=S.items.filter(i=>i.kind==="reflection"&&(i.shared||isMine(i))).sort((a,b)=>b.createdAt-a.createdAt).slice(0,12)
    .map(r=>`<div class="row"><div class="emoji">${r.shared?"👫":"🔒"}</div><div class="grow"><div class="qhist">\u201C${esc(r.text)}\u201D</div><div class="sub">${esc(r.ownerName)} · ${new Date(r.createdAt).toLocaleDateString()}${r.shared?"":" · private"}</div></div>${isMine(r)?`<button class="x" onclick="delItem('${r.id}')">×</button>`:""}</div>`).join("")||'<div class="empty">No reflections yet.</div>';
  $("checkin-list").innerHTML=cis.slice(0,8)
    .map(c=>{const g=c.appr||c.grat;return `<div class="row"><div class="emoji">💍</div><div class="grow"><div class="title">${esc(c.ownerName)} · connection ${c.scale||"—"}/5</div><div class="sub">${c.pray?"Prayed together ✓":"No shared prayer"} · ${c.dateNight?"Date night ✓":"No date night"} · ${new Date(c.createdAt).toLocaleDateString()}</div>${g?`<div class="qhist" style="margin-top:4px">Appreciated: \u201C${esc(g)}\u201D</div>`:""}${c.need?`<div class="qhist">Needs: \u201C${esc(c.need)}\u201D</div>`:""}</div>${isMine(c)?`<button class="x" onclick="delItem('${c.id}')">×</button>`:""}</div>`;}).join("")||'<div class="empty">No check-ins yet — try Sunday evenings.</div>';
}
export function wireUs(){
  $("prompt-card").onclick=()=>{promptIdx=(promptIdx+1)%PROMPTS.length;$("prompt-q").textContent=PROMPTS[promptIdx];};
  $("ci-scale").innerHTML=[1,2,3,4,5].map(n=>`<button onclick="ciScale(${n},this)">${n}</button>`).join("");
  [["ci-pray","pray"],["ci-date","date"]].forEach(([id,k])=>{const el=$(id);[...el.children].forEach((b,i)=>b.onclick=()=>{S.ci[k]=i===0;[...el.children].forEach((x,j)=>x.classList.toggle("on",j===i));});});
}
window.toggleTW=(k)=>{
  const cur=new Set((((S.state.threeWords||{})[todayS()])||{})[S.user.uid]||[]);
  cur.has(k)?cur.delete(k):cur.add(k);
  saveField(`threeWords.${todayS()}.${S.user.uid}`,[...cur]);
};
window.cycleDomain=()=>{S.sdIdx=(S.sdIdx+1)%DOMAINS.length;renderUs();};
window.saveSitdown=()=>{
  const dom=DOMAINS[S.sdIdx];
  const notes=$("sd-notes").value.trim(),res=$("sd-res").value.trim();
  if(!notes&&!res)return toast("Write a note or a resolution first");
  addItem({kind:"sitdown",domain:dom.name,notes,resolution:res});
  if(res)saveKey("focus",(S.state.focus||[]).concat([{id:rid(),text:res,done:false}]));
  $("sd-notes").value="";$("sd-res").value="";
  toast(res?"Saved — resolution added to Weekly Focus ✝":"Sit-down saved ✝");
};
window.setVis=share=>{S.shareRefl=share;$("vis-priv").classList.toggle("on",!share);$("vis-share").classList.toggle("on",share);};
window.saveReflection=()=>{const v=$("refl-in").value.trim();if(!v)return;$("refl-in").value="";addItem({kind:"reflection",text:v,prompt:PROMPTS[promptIdx],shared:S.shareRefl});toast(S.shareRefl?"Shared with your spouse 👫":"Saved privately 🔒");};
window.addSharedTodo=()=>{const v=$("sharedtodo-in").value.trim();if(!v)return;$("sharedtodo-in").value="";addItem({kind:"sharedtodo",text:v,done:false});};
window.ciScale=(n)=>{S.ci.scale=n;[...$("ci-scale").children].forEach(b=>b.classList.toggle("on",+b.textContent===n));};
window.saveCheckin=()=>{
  addItem({kind:"checkin",scale:S.ci.scale,pray:S.ci.pray===true,dateNight:S.ci.date===true,
    appr:$("ci-appr").value.trim(),well:$("ci-well").value.trim(),god:$("ci-god").value.trim(),
    name:$("ci-name").value.trim(),need:$("ci-need").value.trim()});
  ["ci-appr","ci-well","ci-god","ci-name","ci-need"].forEach(i=>$(i).value="");
  S.ci={scale:0,pray:null,date:null};
  [...$("ci-scale").children].forEach(b=>b.classList.remove("on"));
  [...$("ci-pray").children,...$("ci-date").children].forEach(b=>b.classList.remove("on"));
  toast("Check-in saved 💍");
};
