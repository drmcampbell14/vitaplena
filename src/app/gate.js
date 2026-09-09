/* Vita Plena — the front door: sign in, and set up or join a household.
   Email + password is the primary way in; Google is secondary. Both produce the
   same Firebase user. A user with no household record is sent to the household
   step, and from there either creates one (and continues to onboarding) or
   joins a spouse's with an invite code. */
import { auth, db, provider, S, uid6, rid, DEFAULT_PRACTICES, DEFAULT_PLAN } from "../core/data.js";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, arrayUnion, serverTimestamp } from "firebase/firestore";
import { $, A, esc, toast, initialsOf } from "../ui/dom.js";

const AUTH_MESSAGES={
  "auth/invalid-email":"That doesn't look like an email address.",
  "auth/missing-email":"Enter your email.",
  "auth/missing-password":"Enter your password.",
  "auth/weak-password":"Use at least 8 characters.",
  "auth/email-already-in-use":"That email already has an account. Sign in instead.",
  "auth/user-not-found":"No account with that email. Create one below.",
  "auth/wrong-password":"That password isn't right.",
  "auth/invalid-credential":"Email or password isn't right. If you signed up with Google, use the Google button.",
  "auth/invalid-login-credentials":"Email or password isn't right. If you signed up with Google, use the Google button.",
  "auth/user-disabled":"This account has been disabled. Contact support.",
  "auth/too-many-requests":"Too many tries. Wait a minute, or reset your password.",
  "auth/operation-not-allowed":"Email sign-in isn't switched on for this app yet. Use Google for now.",
  "auth/network-request-failed":"No connection. Check your network and try again.",
  "auth/popup-closed-by-user":"The Google window was closed before finishing.",
  "auth/unauthorized-domain":"Google sign-in isn't set up for this address yet. Use email, or ask Mitch to authorize the domain.",
  "auth/account-exists-with-different-credential":"That email is already registered another way. Try the other sign-in option."
};
const authMessage=e=>AUTH_MESSAGES[e?.code]||"Something went wrong. Try again in a moment.";

const GOOGLE_SVG='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';

let handlers={onCreated:()=>{},onJoined:()=>{}};
let mode="signin";

export function initGate(h){ handlers={...handlers,...h}; getRedirectResult(auth).catch(()=>{}); }

export function showSignIn(){
  $("loading").classList.add("hide");
  const g=$("gate"); g.classList.remove("hide");
  g.innerHTML=`
    <div class="cross">✠</div>
    <h1>Vita <span>Plena</span></h1>
    <div class="tag">A shared rule of life for your household.</div>
    <form class="panel" id="auth-form" novalidate>
      <label class="f" for="auth-email">Email</label>
      <input id="auth-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com">
      <label class="f" for="auth-pass">Password</label>
      <input id="auth-pass" type="password" autocomplete="current-password" placeholder="At least 8 characters">
      <div class="auth-err" id="auth-err" role="alert" aria-live="polite"></div>
      <button class="btn gold block" id="auth-submit" type="submit">Sign in</button>
      <div class="auth-links">
        <button type="button" class="link" id="auth-toggle">New here? Create an account</button>
        <button type="button" class="link" id="auth-forgot">Forgot password?</button>
      </div>
    </form>
    <div class="or">or</div>
    <button class="gbtn" id="btn-google">${GOOGLE_SVG} Continue with Google</button>
    <div class="verse">"Unless the Lord builds the house, those who build it labor in vain." — Psalm 127</div>`;
  setMode("signin");
  $("auth-toggle").onclick=()=>setMode(mode==="signin"?"signup":"signin");
  $("auth-form").onsubmit=onSubmit;
  $("auth-forgot").onclick=onForgot;
  $("btn-google").onclick=onGoogle;
}
function setMode(m){
  mode=m;
  $("auth-submit").textContent=m==="signin"?"Sign in":"Create account";
  $("auth-toggle").textContent=m==="signin"?"New here? Create an account":"Already have an account? Sign in";
  $("auth-pass").setAttribute("autocomplete",m==="signin"?"current-password":"new-password");
  $("auth-err").textContent="";
}
function busy(b){ $("auth-submit").disabled=b; $("btn-google").disabled=b; }
async function onSubmit(ev){
  ev.preventDefault();
  const email=$("auth-email").value.trim(), pass=$("auth-pass").value, err=$("auth-err");
  err.textContent="";
  if(!email)return err.textContent=AUTH_MESSAGES["auth/missing-email"];
  if(!pass)return err.textContent=AUTH_MESSAGES["auth/missing-password"];
  if(mode==="signup"&&pass.length<8)return err.textContent=AUTH_MESSAGES["auth/weak-password"];
  busy(true);
  try{
    if(mode==="signup")await createUserWithEmailAndPassword(auth,email,pass);
    else await signInWithEmailAndPassword(auth,email,pass);
  }catch(e){
    err.textContent=authMessage(e);
    if(mode==="signin"&&e?.code==="auth/user-not-found"){ setMode("signup"); err.textContent=AUTH_MESSAGES["auth/user-not-found"]; }
  }finally{ busy(false); }
}
async function onForgot(){
  const email=$("auth-email").value.trim(), err=$("auth-err");
  if(!email)return err.textContent="Enter your email above first, then tap Forgot password.";
  busy(true);
  try{ await sendPasswordResetEmail(auth,email); err.textContent="If "+email+" has a Vita Plena password, a reset link is on its way. Check spam too."; }
  catch(e){ err.textContent=authMessage(e); }
  finally{ busy(false); }
}
async function onGoogle(){
  const err=$("auth-err"); err.textContent="";
  try{ await signInWithPopup(auth,provider); }
  catch(e){
    if(e.code==="auth/popup-blocked"||e.code==="auth/cancelled-popup-request"){
      try{ await signInWithRedirect(auth,provider); }catch(e2){ err.textContent=authMessage(e2); }
    } else err.textContent=authMessage(e);
  }
}

