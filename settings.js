/* VITA PLENA v4 — views/settings.js */
import { $, esc, S, db, setVal, profOf, toast } from "./data.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
 
export function renderSettings(){
  $("member-list").innerHTML=(S.house.members||[]).map(u=>{const p=profOf(u);return `<div class="member-row"><div class="big-av ${u===S.user.uid?"":"p2"}">${esc(p.initials)}</div><div class="grow"><div class="title">${esc(p.name)}${u===S.user.uid?" (you)":""}</div></div></div>`;}).join("");
  $("invite-code").textContent=S.house.code||"······";
  setVal("set-name",S.profile?.name);setVal("set-initials",S.profile?.initials);
  setVal("set-house",S.house.name);
  setVal("set-cd-label",S.house.countdown?.label);setVal("set-cd-date",S.house.countdown?.date);
  $("gcal-status").textContent=S.gcalConnected?"Connected on this device — events sync to your household.":"Not connected on this device.";
}
window.copyInvite=()=>{navigator.clipboard?.writeText(S.house.code||"").then(()=>toast("Code copied — text it to your spouse"));};
window.saveProfile=()=>{
  const name=$("set-name").value.trim(),ini=$("set-initials").value.trim().toUpperCase();
  if(!name||!ini)return toast("Name and initials required");
  updateDoc(doc(db,"households",S.hid),{["profiles."+S.user.uid]:{name,initials:ini}});
  setDoc(doc(db,"users",S.user.uid),{hid:S.hid,name,initials:ini});toast("Profile saved");
};
window.saveHouseSettings=()=>{
  updateDoc(doc(db,"households",S.hid),{name:$("set-house").value.trim()||S.house.name,
    countdown:{label:$("set-cd-label").value.trim(),date:$("set-cd-date").value}});
  toast("Household saved");
};
 
/* switch to spouse's household by invite code (fix for two separate houses) */
window.switchHousehold=async()=>{
  const code=$("switch-code").value.trim().toUpperCase();
  if(!code)return toast("Enter the invite code first");
  window.confirmModal("Join that household? You'll leave this one — anything added here stays behind.",async()=>{
    try{
      const inv=await getDoc(doc(db,"invites",code));
      if(!inv.exists())return toast("Code not found — double-check it");
      const hid=inv.data().hid;
      if(hid===S.hid)return toast("You're already in that household");
      const name=S.profile?.name||"Me",ini=S.profile?.initials||"··";
      await updateDoc(doc(db,"households",hid),{members:arrayUnion(S.user.uid),["profiles."+S.user.uid]:{name,initials:ini}});
      await setDoc(doc(db,"users",S.user.uid),{hid,name,initials:ini});
      toast("Joined — reloading…");
      setTimeout(()=>location.reload(),900);
    }catch(e){toast("Could not join: "+e.message);}
  });
};
