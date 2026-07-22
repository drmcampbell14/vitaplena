/* VITA PLENA v4 — app.js — boot, auth, onboarding, navigation, render loop */
import { $, esc, rid, uid6, todayS, S, bus, db, auth, provider,
  DEFAULT_PRACTICES, DEFAULT_PLAN, saveKey, saveField, toast } from "./data.js";
import { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, onSnapshot, arrayUnion, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderHome } from "./today.js";
import { renderCalendar, wireCalendarInputs } from "./calendar.js";
import { renderTasks } from "./tasks.js";
import { renderFaith, loadReadings } from "./faith.js";
import { renderUs, wireUs } from "./us.js";
import { renderMeals, renderFinance, renderFamily, renderNotes, wireMeals } from "./extras.js";
import { renderSettings } from "./settings.js";
import { loadGis } from "./gcal.js";
import "./companion.js";

/* ---------------- render loop ---------------- */
function renderAll(){
  if(!S.house)return;
  renderHeader();renderHome();renderCalendar();renderTasks();renderFaith();renderUs();
  renderMeals();renderFinance();renderFamily();renderNotes();renderSettings();
}
bus.render=renderAll;
window.busRender=renderAll;

function renderHeader(){
  const now=new Date();
  $("hdr-date").textContent=now.toLocaleDateString(undefined,{month:"short",day:"numeric"});
  const members=S.house.members||[];
  const profOf=u=>S.house?.profiles?.[u]||{name:"—",initials:"·"};
  $("hdr-avatars").innerHTML=members.map(m=>{const p=profOf(m);return `<div class="av ${m===S.user.uid?"me":""}" title="${esc(p.name)}">${esc(p.initials)}</div>`;}).join("");
}

/* ---------------- auth gate ---------------- */
if($("btn-google"))$("btn-google").onclick=async()=>{
  try{await signInWithPopup(auth,provider);}
  catch(e){ if(e.code==="auth/popup-blocked"||e.code==="auth/popup-closed-by-user"||e.code==="auth/cancelled-popup-request"){try{await signInWithRedirect(auth,provider);}catch(e2){toast(e2.message);}} else toast(e.message);}
};
getRedirectResult(auth).catch(()=>{});
$("btn-signout-ob").onclick=()=>signOut(auth);
window.doSignOut=()=>signOut(auth).then(()=>location.reload());

onAuthStateChanged(auth,async(user)=>{
  S.user=user;
  if(!user){showGate("signin");return;}
  $("loading").classList.remove("hide");
  const uref=doc(db,"users",user.uid);
  const usnap=await getDoc(uref).catch(()=>null);
  if(usnap&&usnap.exists()&&usnap.data().hid){
    attachHousehold(usnap.data().hid);
  }else{
    $("ob-name").value=user.displayName?user.displayName.split(" ")[0]:"";
    $("ob-initials").value=user.displayName?user.displayName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"";
    showGate("onboard");
  }
});
function showGate(which){
  $("loading").classList.add("hide");
  $("gate").classList.remove("hide");document.body.classList.add("gate");
  $("appheader").style.display="none";$("app").style.display="none";$("tabbar").style.display="none";$("cmp-fab").style.display="none";
  $("gate-signin").style.display=which==="signin"?"":"none";
  $("gate-onboard").style.display=which==="onboard"?"":"none";
}

