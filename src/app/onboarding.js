/* Vita Plena — first run: the rule of life in four steps.
   God (your prayers and when the day begins) → Family (who's in the house, and
   one rhythm for the marriage) → The bells (sound and permission) → Enter.
   Writes state/main with merge, so it also works as "set up my rule again". */
import { S, db, rid, esc, DEFAULT_PRACTICES } from "../core/data.js";
import { doc, setDoc } from "firebase/firestore";
import { $, A, ICON, toast } from "../ui/dom.js";
import { BELL } from "../core/bells.js";

const OB={
  step:0,name:"",wake:"07:00",
  prayers:{
    p1:{name:"Morning Offering",emoji:"🙏",mins:5,on:true,at:0},
    p6:{name:"Scripture / Lectio",emoji:"📖",mins:15,on:false,at:20},
    p2:{name:"Holy Mass",emoji:"✝️",mins:60,on:false,at:60},
    p3:{name:"Angelus",emoji:"🔔",mins:5,on:true,fixed:"12:00"},
    p7:{name:"Divine Mercy Chaplet",emoji:"🕊️",mins:10,on:false,fixed:"15:00"},
    p4:{name:"Holy Rosary",emoji:"📿",mins:20,on:true,at:12*60},
    p5:{name:"Evening Examen",emoji:"🕯️",mins:10,on:true,at:14.5*60}
  },
  confession:"14",household:[],marriageRhythm:"weekly",
  sound:"bell",permission:"default"
};
const STEPS=["god","family","bells","done"];
let onDone=()=>{};

export function startOnboarding({name,onDone:cb,existing=false}={}){
  onDone=cb||(()=>{});
  OB.step=0; OB.name=name||S.profile?.name||"";
  if(existing){
    const cur=S.state.practices||[];
    Object.keys(OB.prayers).forEach(id=>{ OB.prayers[id].on=cur.some(p=>p.id===id||p.name===OB.prayers[id].name); });
    OB.wake=S.state.wake||OB.wake;
    const c=(S.state.confession||{})[S.user.uid]||{}; if(c.cadence)OB.confession=String(c.cadence);
    OB.household=(S.state.famSections||[]).map(f=>f.name);
    OB.marriageRhythm=S.state.marriageRhythm||"weekly";
  }
  OB.sound=BELL.settings.sound;
  OB.permission=("Notification" in window)?Notification.permission:"unsupported";
  $("loading").classList.add("hide"); $("gate").classList.add("hide");
  $("onboard").classList.remove("hide");
  render();
}

function render(){
  const s=STEPS[OB.step];
  const prog=(OB.step/(STEPS.length-1))*100;
  const body={god,family,bells,done}[s]();
  $("onboard").innerHTML=`<div class="ob-inner"><div class="ob-prog"><i style="width:${prog}%"></i></div>${body}</div>`;
  $("onboard").scrollTop=0;
}
const back=()=>OB.step>0?`<button class="ob-back" onclick="A.obBack()">${ICON.back}</button>`:"";
A.obBack=()=>{ if(OB.step>0){OB.step--;render();} };
A.obNext=()=>{ if(OB.step<STEPS.length-1){OB.step++;render();} };

function god(){
  const rows=Object.entries(OB.prayers).map(([id,p])=>`
    <button class="choice ${p.on?"on":""}" onclick="A.obPrayer('${id}',this)">
      <span class="emoji">${p.emoji}</span>
      <span><div class="c-name">${p.name}</div><div class="c-meta">${p.mins} min${p.fixed?" · "+fmt(p.fixed):""}</div></span>
      <span class="c-check">${ICON.check}</span>
    </button>`).join("");
  return `${back()}
    <div class="ob-tier">First, God</div>
    <h1 class="ob-h">${OB.name?esc(OB.name)+", the":"The"} center of the day.</h1>
    <p class="ob-sub">Everything else is ordered beneath this. Choose the prayers that will anchor your day. The house will ring for each one.</p>
    <div class="card ob-card">
      <label class="f">When does your day begin?</label>
      <input id="ob-wake" type="time" value="${OB.wake}">
      <label class="f">Your daily prayers</label>
      ${rows}
      <label class="f">Confession</label>
      <select id="ob-conf">
        <option value="7"${OB.confession==="7"?" selected":""}>Weekly</option>
        <option value="14"${OB.confession==="14"?" selected":""}>Every two weeks</option>
        <option value="30"${OB.confession==="30"?" selected":""}>Monthly</option>
      </select>
    </div>
    <div class="ob-actions"><button class="btn block" onclick="A.obSaveGod()">Continue</button></div>`;
}
A.obPrayer=(id,el)=>{ OB.prayers[id].on=!OB.prayers[id].on; el.classList.toggle("on"); };
A.obSaveGod=()=>{ OB.wake=$("ob-wake").value||"07:00"; OB.confession=$("ob-conf").value; A.obNext(); };

