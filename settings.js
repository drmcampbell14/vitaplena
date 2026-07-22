/* VITA PLENA v4 — views/settings.js */
import { $, esc, S, db, setVal, profOf, toast } from "./data.js";
import { doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