/* ---------------- create / join household ---------------- */
$("btn-create-house").onclick=async()=>{
  const name=$("ob-name").value.trim(),ini=$("ob-initials").value.trim().toUpperCase();
  if(!name||!ini)return toast("Add your name and initials first");
  const hname=$("ob-house").value.trim()||name+"'s Household";
  const code=uid6();
  try{
    const href=await addDoc(collection(db,"households"),{
      name:hname,code,members:[S.user.uid],
      profiles:{[S.user.uid]:{name,initials:ini}},
      countdown:{label:"",date:""},createdAt:serverTimestamp()});
    await setDoc(doc(db,"invites",code),{hid:href.id});
    await setDoc(doc(db,"households",href.id,"state","main"),{
      practices:DEFAULT_PRACTICES,plan:DEFAULT_PLAN,rhythmDone:{},
      taskSections:{[S.user.uid]:[{id:rid(),name:"Career & Goals",emoji:"🎯"}],
        together:[{id:rid(),name:"Household",emoji:"🏡"},{id:rid(),name:"Faith",emoji:"✝️"},{id:rid(),name:"Health & Wellness",emoji:"💪"},{id:rid(),name:"Pets",emoji:"🐾"}]},
      meals:{},grocery:[],budget:{income:[],expense:[],savings:[]},funds:[],debts:[],
      focus:[],countdowns:[],books:[],virtue:{},confession:{}});
    await setDoc(doc(db,"users",S.user.uid),{hid:href.id,name,initials:ini});
    S.hid=href.id;
    startLadder(name);
  }catch(e){toast("Could not create household: "+e.message);}
};
$("btn-join-house").onclick=async()=>{
  const name=$("ob-name").value.trim(),ini=$("ob-initials").value.trim().toUpperCase();
  const code=$("ob-code").value.trim().toUpperCase();
  if(!name||!ini)return toast("Add your name and initials first");
  if(!code)return toast("Enter the invite code");
  try{
    const inv=await getDoc(doc(db,"invites",code));
    if(!inv.exists())return toast("Code not found — check with your spouse");
    const hid=inv.data().hid;
    await updateDoc(doc(db,"households",hid),{members:arrayUnion(S.user.uid),["profiles."+S.user.uid]:{name,initials:ini}});
    await setDoc(doc(db,"users",S.user.uid),{hid,name,initials:ini});
    attachHousehold(hid);
  }catch(e){toast("Could not join: "+e.message);}
};

/* ---------------- Ladder onboarding (God → Family → Vocation → Rest) ---------------- */
const LOB = {
  step:0, name:"",
  wake:"07:00",
  prayers:{
    p1:{name:"Morning Offering",emoji:"🙏",mins:5,on:true},
    p2:{name:"Holy Mass",emoji:"✝️",mins:60,on:false},
    p3:{name:"Angelus",emoji:"🔔",mins:5,on:false},
    p4:{name:"Holy Rosary",emoji:"📿",mins:20,on:true},
    p5:{name:"Evening Examen",emoji:"🕯️",mins:10,on:true},
    p6:{name:"Scripture / Lectio",emoji:"📖",mins:15,on:false},
  },
  confession:"14",
  household:[], marriageRhythm:"weekly",
  focuses:[],
  cdLabel:"", cdDate:"",
  modules:{meals:true,finance:true}
};
const LOB_STEPS = ["god","family","vocation","rest","done"];

function startLadder(name){
  LOB.step=0; LOB.name=name||"";
  $("gate").classList.add("hide"); document.body.classList.remove("gate");
  $("loading").classList.add("hide");
  $("ladder-ob").style.display="flex";
  renderLadder();
}
window.rerunLadder=()=>{
  LOB.step=0; LOB.name=S.profile?.name||"";
  const cur=(S.state.practices||[]);
  Object.keys(LOB.prayers).forEach(id=>{ LOB.prayers[id].on=cur.some(p=>p.id===id||p.name===LOB.prayers[id].name); });
  LOB.wake=S.state.wake||LOB.wake;
  const myConf=(S.state.confession||{})[S.user.uid]||{};
  if(myConf.cadence)LOB.confession=String(myConf.cadence);
  LOB.focuses=(S.state.focus||[]).map(f=>f.text);
  LOB.household=(S.state.famSections||[]).map(f=>f.name);
  LOB.cdLabel=S.house?.countdown?.label||""; LOB.cdDate=S.house?.countdown?.date||"";
  if(S.state.modules)LOB.modules={...LOB.modules,...S.state.modules};
  $("ladder-ob").style.display="flex";
  renderLadder();
};
function lobProgress(){ $("lob-bar").style.width = (LOB.step/(LOB_STEPS.length-1))*100 + "%"; }
function lobNext(){ if(LOB.step<LOB_STEPS.length-1){LOB.step++; renderLadder();} }
function lobBack(){ if(LOB.step>0){LOB.step--; renderLadder();} }
window.lobNext=lobNext; window.lobBack=lobBack;

