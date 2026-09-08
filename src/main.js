/* Vita Plena — boot.
   Auth → household record → realtime listeners → shell. Screens register
   themselves on import. The service worker makes the shell installable and
   available offline; Firestore's own cache handles the data. */
import { auth, db, S } from "./core/data.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, collection } from "firebase/firestore";
import { initGate, showSignIn, showHouseholdSetup, hideGate } from "./app/gate.js";
import { startOnboarding } from "./app/onboarding.js";
import { mountShell, renderAll, applyLiturgy } from "./app/shell.js";
import { BELL } from "./core/bells.js";
import { loadGis } from "./lib/gcal.js";
import { isDemo, loadDemo } from "./app/demo.js";
import { $, A, closeModal, closeSheet, toast } from "./ui/dom.js";
import "./screens/today.js";
import "./screens/pray.js";
import "./screens/calendar.js";
import "./screens/tasks.js";
import "./screens/us.js";
import "./screens/more.js";
import "./companion/companion.js";

applyLiturgy();
loadGis();

/* ---------------- preview mode (?demo=1): a sample household, no sign-in ---------------- */
if(isDemo()){
  loadDemo();
  const params=new URLSearchParams(location.search);
  if(params.get("tab"))S.tab=params.get("tab");
  if(params.get("more")){ S.tab="more"; S.moreKind=params.get("more"); }
  if(params.get("view"))S.view=params.get("view");
  if(params.get("onboard")){ startOnboarding({name:"Mitch",onDone:()=>{ mountShell(); renderAll(); }}); }
  else { mountShell(); renderAll(); BELL.start(); }
}

/* ---------------- auth ---------------- */
initGate({
  onCreated:(hid,name)=>startOnboarding({name,onDone:()=>attachHousehold(hid)}),
  onJoined:(hid)=>attachHousehold(hid)
});

if(!isDemo())onAuthStateChanged(auth,async(user)=>{
  S.user=user;
  if(!user){ showSignIn(); return; }
  $("loading").classList.remove("hide");
  const snap=await getDoc(doc(db,"users",user.uid)).catch(()=>null);
  if(snap&&snap.exists()&&snap.data().hid)attachHousehold(snap.data().hid);
  else showHouseholdSetup(user);
});

/* ---------------- realtime ---------------- */
let attached=false;
export function attachHousehold(hid){
  S.hid=hid; S.unsubs.forEach(u=>u()); S.unsubs=[];
  S.unsubs.push(onSnapshot(doc(db,"households",hid),snap=>{
    if(!snap.exists())return;
    S.house=snap.data(); S.profile=S.house.profiles?.[S.user.uid]||null;
    if(!attached){ attached=true; hideGate(); mountShell(); BELL.start(); }
    renderAll();
  },e=>toast("Sync error: "+e.message)));
  S.unsubs.push(onSnapshot(doc(db,"households",hid,"state","main"),snap=>{ S.state=snap.exists()?snap.data():{}; renderAll(); }));
  S.unsubs.push(onSnapshot(collection(db,"households",hid,"items"),snap=>{ S.items=snap.docs.map(d=>({id:d.id,...d.data()})); renderAll(); }));
}

/* "Set up my rule again" from the menu re-runs onboarding over the existing household. */
A.rerunOnboarding=()=>{ closeSheet(); startOnboarding({name:S.profile?.name,existing:true,onDone:()=>renderAll()}); };

/* ---------------- housekeeping ---------------- */
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeModal(); closeSheet(); } });
// Re-render at midnight and when the app comes back to the foreground, so the date and liturgy stay right.
document.addEventListener("visibilitychange",()=>{ if(!document.hidden)renderAll(); });
setInterval(()=>{ const n=new Date(); if(n.getHours()===0&&n.getMinutes()===0)renderAll(); },60000);

if("serviceWorker" in navigator&&location.hostname!=="localhost"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}