function family(){
  const chips=OB.household.map((h,i)=>`<span class="chip lit" onclick="A.obRmFam(${i})">${esc(h)} ✕</span>`).join("");
  const marr=[["weekly","Weekly check-in"],["daily","Daily words"],["monthly","Monthly sit-down"]]
    .map(([v,l])=>`<button class="pill ${OB.marriageRhythm===v?"on":""}" onclick="A.obMarr('${v}')">${l}</button>`).join("");
  return `${back()}
    <div class="ob-tier">Then, family</div>
    <h1 class="ob-h">The ones nearest to you.</h1>
    <p class="ob-sub">Your spouse, children, pets. Whoever you tend to daily. They'll appear in the household, without needing accounts.</p>
    <div class="card ob-card">
      <label class="f">Who is in your household?</label>
      <div class="chips" id="ob-fam">${chips||'<span class="hint">Nobody added yet</span>'}</div>
      <div class="addline"><input id="ob-fam-in" placeholder="e.g. Liz, or Gordie" onkeydown="if(event.key==='Enter'){event.preventDefault();A.obAddFam()}"><button class="iconbtn" onclick="A.obAddFam()">${ICON.plus}</button></div>
      <label class="f">One rhythm for your marriage</label>
      <div class="pills">${marr}</div>
    </div>
    <div class="ob-actions"><button class="btn block" onclick="A.obNext()">Continue</button><button class="ob-skip" onclick="A.obNext()">Skip for now</button></div>`;
}
A.obAddFam=()=>{ const v=$("ob-fam-in").value.trim(); if(v){OB.household.push(v);render();} };
A.obRmFam=i=>{ OB.household.splice(i,1); render(); };
A.obMarr=v=>{ OB.marriageRhythm=v; render(); };

function bells(){
  const perm=OB.permission;
  const permLine=perm==="granted"?"Bells are allowed on this device.":perm==="denied"?"Notifications are blocked in your browser settings. The house will still ring while the app is open.":perm==="unsupported"?"This browser can't show notifications. The house will still ring while the app is open.":"";
  const sounds=[["bell","A church bell","Three strikes, the Angelus figure"],["chime","A soft chime","Gentler, for a small house"],["silent","Silent","The screen alone"]]
    .map(([v,l,m])=>`<button class="choice ${OB.sound===v?"on":""}" onclick="A.obSound('${v}')"><span class="emoji">${v==="bell"?"🔔":v==="chime"?"🎐":"🤫"}</span><span><div class="c-name">${l}</div><div class="c-meta">${m}</div></span><span class="c-check">${ICON.check}</span></button>`).join("");
  return `${back()}
    <div class="ob-tier">The house rings</div>
    <h1 class="ob-h">Nobody has to remember. The house does.</h1>
    <p class="ob-sub">At each prayer's hour the app rings and puts the words on the screen. A monastery keeps its hours by a bell. So can a home.</p>
    <div class="card ob-card">
      <label class="f">What does the bell sound like?</label>
      ${sounds}
      <button class="btn ghost sm" style="margin-top:12px" onclick="A.obTestBell()">Hear it</button>
      <label class="f">Permission</label>
      ${perm==="default"?`<button class="btn block outline" onclick="A.obAskPerm()">Allow bells on this device</button>`:`<div class="hint">${permLine}</div>`}
    </div>
    <div class="ob-actions"><button class="btn block" onclick="A.obSaveBells()">Continue</button></div>`;
}
A.obSound=v=>{ OB.sound=v; render(); };
A.obTestBell=()=>BELL.test(OB.sound);
A.obAskPerm=async()=>{ OB.permission=await BELL.requestPermission(); render(); };
A.obSaveBells=()=>{ BELL.settings={sound:OB.sound,on:true}; commit(); A.obNext(); };

function done(){
  return `<div style="text-align:center;padding-top:40px">
    <div class="cross" style="font-size:44px;color:var(--lit)">✠</div>
    <h1 class="ob-h" style="margin-top:14px">Your house is ordered.</h1>
    <p class="ob-sub" style="margin:12px auto 0">God, family, and the rest, each in its place. The house rings from today. Everything here can be reshaped anytime from the menu.</p>
    <div class="ob-actions" style="max-width:320px;margin:30px auto 0"><button class="btn block" onclick="A.obFinish()">Enter Vita Plena</button></div>
  </div>`;
}
A.obFinish=()=>{ $("onboard").classList.add("hide"); onDone(); };

function fmt(t){ const [h,m]=t.split(":").map(Number); return ((h%12)||12)+":"+String(m).padStart(2,"0")+(h>=12?" PM":" AM"); }

/** Write the rule to state/main. Practice times are offsets from the wake time,
    except the fixed hours (Angelus at noon, the Chaplet at three). */
function commit(){
  const [wh,wm]=OB.wake.split(":").map(Number); const wakeMin=wh*60+(wm||0);
  const timeAt=mins=>{ let t=((wakeMin+mins)%1440+1440)%1440; return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0"); };
  const chosen=Object.entries(OB.prayers).filter(([,p])=>p.on);
  const practices=chosen.map(([id,p])=>({id,name:p.name,emoji:p.emoji,time:p.fixed||timeAt(p.at||0),mins:p.mins,days:[0,1,2,3,4,5,6]}));
  const patch={
    practices:practices.length?practices:DEFAULT_PRACTICES,
    confession:{[S.user.uid]:{cadence:Number(OB.confession)}},
    wake:OB.wake,marriageRhythm:OB.marriageRhythm
  };
  if(OB.household.length)patch.famSections=OB.household.map(n=>({id:rid(),name:n,emoji:"💛",notes:[]}));
  setDoc(doc(db,"households",S.hid,"state","main"),patch,{merge:true}).catch(e=>toast(e.message));
}