function renderLadder(){
  lobProgress();
  const s=LOB_STEPS[LOB.step];
  const b=$("lob-body");
  if(s==="god") b.innerHTML=lobGod();
  else if(s==="family") b.innerHTML=lobFamily();
  else if(s==="vocation") b.innerHTML=lobVocation();
  else if(s==="rest") b.innerHTML=lobRest();
  else if(s==="done") b.innerHTML=lobDoneScreen();
  wireLadder(s);
}
function lobGod(){
  const rows=Object.entries(LOB.prayers).map(([id,p])=>`
    <button class="lob-choice ${p.on?"on":""}" data-prayer="${id}">
      <span class="lc-emoji">${p.emoji}</span>
      <span class="lc-body"><span class="lc-name">${p.name}</span><span class="lc-meta">${p.mins} min</span></span>
      <span class="lc-check"></span>
    </button>`).join("");
  return `
    ${LOB.step>0?'<button class="lob-back" onclick="lobBack()">‹</button>':''}
    <div class="lob-tier">First, God.</div>
    <div class="lob-h">The center of the day.</div>
    <div class="lob-sub">Everything else is ordered beneath this. Choose the prayers that will anchor your day — you can change any of it later.</div>
    <div class="lob-card">
      <label class="f">When does your day usually begin?</label>
      <input id="lob-wake" type="time" value="${LOB.wake}">
      <label class="f">Your daily prayers</label>
      <div class="lob-choices">${rows}</div>
      <label class="f">How often do you hope to go to confession?</label>
      <select id="lob-conf">
        <option value="7"${LOB.confession==="7"?" selected":""}>Weekly</option>
        <option value="14"${LOB.confession==="14"?" selected":""}>Every two weeks</option>
        <option value="30"${LOB.confession==="30"?" selected":""}>Monthly</option>
      </select>
    </div>
    <div class="lob-actions">
      <button class="lob-next" onclick="lobSaveGod()">Continue</button>
    </div>`;
}
function lobSaveGod(){
  LOB.wake=$("lob-wake").value||"07:00";
  LOB.confession=$("lob-conf").value;
  lobNext();
}
function lobFamily(){
  const chips=LOB.household.map((h,i)=>`<div class="lob-chip on" onclick="lobRmFam(${i})">${esc(h)} ✕</div>`).join("");
  return `
    <button class="lob-back" onclick="lobBack()">‹</button>
    <div class="lob-tier">Then, family.</div>
    <div class="lob-h">The ones nearest to you.</div>
    <div class="lob-sub">Those you're bound to in love and care come next. Add your spouse, children, or pets — whoever you tend to daily.</div>
    <div class="lob-card">
      <label class="f">Who is in your household?</label>
      <div class="lob-chips" id="lob-fam-chips">${chips||'<span style="opacity:.5;font-size:14px">None added yet</span>'}</div>
      <div class="lob-add-row">
        <input id="lob-fam-in" placeholder="e.g. Liz, or Gordie">
        <button onclick="lobAddFam()">+</button>
      </div>
      <label class="f">One rhythm for your marriage?</label>
      <div class="lob-chips" id="lob-marr">
        <div class="lob-chip ${LOB.marriageRhythm==="weekly"?"on":""}" data-marr="weekly">Weekly check-in</div>
        <div class="lob-chip ${LOB.marriageRhythm==="daily"?"on":""}" data-marr="daily">Daily words</div>
        <div class="lob-chip ${LOB.marriageRhythm==="monthly"?"on":""}" data-marr="monthly">Monthly sit-down</div>
      </div>
    </div>
    <div class="lob-actions">
      <button class="lob-next" onclick="lobNext()">Continue</button>
      <button class="lob-skip" onclick="lobNext()">Skip</button>
    </div>`;
}
function lobAddFam(){ const v=$("lob-fam-in").value.trim(); if(v){LOB.household.push(v); renderLadder();} }
window.lobRmFam=i=>{LOB.household.splice(i,1); renderLadder();};
function lobVocation(){
  const chips=LOB.focuses.map((f,i)=>`<div class="lob-chip on" onclick="lobRmFocus(${i})">${esc(f)} ✕</div>`).join("");
  return `
    <button class="lob-back" onclick="lobBack()">‹</button>
    <div class="lob-tier">Then, your vocation.</div>
    <div class="lob-h">The work you're given.</div>
    <div class="lob-sub">Not a rival to the first two — the means by which you serve them. What are you actually focused on right now?</div>
    <div class="lob-card">
      <label class="f">Your top focuses this season</label>
      <div class="lob-chips" id="lob-foc-chips">${chips||'<span style="opacity:.5;font-size:14px">None added yet</span>'}</div>
      <div class="lob-add-row">
        <input id="lob-foc-in" placeholder="e.g. Finish the pursuit app">
        <button onclick="lobAddFocus()">+</button>
      </div>
    </div>
    <div class="lob-actions">
      <button class="lob-next" onclick="lobNext()">Continue</button>
      <button class="lob-skip" onclick="lobNext()">Skip</button>
    </div>`;
}
function lobAddFocus(){ const v=$("lob-foc-in").value.trim(); if(v){LOB.focuses.push(v); renderLadder();} }
window.lobRmFocus=i=>{LOB.focuses.splice(i,1); renderLadder();};
function lobRest(){
  return `
    <button class="lob-back" onclick="lobBack()">‹</button>
    <div class="lob-tier">And everything else.</div>
    <div class="lob-h">The rest of life, in its place.</div>
    <div class="lob-sub">Good things, ordered last — not ignored, just kept from crowding out the first three.</div>
    <div class="lob-card">
      <label class="f">Anything you're counting toward?</label>
      <input id="lob-cd-label" placeholder="e.g. Ponte Vedra" value="${esc(LOB.cdLabel)}">
      <input id="lob-cd-date" type="date" value="${LOB.cdDate}" style="margin-top:8px">
      <label class="f">Which tools do you want on?</label>
      <div class="lob-choices">
        <button class="lob-choice ${LOB.modules.meals?"on":""}" data-mod="meals">
          <span class="lc-emoji">🍞</span><span class="lc-body"><span class="lc-name">Meals &amp; Groceries</span></span><span class="lc-check"></span>
        </button>
        <button class="lob-choice ${LOB.modules.finance?"on":""}" data-mod="finance">
          <span class="lc-emoji">🕊️</span><span class="lc-body"><span class="lc-name">Finances &amp; Tithing</span></span><span class="lc-check"></span>
        </button>
      </div>
    </div>
    <div class="lob-actions">
      <button class="lob-next" onclick="lobSaveRest()">Finish</button>
      <button class="lob-skip" onclick="lobSaveRest()">Skip</button>
    </div>`;
}
function lobSaveRest(){
  LOB.cdLabel=$("lob-cd-label").value.trim();
  LOB.cdDate=$("lob-cd-date").value;
  commitLadder();
  lobNext();
}
function lobDoneScreen(){
  return `
    <div class="lob-done-cross">✠</div>
    <div class="lob-h" style="text-align:center;margin-top:10px">Your house is ordered.</div>
    <div class="lob-sub" style="text-align:center">God, family, vocation, and the rest — each in its place. Everything here can be reshaped anytime.</div>
    <div class="lob-actions">
      <button class="lob-next" onclick="finishLadder()">Enter Vita Plena</button>
    </div>`;
}
function wireLadder(s){
  document.querySelectorAll("#lob-body [data-prayer]").forEach(el=>el.onclick=()=>{
    const id=el.dataset.prayer; LOB.prayers[id].on=!LOB.prayers[id].on; el.classList.toggle("on");
  });
  document.querySelectorAll("#lob-body [data-marr]").forEach(el=>el.onclick=()=>{
    LOB.marriageRhythm=el.dataset.marr;
    document.querySelectorAll("#lob-body [data-marr]").forEach(x=>x.classList.remove("on")); el.classList.add("on");
  });
  document.querySelectorAll("#lob-body [data-mod]").forEach(el=>el.onclick=()=>{
    const m=el.dataset.mod; LOB.modules[m]=!LOB.modules[m]; el.classList.toggle("on");
  });
  const famIn=$("lob-fam-in"); if(famIn) famIn.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();lobAddFam();}};
  const focIn=$("lob-foc-in"); if(focIn) focIn.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();lobAddFocus();}};
}
function commitLadder(){
  const wakeMin = (()=>{const [h,m]=LOB.wake.split(":").map(Number); return h*60+(m||0);})();
  const timeAt=(mins)=>{let t=wakeMin+mins; t=((t%1440)+1440)%1440; const h=String(Math.floor(t/60)).padStart(2,"0"), m=String(t%60).padStart(2,"0"); return h+":"+m;};
  const offsets={p1:0,p6:20,p2:60,p3:5*60,p4:12*60,p5:14*60};
  const chosen=Object.entries(LOB.prayers).filter(([id,p])=>p.on);
  const practices=chosen.map(([id,p],i)=>({
    id, name:p.name, emoji:p.emoji,
    time: id==="p1"?LOB.wake:timeAt(offsets[id]!=null?offsets[id]:(30+i*90)),
    mins:p.mins, days:[0,1,2,3,4,5,6]
  }));
  const focus=LOB.focuses.map(f=>({id:rid(),text:f}));
  const patch={
    practices: practices.length?practices:DEFAULT_PRACTICES,
    confession: { [S.user.uid]: { cadence: Number(LOB.confession) } },
    focus,
    modules: LOB.modules,
    wake: LOB.wake,
    marriageRhythm: LOB.marriageRhythm
  };
  if(LOB.cdLabel||LOB.cdDate){
    updateDoc(doc(db,"households",S.hid),{countdown:{label:LOB.cdLabel,date:LOB.cdDate}}).catch(()=>{});
  }
  if(LOB.household.length){
    patch.famSections = LOB.household.map(n=>({id:rid(),name:n,emoji:"💛",notes:[]}));
  }
  setDoc(doc(db,"households",S.hid,"state","main"),patch,{merge:true}).catch(e=>toast(e.message));
}
function finishLadder(){
  $("ladder-ob").style.display="none";
  if(appEntered){ renderAll(); window.go("home"); }
  else { attachHousehold(S.hid); }
}
window.lobSaveGod=lobSaveGod; window.lobAddFam=lobAddFam; window.lobAddFocus=lobAddFocus;
window.lobSaveRest=lobSaveRest; window.finishLadder=finishLadder;

