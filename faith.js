/* VITA PLENA v4 — companion.js — the AI front door.
   Chat UI + state snapshot + direct action executor with confirmation chips. */
import { $, esc, rid, fmtT, todayS, ymd, addD, S, saveField, addItem, updItem, delItem,
  ensureSection, partnerName, profOf, toast, bus } from "./data.js";
import { syncGcal } from "./gcal.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./data.js";

const CMP_ENDPOINT="/.netlify/functions/companion";

window.openCompanion=()=>{ $("cmp-sheet").style.display="block"; setTimeout(()=>$("cmp-in").focus(),300); };
window.closeCompanion=()=>{ $("cmp-sheet").style.display="none"; };
function cmpAdd(html,cls){ const l=$("cmp-log"); const d=document.createElement("div"); d.className="cmp-msg "+cls; d.innerHTML=html; l.appendChild(d); l.scrollTop=l.scrollHeight; return d; }

/* state snapshot sent with every message */
function cmpState(){
  const now=new Date();
  const dow=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];
  const weekEnd=ymd(addD(now,14));
  const todayStr=todayS();
  const areaName=a=>a==="together"?"both":(profOf(a).name||"").toLowerCase()||"me";
  return {
    today: todayStr,
    dayOfWeek: dow,
    prettyDate: now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}),
    me: S.profile?.name||"",
    spouse: partnerName(),
    practices: (S.state.practices||[]).map(p=>({name:p.name,time:p.time,mins:p.mins,days:p.days})),
    todaysEvents: S.items.filter(i=>i.kind==="event"&&i.date===todayStr)
      .map(e=>({title:e.title,time:e.time,endTime:e.endTime||"",owner:e.ownerName||""})),
    upcomingEvents: S.items.filter(i=>i.kind==="event"&&i.date>todayStr&&i.date<=weekEnd)
      .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))
      .map(e=>({title:e.title,date:e.date,time:e.time,endTime:e.endTime||"",owner:e.ownerName||""})),
    openTasks: S.items.filter(i=>i.kind==="task"&&!i.done&&(i.area===S.user.uid||i.area==="together")).slice(0,25)
      .map(t=>({text:t.text,assignee:areaName(t.area),due:t.due||"",repeating:!!t.repeat})),
    confessionCadence: ((S.state.confession||{})[S.user.uid]||{}).cadence||14,
    lastConfession: (()=>{const c=(S.state.confession||{})[S.user.uid]||{};const l=(c.log&&c.log.length?c.log:(c.last?[c.last]:[])).slice().sort();return l[l.length-1]||"";})(),
    focus: (S.state.focus||[]).filter(f=>!f.done).map(f=>f.text),
    marriageRhythm: S.state.marriageRhythm||"weekly",
    wake: S.state.wake||"07:00"
  };
}

let cmpHistory=[];
window.cmpSend=async()=>{
  const inp=$("cmp-in"); const text=inp.value.trim(); if(!text)return;
  inp.value=""; $("cmp-send").disabled=true;
  cmpAdd(esc(text),"cmp-user");
  cmpHistory.push({role:"user",content:text});
  if(cmpHistory.length>12) cmpHistory=cmpHistory.slice(-12);
  const typing=cmpAdd("ordering the day…","cmp-typing");
  try{
    const r=await fetch(CMP_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text,state:cmpState(),history:cmpHistory.slice(0,-1)})});
    typing.remove();
    if(!r.ok){ const e=await r.json().catch(()=>({})); cmpAdd("I couldn't reach you just now. "+(e.error||"")+" Try again in a moment.","cmp-bot"); $("cmp-send").disabled=false; return; }
    const data=await r.json();
    if(data.say){ cmpAdd(esc(data.say),"cmp-bot"); cmpSpeak(data.say); cmpHistory.push({role:"assistant",content:data.say}); }
    if(data.actions&&data.actions.length){
      const chips=cmpApply(data.actions);
      if(chips.length){
        const wrap=document.createElement("div"); wrap.className="cmp-chips";
        wrap.innerHTML=chips.map(c=>`<span class="cmp-chip ${c.terra?"terra":""}">${esc(c.label)}</span>`).join("");
        $("cmp-log").appendChild(wrap); $("cmp-log").scrollTop=$("cmp-log").scrollHeight;
      }
      cmpBuzz([15,40,15]);
      bus.render();
      syncGcal().catch(()=>{});
    }
  }catch(e){ typing.remove(); cmpAdd("Something went quiet on my end. Try again in a moment.","cmp-bot"); }
  $("cmp-send").disabled=false;
};

