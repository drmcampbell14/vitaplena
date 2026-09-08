/* Vita Plena — the bells.
   The house rings at the hours. While the app is open (a phone in a pocket, a
   tablet on the counter), each practice's time triggers a bell: a synthesized
   church bell or a soft chime, and a full-screen call to prayer with the text
   one tap away. Push delivery when the app is closed is Phase 3 (FCM).

   Settings are per device (localStorage): a tablet in the kitchen rings out
   loud, a phone at work stays quiet. The practices themselves are household
   data (state.practices) and already carry a time and weekdays. */
import { S, todayS, scheduledToday, doneSet } from "./data.js";

const KEY="vp-bells";
const DEFAULTS={on:true,sound:"bell",quietFrom:"22:00",quietTo:"06:00"};

export const BELL={
  get settings(){ try{ return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||"{}")}; }catch{ return {...DEFAULTS}; } },
  set settings(v){ try{ localStorage.setItem(KEY,JSON.stringify({...this.settings,...v})); }catch{ /* private mode */ } },

  /** Called once after the household is attached. Checks every 20s. */
  start(){
    if(this._timer)return;
    this._timer=setInterval(()=>this.tick(),20000);
    this.tick();
    // AudioContext can only start after a user gesture; unlock on the first tap.
    const unlock=()=>{ ensureAudio(); document.removeEventListener("pointerdown",unlock); };
    document.addEventListener("pointerdown",unlock);
  },

  tick(){
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

  /** Ring for a practice: sound, overlay, and a system notification if the tab is hidden. */
  ring(p){
    const st=this.settings;
    if(st.sound!=="silent")playSound(st.sound);
    try{ navigator.vibrate&&navigator.vibrate([30,60,30]); }catch{ /* ignore */ }
    if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){
      try{ new Notification("Vita Plena · "+p.name,{body:"The house rings. It's time for "+p.name+".",tag:"bell-"+p.id,silent:st.sound==="silent"}); }catch{ /* ignore */ }
    }
    if(typeof window.A?.showBell==="function")window.A.showBell(p);
  },

  /** Preview the chosen sound from Settings. */
  test(sound){ ensureAudio(); playSound(sound||this.settings.sound); },

  async requestPermission(){
    if(!("Notification" in window))return "unsupported";
    if(Notification.permission==="granted")return "granted";
    try{ return await Notification.requestPermission(); }catch{ return "denied"; }
  }
};

function inQuietHours(hhmm,st){
  const from=st.quietFrom||"22:00", to=st.quietTo||"06:00";
  if(from===to)return false;
  return from<to ? (hhmm>=from&&hhmm<to) : (hhmm>=from||hhmm<to);
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