/* ---------------- realtime listeners ---------------- */
function attachHousehold(hid){
  S.hid=hid;S.unsubs.forEach(u=>u());S.unsubs=[];
  S.unsubs.push(onSnapshot(doc(db,"households",hid),snap=>{
    if(!snap.exists())return;
    S.house=snap.data();S.profile=S.house.profiles?.[S.user.uid]||null;
    enterApp();renderAll();
  },e=>toast("Sync error: "+e.message)));
  S.unsubs.push(onSnapshot(doc(db,"households",hid,"state","main"),snap=>{
    S.state=snap.exists()?snap.data():{};renderAll();
  }));
  S.unsubs.push(onSnapshot(collection(db,"households",hid,"items"),snap=>{
    S.items=snap.docs.map(d=>({id:d.id,...d.data()}));renderAll();
  }));
}
let appEntered=false;
function enterApp(){
  if(appEntered)return;appEntered=true;
  $("gate").classList.add("hide");document.body.classList.remove("gate");
  $("loading").classList.add("hide");
  $("appheader").style.display="";$("app").style.display="";$("tabbar").style.display="";$("cmp-fab").style.display="";
}

/* ---------------- navigation / drawer / modal ---------------- */
window.go=p=>{
  document.querySelectorAll(".page").forEach(s=>s.classList.remove("on"));
  const el=$("page-"+p);if(el)el.classList.add("on");
  document.querySelectorAll("nav.tabbar button").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
  window.scrollTo({top:0});
};
document.querySelectorAll("nav.tabbar button").forEach(b=>{ b.onclick=()=>{window.go(b.dataset.p);}; });
window.openDrawer=()=>{$("drawer-scrim").classList.add("open");};
window.closeDrawer=()=>{$("drawer-scrim").classList.remove("open");};
window.openModal=html=>{$("modal-body").innerHTML=html;$("modal-scrim").classList.add("open");
  setTimeout(()=>{const f=$("modal-body").querySelector("input,textarea,select");if(f)f.focus();},80);};
