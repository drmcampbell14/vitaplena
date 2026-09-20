/* Vita Plena — the bells.
   The house rings at the hours. While the app is open (a phone in a pocket, a
   tablet on the counter), each practice's time triggers a bell: a synthesized
   church bell or a soft chime, and a full-screen call to prayer with the text
   one tap away.

   Inside the iOS / Android app the phone rings on its own when the app is
   closed: the coming week's bells are scheduled as local notifications
   (bellSchedule.js plans them) and re-planned whenever anything changes.

   Settings are per device (localStorage): a tablet in the kitchen rings out
   loud, a phone at work stays quiet. The practices themselves are household
   data (state.practices) and already carry a time and weekdays. */
import { S, todayS, scheduledToday, doneSet } from "./data.js";
import { bellNotifications, inQuietHours } from "./bellSchedule.js";
import { isNative, platform } from "../lib/native.js";
import { LocalNotifications } from "@capacitor/local-notifications";

const KEY="vp-bells";
const DEFAULTS={on:true,sound:"bell",quietFrom:"22:00",quietTo:"06:00"};
const CHANNEL="bells";

export const BELL={
  get settings(){ try{ return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||"{}")}; }catch{ return {...DEFAULTS}; } },
  set settings(v){ try{ localStorage.setItem(KEY,JSON.stringify({...this.settings,...v})); }catch{ /* private mode */ } },

  /** "granted" | "denied" | "default" | "unsupported". Inside the app this is
      refreshed from the phone on start and after every request; on the web it
      is the browser's answer. */
  _perm:null,
  get permission(){
    if(isNative())return this._perm||"default";
    return ("Notification" in window)?Notification.permission:"unsupported";
  },

  /** Called once after the household is attached. Checks every 20s. */
  start(){
    if(this._timer)return;
    this._timer=setInterval(()=>this.tick(),20000);
    if(isNative())nativeSetup(this).finally(()=>this.tick()); else this.tick();
    // AudioContext can only start after a user gesture; unlock on the first tap.
    const unlock=()=>{ ensureAudio(); document.removeEventListener("pointerdown",unlock); };
    document.addEventListener("pointerdown",unlock);
  },

  tick(){
    if(isNative())this.plan();
    const st=this.settings; if(!st.on)return;
    const now=new Date();
    const hhmm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    if(inQuietHours(hhmm,st))return;
    const date=todayS();
    const dn=doneSet(date);
    for(const p of (S.state.practices||[])){
      if(!p.time||!scheduledToday(p,now))continue;
      if(p.time!==hhmm)continue;
      if(dn.has(p.id))continue;
      const rungKey="vp-rung-"+date+"-"+p.id;
      if(localStorage.getItem(rungKey))continue;
      try{ localStorage.setItem(rungKey,"1"); }catch{ /* ignore */ }
      this.ring(p);
      break;
    }
  },

  /** Ring for a practice: sound, overlay, and a system notification if the tab is hidden.
      (Inside the app the phone's own notification already fired; see plan().) */
  ring(p){
    const st=this.settings;
    if(st.sound!=="silent")playSound(st.sound);
    try{ navigator.vibrate&&navigator.vibrate([30,60,30]); }catch{ /* ignore */ }
    if(!isNative()&&document.hidden&&"Notification" in window&&Notification.permission==="granted"){
      try{ new Notification("Vita Plena · "+p.name,{body:"The house rings. It's time for "+p.name+".",tag:"bell-"+p.id,silent:st.sound==="silent"}); }catch{ /* ignore */ }
    }
    if(typeof window.A?.showBell==="function")window.A.showBell(p);
  },

  /** Preview the chosen sound from Settings. */
  test(sound){ ensureAudio(); playSound(sound||this.settings.sound); },

  async requestPermission(){
    if(isNative()){
      try{ const r=await LocalNotifications.requestPermissions(); this._perm=permWord(r.display); }
      catch{ this._perm="denied"; }
      this.plan(true);
      return this._perm;
    }
    if(!("Notification" in window))return "unsupported";
    if(Notification.permission==="granted")return "granted";
    try{ return await Notification.requestPermission(); }catch{ return "denied"; }
  },

  /** Inside the app: (re)schedule the coming week's bells as local notifications.
      Cheap to call often; it only talks to the phone when the plan changes. */
  _planned:"",
  plan(force=false){
    if(!isNative())return;
    const st=this.settings;
    const list=st.on&&this._perm==="granted"
      ? bellNotifications(S.state.practices||[],{quietFrom:st.quietFrom,quietTo:st.quietTo,done:doneSet(todayS())})
      : [];
    const sig=list.map(n=>n.id+":"+n.at.getTime()).join(",");
    if(!force&&sig===this._planned)return;
    this._planned=sig;
    replaceScheduled(list,st).catch(()=>{ this._planned=""; });
  }
};

