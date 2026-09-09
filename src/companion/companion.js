/* Vita Plena — Beacon, the companion.
   One function, two doors: the capture bar on Today (inline reply) and the full
   sheet (conversation). Every message carries a state snapshot; the server
   verifies the caller's ID token, calls Claude, and returns { say, actions }.
   Actions are applied here, directly to the household, and confirmed with chips. */
import { S, esc, rid, fmtT, todayS, ymd, addD, saveField, addItem, updItem, delItem, ensureSection, partnerName, profOf, db, auth } from "../core/data.js";
import { syncGcal } from "../lib/gcal.js";
import { doc, updateDoc } from "firebase/firestore";
import { $, A, ICON, openSheet, toast, haptic } from "../ui/dom.js";
import { renderAll } from "../app/shell.js";
import { who, assigneeOn, people, resolveName } from "../core/people.js";

export const BEACON_NAME="Beacon";
const ENDPOINT="/.netlify/functions/companion";
const SUGGEST=["Plan my day","What's on tomorrow?","Rosary at 8 tonight","Clear my afternoon","Add a task for Liz","Move dinner to 6"];

/* ---------------- state snapshot ---------------- */
function snapshot(){
  const now=new Date(), todayStr=todayS(), weekEnd=ymd(addD(now,14));
  const areaName=a=>a==="together"?"both":(profOf(a).name||"").toLowerCase()||"me";
  return {
    today:todayStr, dayOfWeek:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()],
    prettyDate:now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}),
    liturgicalDay:S.liturgy?.day||"",
    me:S.profile?.name||"", spouse:partnerName(),
    people:people().map(p=>p.name+(p.role?" ("+p.role+")":"")),
    choresThisWeek:S.items.filter(i=>i.kind==="task"&&Array.isArray(i.rotate)&&i.rotate.length>1).map(t=>({text:t.text,thisWeek:who(assigneeOn(t,todayStr)).name})),
    practices:(S.state.practices||[]).map(p=>({name:p.name,time:p.time,mins:p.mins,days:p.days})),
    todaysEvents:S.items.filter(i=>i.kind==="event"&&i.date===todayStr).map(e=>({title:e.title,time:e.time,endTime:e.endTime||"",owner:e.ownerName||""})),
    upcomingEvents:S.items.filter(i=>i.kind==="event"&&i.date>todayStr&&i.date<=weekEnd).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(e=>({title:e.title,date:e.date,time:e.time,endTime:e.endTime||"",owner:e.ownerName||""})),
    openTasks:S.items.filter(i=>i.kind==="task"&&!i.done).slice(0,30).map(t=>({text:t.text,assignee:who(assigneeOn(t,todayStr)).name.toLowerCase(),due:t.due||"",repeating:!!t.repeat})),
    confessionCadence:((S.state.confession||{})[S.user.uid]||{}).cadence||14,
    lastConfession:(()=>{const c=(S.state.confession||{})[S.user.uid]||{};const l=(c.log&&c.log.length?c.log:(c.last?[c.last]:[])).slice().sort();return l[l.length-1]||"";})(),
    focus:(S.state.focus||[]).filter(f=>!f.done).map(f=>f.text),
    marriageRhythm:S.state.marriageRhythm||"weekly", wake:S.state.wake||"07:00"
  };
}

/* ---------------- conversation ---------------- */
const log=[];      // {role:"user"|"bot", text, chips?}
let busy=false;

/** Send a message. Returns {say, chips} or null. Renders the sheet if open. */
A.beaconSend=async(text,{inline=false}={})=>{
  text=(text||"").trim(); if(!text||busy)return null;
  busy=true;
  log.push({role:"user",text}); renderSheetLog();
  const typing={role:"typing",text:"ordering the day…"}; log.push(typing); renderSheetLog();
  let result=null;
  try{
    const token=await auth.currentUser?.getIdToken().catch(()=>null);
    if(!token)throw {say:"You've been signed out. Sign in again and I'll pick this back up."};
    const history=log.filter(m=>m.role==="user"||m.role==="bot").slice(-12,-1).map(m=>({role:m.role==="user"?"user":"assistant",content:m.text}));
    const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({text,state:snapshot(),history})});
    if(!r.ok){
      const e=await r.json().catch(()=>({}));
      throw {say:r.status===401?"Your session has expired. Sign out and back in, then try again.":r.status===403?(e.error||"I'm not allowed to help with this account yet."):e.say||("I couldn't reach you just now. "+(e.error||"")+" Try again in a moment.")};
    }
    const data=await r.json();
    const chips=(data.actions&&data.actions.length)?apply(data.actions):[];
    if(chips.length){ haptic([15,40,15]); renderAll(); syncGcal().catch(()=>{}); }
    result={say:data.say||"",chips};
    speak(data.say);
  }catch(e){ result={say:e?.say||"Something went quiet on my end. Try again in a moment.",chips:[],error:true}; }
  const i=log.indexOf(typing); if(i>=0)log.splice(i,1);
  log.push({role:"bot",text:result.say,chips:result.chips});
  busy=false; renderSheetLog();
  return result;
};