window.closeModal=()=>{$("modal-scrim").classList.remove("open");$("modal-body").innerHTML="";};
window.confirmModal=(msg,fn)=>{
  window._confirmFn=fn;
  window.openModal(`<h3>Are you sure?</h3><p class="hint" style="font-size:15px;margin-top:4px">${esc(msg)}</p>
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" style="background:var(--terra)" onclick="window._confirmFn();closeModal()">Yes, do it</button></div>`);
};
document.querySelectorAll("#faith-tabs .pill").forEach(p=>{
  p.onclick=()=>{
    document.querySelectorAll("#faith-tabs .pill").forEach(x=>x.classList.remove("on"));p.classList.add("on");
    document.querySelectorAll(".ft").forEach(f=>f.style.display="none");
    $("ft-"+p.dataset.t).style.display="";
    if(p.dataset.t==="readings")loadReadings();
  };
});
$("conf-cadence").onchange=e=>saveField(`confession.${S.user.uid}.cadence`,+e.target.value);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){window.closeModal();window.closeDrawer();}});

/* enter-key wiring for simple add lines */
["focus-in","plan-in","grocery-in","sharedtodo-in"].forEach(id=>{
  $(id).addEventListener("keydown",e=>{if(e.key==="Enter"){({["focus-in"]:window.addFocus,["plan-in"]:window.addPlan,["grocery-in"]:window.addGrocery,["sharedtodo-in"]:window.addSharedTodo})[id]();}});
});
wireCalendarInputs();
wireUs();
wireMeals();
loadGis();
setInterval(()=>{if(S.house)renderHeader();},60*1000);