/* ---------------- household: create or join ---------------- */
export function showHouseholdSetup(user){
  $("loading").classList.add("hide");
  const g=$("gate"); g.classList.remove("hide");
  const first=user.displayName?user.displayName.split(" ")[0]:"";
  g.innerHTML=`
    <div class="cross">✠</div>
    <h1 style="font-size:30px">Welcome home.</h1>
    <div class="tag">Set up your household, or join your spouse's.</div>
    <div class="panel">
      <label class="f">Your name</label>
      <input id="ob-name" placeholder="Mitch" autocomplete="given-name" value="${esc(first)}">
      <label class="f">Your initials</label>
      <input id="ob-initials" placeholder="MC" maxlength="3" style="text-transform:uppercase" value="${esc(initialsOf(user.displayName||""))}">
      <label class="f">Household name</label>
      <input id="ob-house" placeholder="The Campbell Household">
      <button class="btn gold block" id="btn-create" style="margin-top:16px">Create our household</button>
      <div class="or" style="max-width:none">or join with a code</div>
      <input id="ob-code" placeholder="Invite code from your spouse" style="text-transform:uppercase;letter-spacing:.2em;text-align:center">
      <button class="btn block" id="btn-join" style="margin-top:10px;background:rgba(245,240,230,.14);border:1px solid rgba(245,240,230,.3);color:#F3EEE4">Join household</button>
      <div class="auth-err" id="ob-err" role="alert"></div>
    </div>
    <button class="mini" onclick="A.signOut()">Sign out</button>`;
  $("btn-create").onclick=createHousehold;
  $("btn-join").onclick=joinHousehold;
}
async function createHousehold(){
  const name=$("ob-name").value.trim(), ini=$("ob-initials").value.trim().toUpperCase(), err=$("ob-err");
  if(!name||!ini)return err.textContent="Add your name and initials first.";
  const hname=$("ob-house").value.trim()||name+"'s Household";
  const code=uid6();
  $("btn-create").disabled=true;
  try{
    const trialEnds=new Date(); trialEnds.setDate(trialEnds.getDate()+30);
    const href=await addDoc(collection(db,"households"),{
      name:hname,code,owner:S.user.uid,members:[S.user.uid],profiles:{[S.user.uid]:{name,initials:ini}},
      subscription:{status:"trial",plan:"family",source:"none",trialEndsAt:trialEnds.toISOString().slice(0,10)},
      countdown:{label:"",date:""},createdAt:serverTimestamp()});
    await setDoc(doc(db,"invites",code),{hid:href.id});
    await setDoc(doc(db,"households",href.id,"state","main"),{
      practices:DEFAULT_PRACTICES,plan:DEFAULT_PLAN,rhythmDone:{},
      taskSections:{[S.user.uid]:[{id:rid(),name:"Career & Goals",emoji:"🎯"}],
        together:[{id:rid(),name:"Household",emoji:"🏡"},{id:rid(),name:"Faith",emoji:"✝️"},{id:rid(),name:"Health",emoji:"💪"}]},
      meals:{},grocery:[],budget:{income:[],expense:[],savings:[]},funds:[],debts:[],
      focus:[],countdowns:[],books:[],virtue:{},confession:{},people:[],modules:{meals:false,finance:false,family:false,notes:false}});
    await setDoc(doc(db,"users",S.user.uid),{hid:href.id,name,initials:ini});
    S.hid=href.id;
    handlers.onCreated(href.id,name);
  }catch(e){ err.textContent="Could not create household: "+(e.message||e); $("btn-create").disabled=false; }
}
async function joinHousehold(){
  const name=$("ob-name").value.trim(), ini=$("ob-initials").value.trim().toUpperCase(), err=$("ob-err");
  const code=$("ob-code").value.trim().toUpperCase();
  if(!name||!ini)return err.textContent="Add your name and initials first.";
  if(!code)return err.textContent="Enter the invite code.";
  $("btn-join").disabled=true;
  try{
    const inv=await getDoc(doc(db,"invites",code));
    if(!inv.exists()){ err.textContent="Code not found. Check with your spouse."; $("btn-join").disabled=false; return; }
    const hid=inv.data().hid;
    await updateDoc(doc(db,"households",hid),{members:arrayUnion(S.user.uid),["profiles."+S.user.uid]:{name,initials:ini}});
    await setDoc(doc(db,"users",S.user.uid),{hid,name,initials:ini});
    handlers.onJoined(hid);
  }catch(e){ err.textContent="Could not join: "+(e.message||e); $("btn-join").disabled=false; }
}

export function hideGate(){ $("gate").classList.add("hide"); }
A.signOut=()=>signOut(auth).then(()=>location.reload());