/* ---- the executor: apply actions directly, return confirmation chips ---- */
function resolveArea(assignee){
  const a=(assignee||"").toLowerCase().trim();
  if(!a||a==="me")return S.user.uid;
  if(a==="both"||a==="together"||a==="us")return "together";
  const members=S.house?.members||[];
  const hit=members.find(u=>(profOf(u).name||"").toLowerCase()===a||(profOf(u).name||"").toLowerCase().startsWith(a));
  return hit||S.user.uid;
}
function findTask(text){
  const q=(text||"").toLowerCase().trim(); if(!q)return null;
  const open=S.items.filter(i=>i.kind==="task");
  const exact=open.filter(t=>(t.text||"").toLowerCase().trim()===q);
  if(exact.length)return exact[0];
  const part=open.filter(t=>(t.text||"").toLowerCase().includes(q)||q.includes((t.text||"").toLowerCase()));
  return part.length===1?part[0]:(part[0]||null);
}
function cmpApply(actions){
  const chips=[];
  actions.forEach(a=>{
    try{
      if(a.op==="create_practice"){
        const list=(S.state.practices||[]).concat([{id:rid(),name:a.name,emoji:a.emoji||"🙏",time:a.time||"07:00",mins:a.mins||10,days:Array.isArray(a.days)?a.days:[0,1,2,3,4,5,6]}]);
        saveField("practices",list);
        chips.push({label:"✓ Practice added · "+(a.name||"")});
      } else if(a.op==="edit_practice"){
        const nm=(a.name||"").toLowerCase();
        let hit=null;
        const list=(S.state.practices||[]).map(p=>{
          const pn=(p.name||"").toLowerCase();
          if(!hit&&(pn===nm||pn.includes(nm)||nm.includes(pn))){
            hit=p.name;
            return {...p, ...(a.days?{days:a.days}:{}), ...(a.time?{time:a.time}:{}), ...(a.mins?{mins:a.mins}:{})};
          } return p;
        });
        saveField("practices",list);
        chips.push({label:hit?("✓ "+hit+" adjusted"):("— couldn't find "+(a.name||"that practice"))});
      } else if(a.op==="create_event"){
        addItem({kind:"event",title:a.title||"Event",date:a.date||todayS(),time:a.time||"",endTime:a.endTime||"",area:"together",tier:a.tier||""});
        chips.push({label:"✓ Event · "+(a.title||"")+(a.time?" · "+fmtT(a.time):"")});
      } else if(a.op==="create_task"){
        const area=resolveArea(a.assignee||a.area);
        const realArea=(area==="together"||S.house?.members?.includes(area))?area:S.user.uid;
        const sec=ensureSection(realArea,a.area&&a.area!==a.assignee?a.area:"");
        addItem({kind:"task",text:a.text||"Task",area:realArea,sectionId:sec.id,due:a.date||a.due||"",repeat:a.repeat||null,doneDates:{},done:false,tier:a.tier||""});
        chips.push({label:"✓ Task · "+(a.text||"")});
      } else if(a.op==="complete_task"){
        const t=findTask(a.text);
        if(t){
          if(t.repeat){const dd={...(t.doneDates||{})};dd[todayS()]=true;updItem(t.id,{doneDates:dd});}
          else updItem(t.id,{done:true});
          chips.push({label:"✓ Done · "+t.text});
        } else chips.push({label:"— couldn't find that task",terra:true});
      } else if(a.op==="reschedule_task"){
        const t=findTask(a.text);
        if(t){ updItem(t.id,{due:a.date||todayS()}); chips.push({label:"✓ Moved · "+t.text+" → "+(a.date||"today")}); }
        else chips.push({label:"— couldn't find that task",terra:true});
      } else if(a.op==="protect_time"){
        addItem({kind:"event",title:a.label||"Protected time",date:a.date||todayS(),time:a.time||"",endTime:"",area:"together",protected:true,tier:a.tier||"family",mins:a.mins||null});
        chips.push({label:"✓ Protected · "+(a.label||"")+(a.time?" · "+fmtT(a.time):"")});
      } else if(a.op==="set_confession_cadence"){
        saveField(`confession.${S.user.uid}.cadence`,Number(a.days)||14);
        chips.push({label:"✓ Confession every "+(Number(a.days)||14)+" days"});
      } else if(a.op==="set_focus"){
        saveField("focus",(S.state.focus||[]).concat([{id:rid(),text:a.text,done:false}]));
        chips.push({label:"✓ Focus · "+(a.text||"")});
      } else if(a.op==="set_countdown"){
        updateDoc(doc(db,"households",S.hid),{countdown:{label:a.label||"",date:a.date||""}}).catch(()=>{});
        chips.push({label:"✓ Countdown · "+(a.label||"")});
      } else if(a.op==="clear_today"){
        const t=todayS();
        const evs=S.items.filter(i=>i.kind==="event"&&i.date===t);
        evs.forEach(i=>delItem(i.id));
        chips.push({label:"✓ Today cleared ("+evs.length+" event"+(evs.length===1?"":"s")+")",terra:true});
      } else if(a.op==="delete_event"){
        const title=(a.title||"").toLowerCase().trim();
        if(title){
          const evs=S.items.filter(i=>i.kind==="event");
          const exact=evs.filter(i=>(i.title||"").toLowerCase().trim()===title);
          const partial=evs.filter(i=>(i.title||"").toLowerCase().includes(title));
          const targets = exact.length?exact : (partial.length===1?partial:[]);
          targets.forEach(i=>delItem(i.id));
          chips.push({label:targets.length?("✓ Removed · "+(a.title||"")):"— couldn't find that event",terra:true});
        }
      } else {
        console.warn("Unknown companion op:",a.op,a);
      }
    }catch(e){ console.warn("Companion action failed:",a,e); }
  });
  return chips;
}

