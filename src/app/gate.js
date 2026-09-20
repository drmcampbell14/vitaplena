/* Vita Plena — the front door: sign in, and set up or join a household.
   Email + password is the primary way in; Google is secondary. Both produce the
   same Firebase user. A user with no household record is sent to the household
   step, and from there either creates one (and continues to onboarding) or
   joins a spouse's with an invite code. */
import { auth, db, provider, S } from "../core/data.js";
import { callFn } from "../lib/api.js";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, OAuthProvider, signInWithCredential,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { $, A, esc, toast, initialsOf } from "../ui/dom.js";
import { isNative, platform, SITE } from "../lib/native.js";

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
  "auth/unauthorized-domain":"Google sign-in isn't set up for this address yet. Use email and password instead.",
  "auth/account-exists-with-different-credential":"That email is already registered another way. Try the other sign-in option."
};
const authMessage=e=>AUTH_MESSAGES[e?.code]||"Something went wrong. Try again in a moment.";

/* Sign in with Apple needs the Apple Developer account first (the provider in
   Firebase, a Services ID for the web). Until then the button stays off:
   build with VITE_APPLE_SIGNIN=1 to show it. See store/SUBMIT.md. */
const APPLE_ON=import.meta.env?.VITE_APPLE_SIGNIN==="1";
const APPLE_SERVICE_ID=import.meta.env?.VITE_APPLE_SERVICE_ID||"com.cognitivechristian.vitaplena.web";
const APPLE_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.365 12.79c-.02-2.24 1.83-3.31 1.91-3.36-1.04-1.52-2.66-1.73-3.24-1.76-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.92-.77-1.5.02-2.89.87-3.66 2.22-1.56 2.71-.4 6.72 1.12 8.92.74 1.08 1.63 2.29 2.79 2.25 1.12-.05 1.54-.72 2.9-.72 1.35 0 1.73.72 2.92.7 1.2-.02 1.96-1.09 2.7-2.17.85-1.25 1.2-2.46 1.22-2.52-.03-.01-2.34-.9-2.35-3.6zM14.1 6.2c.62-.75 1.03-1.79.92-2.83-.89.04-1.97.59-2.61 1.34-.57.66-1.08 1.72-.94 2.74.99.08 2.01-.5 2.63-1.25z"/></svg>';
/** Apple wants the SHA-256 of the nonce; Firebase wants the nonce itself. */
function randomNonce(){ const a=new Uint8Array(32); crypto.getRandomValues(a); return Array.from(a,b=>b.toString(16).padStart(2,"0")).join(""); }
async function sha256(s){ const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)); return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,"0")).join(""); }

const GOOGLE_SVG='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';

/** @type {{onCreated:(hid:string,name:string)=>void, onJoined:(hid:string)=>void}} */
let handlers={onCreated:()=>{},onJoined:()=>{}};
let mode="signin";

export function initGate(h){ handlers={...handlers,...h}; getRedirectResult(auth).catch(()=>{}); }

/* The sample household (app/demo.js) lives at ?demo=1; the sign-in page is the
   way back. Inside the store apps there is no address bar, so both are buttons. */
A.startDemo=()=>{ location.href="/?demo=1"; };
A.leaveDemo=()=>{ location.href="/"; };