A.openBeacon=()=>{
  openSheet(`<div class="beacon">
    <div class="b-head"><div class="iconbtn lit" style="width:34px;height:34px">${ICON.beacon}</div><div><div class="b-name">${BEACON_NAME}</div><div class="hint">Runs the house from plain English</div></div></div>
    <div class="b-log" id="b-log"></div>
    <div class="suggest">${SUGGEST.map(s=>`<span class="chip" onclick="A.beaconSuggest('${esc(s)}')">${esc(s)}</span>`).join("")}</div>
    <div class="b-in"><input id="b-in" placeholder="Tell ${BEACON_NAME}…" onkeydown="if(event.key==='Enter')A.beaconSubmit()" autocomplete="off"><button class="iconbtn ghost" id="b-mic" onclick="A.beaconMic('b-in','b-mic')" aria-label="Speak">${ICON.mic}</button><button class="iconbtn ghost" id="b-voice" onclick="A.beaconVoice()" title="${voiceOn?"Voice on":"Voice off"}">${voiceOn?"🔊":"🔇"}</button><button class="iconbtn lit" onclick="A.beaconSubmit()" aria-label="Send">${ICON.send}</button></div>
  </div>`,{cls:"full"});
  renderSheetLog(); setTimeout(()=>$("b-in")?.focus(),300);
};
A.beaconSubmit=()=>{ const inp=$("b-in"); if(!inp)return; const t=inp.value; inp.value=""; A.beaconSend(t); };
A.beaconSuggest=s=>A.beaconSend(s);
function renderSheetLog(){
  const el=$("b-log"); if(!el)return;
  el.innerHTML=log.length?log.map(m=>m.role==="typing"?`<div class="msg typing">${esc(m.text)}</div>`:`<div class="msg ${m.role}">${esc(m.text)}</div>${m.chips?.length?`<div class="msg-chips">${m.chips.map(c=>`<span class="chip ${c.terra?"warn":"lit"}">${esc(c.label)}</span>`).join("")}</div>`:""}`).join("")
    :`<div class="msg bot">I'm ${BEACON_NAME}. Tell me what's happening and I'll put it where it belongs: prayer first, then family, then work, then rest. Try "plan my day."</div>`;
  el.scrollTop=el.scrollHeight;
}