/** Capacitor's "prompt" / "prompt-with-rationale" are the web's "default". */
function permWord(state){ return state==="granted"?"granted":state==="denied"?"denied":"default"; }

/** Inside the app: learn the permission state, make the Android channel, and open the
    bell overlay when a notification is tapped. */
async function nativeSetup(bell){
  try{ const r=await LocalNotifications.checkPermissions(); bell._perm=permWord(r.display); }catch{ bell._perm="denied"; }
  if(platform()==="android"){
    try{ await LocalNotifications.createChannel({id:CHANNEL,name:"The bells",description:"A bell at each hour of prayer",importance:4,visibility:1,vibration:true}); }catch{ /* exists */ }
  }
  try{
    await LocalNotifications.addListener("localNotificationActionPerformed",e=>{
      const pid=e?.notification?.extra?.practiceId;
      const p=(S.state.practices||[]).find(x=>x.id===pid);
      if(p&&typeof window.A?.showBell==="function")window.A.showBell(p);
    });
  }catch{ /* ignore */ }
}

/** Cancel every bell we scheduled before and schedule the new list. Ours are the
    pending notifications whose extra carries a practiceId. */
async function replaceScheduled(list,st){
  const pending=await LocalNotifications.getPending().catch(()=>({notifications:[]}));
  const ours=(pending.notifications||[]).filter(n=>n.extra&&n.extra.practiceId).map(n=>({id:n.id}));
  if(ours.length)await LocalNotifications.cancel({notifications:ours}).catch(()=>{});
  if(!list.length)return;
  await LocalNotifications.schedule({notifications:list.map(n=>({
    id:n.id, title:n.title, body:n.body,
    schedule:{at:n.at, allowWhileIdle:true},
    sound:st.sound==="silent"?undefined:"default",
    channelId:CHANNEL,
    extra:{practiceId:n.practiceId}
  }))});
}

/* ---------------- sound ----------------
   No audio files: the bell is synthesized. A church bell is a fundamental with
   inharmonic partials (the "hum", "prime", "tierce", "quint", "nominal") that
   decay at different rates; three strikes a second apart is the Angelus figure. */
let ctx=null;
function ensureAudio(){
  if(ctx)return ctx;
  try{ const AC=window.AudioContext||window.webkitAudioContext; ctx=new AC(); if(ctx.state==="suspended")ctx.resume(); }catch{ ctx=null; }
  return ctx;
}
function strike(t0,base,gain,dur){
  const partials=[[0.5,0.9,dur*1.6],[1,1,dur],[1.2,0.5,dur*0.7],[1.5,0.35,dur*0.55],[2,0.45,dur*0.5],[2.5,0.15,dur*0.35],[3,0.12,dur*0.3]];
  for(const [ratio,amp,d] of partials){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type="sine"; o.frequency.value=base*ratio;
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(gain*amp,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+d);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0+d+0.05);
  }
}
function playSound(kind){
  if(!ensureAudio())return;
  const t=ctx.currentTime+0.02;
  if(kind==="chime"){
    [[880,0],[1108.7,0.18],[1318.5,0.36]].forEach(([f,dt])=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type="sine"; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t+dt); g.gain.exponentialRampToValueAtTime(0.25,t+dt+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dt+1.4);
      o.connect(g); g.connect(ctx.destination); o.start(t+dt); o.stop(t+dt+1.5);
    });
    return;
  }
  // church bell: three strikes, the Angelus figure
  strike(t,220,0.35,3.2); strike(t+1.1,220,0.35,3.2); strike(t+2.2,220,0.35,4.0);
}