export function showSignIn(){
  gateChrome();
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
    ${isNative()&&!(APPLE_ON&&platform()==="ios")?"":`<div class="or">or</div>`}
    ${APPLE_ON&&(!isNative()||platform()==="ios")?`<button class="gbtn" id="btn-apple">${APPLE_SVG} Continue with Apple</button>`:""}
    ${isNative()?"":`<button class="gbtn" id="btn-google">${GOOGLE_SVG} Continue with Google</button>`}
    <button class="mini" onclick="A.startDemo()">Look around first, with a sample household</button>
    <div class="verse">"Unless the Lord builds the house, those who build it labor in vain." — Psalm 127</div>`;
  setMode("signin");
  $("auth-toggle").onclick=()=>setMode(mode==="signin"?"signup":"signin");
  $("auth-form").onsubmit=onSubmit;
  $("auth-forgot").onclick=onForgot;
  if($("btn-google"))$("btn-google").onclick=onGoogle;
  if($("btn-apple"))$("btn-apple").onclick=onApple;
}
function setMode(m){
  mode=m;
  $("auth-submit").textContent=m==="signin"?"Sign in":"Create account";
  $("auth-toggle").textContent=m==="signin"?"New here? Create an account":"Already have an account? Sign in";
  $("auth-pass").setAttribute("autocomplete",m==="signin"?"current-password":"new-password");
  $("auth-err").textContent="";
}
function busy(b){ $("auth-submit").disabled=b; if($("btn-google"))$("btn-google").disabled=b; if($("btn-apple"))$("btn-apple").disabled=b; }
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

/** Sign in with Apple. On the phone the system sheet signs the nonce and Firebase
    checks it; on the web Firebase's own popup does the whole dance. */
async function onApple(){
  const err=$("auth-err"); err.textContent=""; busy(true);
  const provider=new OAuthProvider("apple.com"); provider.addScope("email"); provider.addScope("name");
  try{
    if(isNative()&&platform()==="ios"){
      const raw=randomNonce(), hashed=await sha256(raw);
      const { SignInWithApple }=await import("@capacitor-community/apple-sign-in");
      const r=await SignInWithApple.authorize({clientId:APPLE_SERVICE_ID,redirectURI:SITE+"/",scopes:"email name",nonce:hashed});
      const idToken=r?.response?.identityToken;
      if(!idToken)throw new Error("Apple didn't return a token.");
      await signInWithCredential(auth,provider.credential({idToken,rawNonce:raw}));
    } else {
      await signInWithPopup(auth,provider);
    }
  }catch(e){
    const cancelled=e?.code==="auth/popup-closed-by-user"||e?.code==="auth/cancelled-popup-request"||/cancel|1001/i.test(String(e?.message||e));
    if(!cancelled)err.textContent=AUTH_MESSAGES[e?.code]||("Apple sign-in didn't finish: "+String(e?.message||e));
  }finally{ busy(false); }
}

/* ---------------- household: create or join ---------------- */
export function showHouseholdSetup(user){
  gateChrome();
  $("loading").classList.add("hide");
  const g=$("gate"); g.classList.remove("hide");
  const first=user.displayName?user.displayName.split(" ")[0]:"";
  g.innerHTML=`
    <div class="cross">✠</div>
    <h1 style="font-size:30px">Welcome home.</h1>
    <div class="tag">Set up your household, or join your spouse's.</div>
    <div class="panel">
      <label class="f">Your name</label>
      <input id="ob-name" placeholder="Your first name" autocomplete="given-name" value="${esc(first)}">
      <label class="f">Your initials</label>
      <input id="ob-initials" placeholder="MC" maxlength="3" style="text-transform:uppercase" value="${esc(initialsOf(user.displayName||""))}">
      <label class="f">Household name</label>
      <input id="ob-house" placeholder="e.g. The Smith Household">
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
/* Creating a household is four linked writes — the household, its state, the
   invite code, the user's pointer record — and it used to do them one at a time
   from here. A failure partway left a household nobody was pointed at, reported
   as "Could not create household" even though one had just been made. It cannot
   be batched from the browser: the rules check membership by reading the
   household document, and a document written earlier in the same batch is not
   visible to that read, so the state and invite writes would be denied. The
   function does all four atomically with the Admin SDK instead. */
async function createHousehold(){
  const err=$("ob-err");
  const name=$("ob-name").value.trim(), ini=$("ob-initials").value.trim().toUpperCase();
  if(!name||!ini)return err.textContent="Add your name and initials first.";
  err.textContent="";
  $("btn-create").disabled=true;
  try{
    const { hid }=await callFn("household-admin",{op:"create_household",name,initials:ini,houseName:$("ob-house").value.trim()});
    S.hid=hid;
    handlers.onCreated(hid,name);
  }catch(e){
    err.textContent=e?.error||("Could not create household: "+(e?.message||e));
    $("btn-create").disabled=false;
  }
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

/** The sign-in screen is Marian navy; the browser chrome should be too, until the
    shell mounts and applyLiturgy() paints it the colour of the day. */
function gateChrome(){ const m=document.querySelector('meta[name="theme-color"]'); if(m)m.setAttribute("content","#16386A"); }
export function hideGate(){ $("gate").classList.add("hide"); }
A.signOut=()=>signOut(auth).then(()=>location.reload());