/* ---------------- the executor ---------------- */
function resolveArea(assignee){ return resolveName(assignee)||S.user.uid; }
function findTask(text){
  const q=(text||"").toLowerCase().trim(); if(!q)return null;
  const open=S.items.filter(i=>i.kind==="task");
  const exact=open.filter(t=>(t.text||"").toLowerCase().trim()===q); if(exact.length)return exact[0];
  const part=open.filter(t=>(t.text||"").toLowerCase().includes(q)||q.includes((t.text||"").toLowerCase()));
  return part.length===1?part[0]:(part[0]||null);
}
function apply(actions){
  const chips=[];
  actions.forEach(a=>{
    try{
      if(a.op==="create_practice"){
        saveField("practices",(S.state.practices||[]).concat([{id:rid(),name:a.name,emoji:a.emoji||"🙏",time:a.time||"07:00",mins:a.mins||10,days:Array.isArray(a.days)?a.days:[0,1,2,3,4,5,6]}]));
        chips.push({label:"✓ Practice · "+(a.name||"")});
      } else if(a.op==="edit_practice"){
        const nm=(a.name||"").toLowerCase(); let hit=null;
        const list=(S.state.practices||[]).map(p=>{const pn=(p.name||"").toLowerCase(); if(!hit&&(pn===nm||pn.includes(nm)||nm.includes(pn))){hit=p.name;return {...p,...(a.days?{days:a.days}:{}),...(a.time?{time:a.time}:{}),...(a.mins?{mins:a.mins}:{})};} return p;});
        saveField("practices",list); chips.push({label:hit?("✓ "+hit+" adjusted"):("— couldn't find "+(a.name||"that practice")),terra:!hit});
      } else if(a.op==="create_event"){
        addItem({kind:"event",title:a.title||"Event",date:a.date||todayS(),time:a.time||"",endTime:a.endTime||"",area:a.tier==="family"?"together":S.user.uid,tier:a.tier||"",source:"manual"});
        chips.push({label:"✓ Event · "+(a.title||"")+(a.time?" · "+fmtT(a.time):"")});
      } else if(a.op==="create_task"){
        const realArea=resolveArea(a.assignee||a.area);
        const sec=ensureSection(realArea,a.area&&a.area!==a.assignee?a.area:"");
        addItem({kind:"task",text:a.text||"Task",area:realArea,sectionId:sec.id,due:a.date||a.due||"",repeat:a.repeat||null,doneDates:{},done:false,tier:a.tier||""});
        chips.push({label:"✓ Task · "+(a.text||"")});
      } else if(a.op==="complete_task"){
        const t=findTask(a.text);
        if(t){ if(t.repeat){const dd={...(t.doneDates||{})};dd[todayS()]=true;updItem(t.id,{doneDates:dd});} else updItem(t.id,{done:true}); chips.push({label:"✓ Done · "+t.text}); }
        else chips.push({label:"— couldn't find that task",terra:true});
      } else if(a.op==="reschedule_task"){
        const t=findTask(a.text);
        if(t){ updItem(t.id,{due:a.date||todayS()}); chips.push({label:"✓ Moved · "+t.text+" → "+(a.date||"today")}); } else chips.push({label:"— couldn't find that task",terra:true});
      } else if(a.op==="protect_time"){
        addItem({kind:"event",title:a.label||"Protected time",date:a.date||todayS(),time:a.time||"",endTime:"",area:"together",protected:true,tier:a.tier||"family",mins:a.mins||null,source:"manual"});
        chips.push({label:"✓ Protected · "+(a.label||"")+(a.time?" · "+fmtT(a.time):"")});
      } else if(a.op==="set_confession_cadence"){
        saveField(`confession.${S.user.uid}.cadence`,Number(a.days)||14); chips.push({label:"✓ Confession every "+(Number(a.days)||14)+" days"});
      } else if(a.op==="set_focus"){
        saveField("focus",(S.state.focus||[]).concat([{id:rid(),text:a.text,done:false}])); chips.push({label:"✓ Focus · "+(a.text||"")});
      } else if(a.op==="set_countdown"){
        updateDoc(doc(db,"households",S.hid),{countdown:{label:a.label||"",date:a.date||""}}).catch(()=>{}); chips.push({label:"✓ Countdown · "+(a.label||"")});
      } else if(a.op==="clear_today"){
        const evs=S.items.filter(i=>i.kind==="event"&&i.date===todayS()); evs.forEach(i=>delItem(i.id));
        chips.push({label:"✓ Today cleared ("+evs.length+" event"+(evs.length===1?"":"s")+")",terra:true});
      } else if(a.op==="delete_event"){
        const title=(a.title||"").toLowerCase().trim();
        if(title){ const evs=S.items.filter(i=>i.kind==="event"); const exact=evs.filter(i=>(i.title||"").toLowerCase().trim()===title); const partial=evs.filter(i=>(i.title||"").toLowerCase().includes(title)); const targets=exact.length?exact:(partial.length===1?partial:[]); targets.forEach(i=>delItem(i.id)); chips.push({label:targets.length?("✓ Removed · "+(a.title||"")):"— couldn't find that event",terra:!targets.length}); }
      } else console.warn("Unknown companion op:",a.op,a);
    }catch(e){ console.warn("Companion action failed:",a,e); }
  });
  return chips;
}

/* ---------------- voice in / out ---------------- */
let recog=null, listening=false;
A.beaconMic=(inputId,btnId)=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return toast("Voice input isn't supported in this browser");
  if(listening){ try{recog.stop();}catch{ /* ignore */ } return; }
  recog=new SR(); recog.lang="en-US"; recog.interimResults=true; recog.continuous=false;
  const btn=$(btnId), inp=$(inputId);
  recog.onstart=()=>{ listening=true; btn?.classList.add("listening"); };
  recog.onend=()=>{ listening=false; btn?.classList.remove("listening"); };
  recog.onerror=()=>{ listening=false; btn?.classList.remove("listening"); };
  recog.onresult=e=>{ let t=""; for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript; if(inp)inp.value=t; };
  try{ recog.start(); }catch{ /* ignore */ }
};
let voiceOn=(localStorage.getItem("cmp-voice")==="1");
function speak(text){ if(!voiceOn||!text)return; try{ const u=new SpeechSynthesisUtterance(text.replace(/[✦✠🙏💛🕊️🔥🕯️]/g,"")); u.rate=0.96; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch{ /* ignore */ } }
A.beaconVoice=()=>{ voiceOn=!voiceOn; localStorage.setItem("cmp-voice",voiceOn?"1":"0"); const b=$("b-voice"); if(b)b.textContent=voiceOn?"🔊":"🔇"; if(voiceOn)speak("I'm here."); };