/* voice input */
let cmpRecog=null, cmpListening=false;
window.cmpMic=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast("Voice input isn't supported on this browser"); return; }
  if(cmpListening){ try{cmpRecog.stop();}catch(e){} return; }
  cmpRecog=new SR(); cmpRecog.lang="en-US"; cmpRecog.interimResults=true; cmpRecog.continuous=false;
  const micBtn=$("cmp-mic"); const inp=$("cmp-in");
  cmpRecog.onstart=()=>{cmpListening=true; if(micBtn){micBtn.textContent="●"; micBtn.classList.add("listening");}};
  cmpRecog.onend=()=>{cmpListening=false; if(micBtn){micBtn.textContent="🎙"; micBtn.classList.remove("listening");}};
  cmpRecog.onerror=()=>{cmpListening=false; if(micBtn){micBtn.textContent="🎙"; micBtn.classList.remove("listening");}};
  cmpRecog.onresult=(e)=>{ let t=""; for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript; inp.value=t; };
  try{ cmpRecog.start(); }catch(e){}
};
/* haptics + voice out */
function cmpBuzz(pattern){ try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){} }
let cmpVoiceOn = (localStorage.getItem("cmp-voice")==="1");
function cmpSpeak(text){
  if(!cmpVoiceOn) return;
  try{
    const u=new SpeechSynthesisUtterance(text.replace(/[✦✠🙏💛🕊️🔥🕯️]/g,""));
    u.rate=0.96; u.pitch=1.0; speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}
window.cmpToggleVoice=()=>{ cmpVoiceOn=!cmpVoiceOn; localStorage.setItem("cmp-voice",cmpVoiceOn?"1":"0");
  const b=$("cmp-voice-btn"); if(b){b.textContent=cmpVoiceOn?"🔊":"🔇"; b.title=cmpVoiceOn?"Voice on":"Voice off";}
  if(cmpVoiceOn) cmpSpeak("I'm here."); };
