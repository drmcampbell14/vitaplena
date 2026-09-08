/* Vita Plena — the menu, Settings, and the "More" modules (Meals, Finances,
   Family, Notes). Modules are off by default for new households and switched on
   in Settings; existing households keep whatever they had. */
import { S, db, esc, rid, money, todayS, saveKey, saveField, addItem, updItem, delItem, isMine, profOf, debounce } from "../core/data.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { $, A, ICON, openModal, closeModal, confirmModal, openSheet, closeSheet, toast } from "../ui/dom.js";
import { registerScreen, go, renderAll } from "../app/shell.js";
import { BELL } from "../core/bells.js";

S.moreKind=S.moreKind||"settings";
const MODULES=[["meals","Meals & groceries","🍞"],["finance","Finances & tithing","🕊️"],["family","Family & pets","🐾"],["notes","Notes","📝"]];
const modOn=k=>{ const m=S.state.modules; return m?!!m[k]:false; };

A.openMenu=()=>{
  const rows=[
    ["settings","Settings","Profile, household, bells, calendar"],
    ...MODULES.filter(([k])=>modOn(k)).map(([k,l])=>[k,l,""]),
  ];
  openSheet(`<div class="reader menu-list" style="padding-bottom:20px"><div class="r-title" style="font-size:28px">${esc(S.house?.name||"Household")}</div>
    <div style="margin-top:10px">${rows.map(([k,l,s])=>`<div class="row" style="cursor:pointer" onclick="A.openMore('${k}')"><div class="grow"><div class="title">${esc(l)}</div>${s?`<div class="sub">${esc(s)}</div>`:""}</div>${ICON.chevron.replace('<svg','<svg style="width:18px;height:18px;color:var(--faint)"')}</div>`).join("")}
    <div class="row" style="cursor:pointer" onclick="A.rerunOnboarding()"><div class="grow"><div class="title">Set up my rule again</div><div class="sub">Prayers, hours, the bells</div></div></div>
    <div class="row" style="cursor:pointer" onclick="A.installHelp()"><div class="grow"><div class="title">Put Vita Plena on your phone</div><div class="sub">Home screen, full screen, works offline</div></div></div>
    <div class="row" style="cursor:pointer" onclick="A.signOut()"><div class="grow"><div class="title" style="color:var(--warn)">Sign out</div></div></div>
    </div></div>`);
};
A.openMore=k=>{ closeSheet(); S.moreKind=k; go("more"); };
A.installHelp=()=>openSheet(`<div class="reader"><div class="eyebrow lit">Install</div><div class="r-title" style="font-size:30px">On your phone</div>
  <div class="r-body" style="font-family:var(--sans);font-size:16px"><p style="font-family:var(--sans);font-size:16px"><b>iPhone.</b> Open this page in Safari. Tap the Share button (the square with the arrow). Scroll and tap <b>Add to Home Screen</b>. Tap Add.</p>
  <p style="font-family:var(--sans);font-size:16px"><b>Android.</b> Open in Chrome. Tap the three dots, then <b>Add to Home screen</b> or <b>Install app</b>.</p>
  <p style="font-family:var(--sans);font-size:16px"><b>A tablet on the counter.</b> Same steps. Then open it, leave it on, and the house rings from there.</p></div></div>`);

function render(){
  const k=S.moreKind;
  const seg=`<div class="seg" style="margin-bottom:14px;grid-auto-columns:auto;overflow-x:auto"><button class="${k==="settings"?"on":""}" onclick="A.openMore('settings')">Settings</button>${MODULES.filter(([m])=>modOn(m)).map(([m,l,e])=>`<button class="${k===m?"on":""}" onclick="A.openMore('${m}')">${e}</button>`).join("")}</div>`;
  const body=k==="meals"?meals():k==="finance"?finance():k==="family"?family():k==="notes"?notes():settings();
  $("page-more").innerHTML=seg+body;
}

/* ---------------- settings ---------------- */
function settings(){
  const st=BELL.settings;
  const perm=("Notification" in window)?Notification.permission:"unsupported";
  return `
    <div class="card"><div class="sec-row"><h2 class="sec">You</h2></div>
      <label class="f">Name</label><input id="set-name" value="${esc(S.profile?.name||"")}">
      <label class="f">Initials</label><input id="set-initials" value="${esc(S.profile?.initials||"")}" maxlength="3" style="text-transform:uppercase">
      <div class="actions"><button class="btn" onclick="A.saveProfile()">Save</button></div></div>
    <div class="card"><div class="sec-row"><h2 class="sec">The bells</h2></div>
      <div class="kv"><div class="k">Ring on this device<small>At each practice's hour, while the app is open</small></div><button class="switch ${st.on?"on":""}" onclick="A.bellSet('on',${!st.on})"></button></div>
      <label class="f">Sound</label><div class="pills">${[["bell","Church bell"],["chime","Soft chime"],["silent","Silent"]].map(([v,l])=>`<button class="pill ${st.sound===v?"on":""}" onclick="A.bellSet('sound','${v}')">${l}</button>`).join("")}<button class="pill" onclick="A.bellTest()">▶ Hear it</button></div>
      <div class="two" style="margin-top:12px"><div><label class="f">Quiet from</label><input type="time" value="${st.quietFrom}" onchange="A.bellSet('quietFrom',this.value)"></div><div><label class="f">Until</label><input type="time" value="${st.quietTo}" onchange="A.bellSet('quietTo',this.value)"></div></div>
      <div class="kv" style="margin-top:8px"><div class="k">Notifications<small>${perm==="granted"?"Allowed. The bell can reach you when the app is in the background.":perm==="denied"?"Blocked in browser settings.":perm==="unsupported"?"Not supported in this browser.":"Not asked yet."}</small></div>${perm==="default"?`<button class="btn sm" onclick="A.bellPerm()">Allow</button>`:""}</div>
    </div>
    <div class="card"><div class="sec-row"><h2 class="sec">Household</h2></div>
      <label class="f">Name</label><input id="set-house" value="${esc(S.house.name||"")}">
      <div class="actions"><button class="btn" onclick="A.saveHouse()">Save</button></div>
      <label class="f">Invite code</label>
      <div style="display:flex;align-items:center;gap:12px"><div class="code">${esc(S.house.code||"······")}</div><button class="btn ghost sm" onclick="A.copyInvite()">Copy</button></div>
      <div class="hint" style="margin-top:6px">Text it to your spouse. They tap Join household and enter it.</div>
      <label class="f">Members</label>
      ${(S.house.members||[]).map(u=>{const p=profOf(u);return `<div class="member-row"><div class="big-av">${esc(p.initials)}</div><div class="grow title">${esc(p.name)}${u===S.user.uid?" (you)":""}</div></div>`;}).join("")}
      ${(S.state.famSections||[]).length?`<label class="f">People</label><div class="chips">${(S.state.famSections||[]).map(f=>`<span class="chip">${esc(f.name)}</span>`).join("")}</div>`:""}
    </div>
    <div class="card"><div class="sec-row"><h2 class="sec">Google Calendar</h2></div>
      <div class="hint">${S.gcalConnected?"Connected on this device. Events sync into the household.":"Not connected on this device."}</div>
      <div class="actions"><button class="btn" onclick="connectGcal()">${S.gcalConnected?"Sync now":"Connect"}</button></div>
    </div>
    <div class="card"><div class="sec-row"><h2 class="sec">More tools</h2></div>
      ${MODULES.map(([k,l,e])=>`<div class="kv"><div class="k">${e} ${l}</div><button class="switch ${modOn(k)?"on":""}" onclick="A.toggleModule('${k}',${!modOn(k)})"></button></div>`).join("")}
    </div>
    <div class="card"><div class="sec-row"><h2 class="sec">Join another household</h2></div>
      <div class="hint">If you and your spouse ended up with two houses, enter theirs here. Anything added here stays behind.</div>
      <div class="addline"><input id="switch-code" placeholder="Invite code" style="text-transform:uppercase;letter-spacing:.15em"><button class="btn sm" onclick="A.switchHousehold()">Join</button></div>
    </div>
    <div class="hint" style="text-align:center;margin:20px 0">Vita Plena v5 · Cognitive Christian</div>`;
}
A.saveProfile=()=>{ const name=$("set-name").value.trim(), ini=$("set-initials").value.trim().toUpperCase(); if(!name||!ini)return toast("Name and initials, please"); updateDoc(doc(db,"households",S.hid),{["profiles."+S.user.uid]:{name,initials:ini}}); setDoc(doc(db,"users",S.user.uid),{hid:S.hid,name,initials:ini}); toast("Saved"); };
A.saveHouse=()=>{ updateDoc(doc(db,"households",S.hid),{name:$("set-house").value.trim()||S.house.name}); toast("Saved"); };
A.copyInvite=()=>{ navigator.clipboard?.writeText(S.house.code||"").then(()=>toast("Code copied")); };
A.toggleModule=(k,v)=>saveField("modules."+k,v);
A.bellSet=(k,v)=>{ BELL.settings={[k]:v}; render(); };
A.bellTest=()=>BELL.test();
A.bellPerm=async()=>{ await BELL.requestPermission(); render(); };
A.switchHousehold=async()=>{
  const code=$("switch-code").value.trim().toUpperCase(); if(!code)return toast("Enter the invite code");
  confirmModal("Join that household? You'll leave this one.",async()=>{
    try{ const inv=await getDoc(doc(db,"invites",code)); if(!inv.exists())return toast("Code not found");
      const hid=inv.data().hid; if(hid===S.hid)return toast("You're already in that household");
      const name=S.profile?.name||"Me", ini=S.profile?.initials||"··";
      await updateDoc(doc(db,"households",hid),{members:arrayUnion(S.user.uid),["profiles."+S.user.uid]:{name,initials:ini}});
      await setDoc(doc(db,"users",S.user.uid),{hid,name,initials:ini}); toast("Joined. Reloading…"); setTimeout(()=>location.reload(),900);
    }catch(e){ toast("Could not join: "+e.message); }
  },{danger:false,yes:"Join"});
};

/* ---------------- meals ---------------- */
function meals(){
  const m=(S.state.meals||{})[S.mealDay]||{};
  return `<div class="card"><div class="sec-row"><h2 class="sec">Meals</h2><button class="link" onclick="A.clearWeekMeals()">Clear week</button></div>
    <div class="daytabs">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=>`<button class="${S.mealDay===i?"on":""}" onclick="A.setMealDay(${i})">${d}</button>`).join("")}</div>
    <label class="f">Breakfast</label><input class="meal-in" data-k="b" value="${esc(m.b||"")}" placeholder="What's for breakfast?" oninput="A.mealInput()">
    <label class="f">Lunch</label><input class="meal-in" data-k="l" value="${esc(m.l||"")}" placeholder="What's for lunch?" oninput="A.mealInput()">
    <label class="f">Dinner</label><input class="meal-in" data-k="d" value="${esc(m.d||"")}" placeholder="What's for dinner?" oninput="A.mealInput()">
    ${S.mealDay===4?'<div class="hint" style="margin-top:10px">🐟 Friday, a day of penance. A meatless meal.</div>':""}</div>
    <div class="card"><div class="sec-row"><h2 class="sec">Groceries</h2><button class="link" onclick="A.clearDoneGroceries()">Clear done</button></div>
    ${(S.state.grocery||[]).map(g=>`<div class="row"><button class="chk ${g.done?"on":""}" onclick="A.toggleGrocery('${g.id}')">${ICON.check}</button><div class="grow title ${g.done?"done-text":""}">${esc(g.text)}</div><button class="x" onclick="A.rmGrocery('${g.id}')">×</button></div>`).join("")||'<div class="empty">Nothing on the list.</div>'}
    <div class="addline"><input id="grocery-in" placeholder="Add item" onkeydown="if(event.key==='Enter')A.addGrocery()"><button class="iconbtn" onclick="A.addGrocery()">${ICON.plus}</button></div></div>`;
}
const saveMeal=debounce(()=>{ const next={}; document.querySelectorAll(".meal-in").forEach(i=>next[i.dataset.k]=i.value); S.state.meals={...(S.state.meals||{}),[S.mealDay]:next}; saveField("meals."+S.mealDay,next); },600);
A.mealInput=()=>saveMeal();
A.setMealDay=i=>{ S.mealDay=i; render(); };
A.clearWeekMeals=()=>confirmModal("Clear the whole week's meals?",()=>saveKey("meals",{}));
A.addGrocery=()=>{ const v=$("grocery-in").value.trim(); if(!v)return; saveKey("grocery",(S.state.grocery||[]).concat([{id:rid(),text:v,done:false}])); };
A.toggleGrocery=id=>saveKey("grocery",(S.state.grocery||[]).map(g=>g.id===id?{...g,done:!g.done}:g));
A.rmGrocery=id=>saveKey("grocery",(S.state.grocery||[]).filter(g=>g.id!==id));
A.clearDoneGroceries=()=>saveKey("grocery",(S.state.grocery||[]).filter(g=>!g.done));

/* ---------------- finance ---------------- */
function finance(){
  const b=S.state.budget||{income:[],expense:[],savings:[]};
  const sum=a=>(a||[]).reduce((s,x)=>s+(+x.amt||0),0);
  const inc=sum(b.income),exp=sum(b.expense),sav=sum(b.savings);
  const monthKey=todayS().slice(0,7);
  const spent=S.items.filter(i=>i.kind==="spend"&&(i.date||"").startsWith(monthKey)).reduce((s,x)=>s+(+x.amount||0),0);
  const cat=(arr,key)=>`<div class="fin-cat">${key}</div>`+((arr&&arr.length)?arr.map(l=>`<div class="money-row"><div class="grow">${esc(l.name)}</div><div class="amt">${money(l.amt)}</div><button class="x" onclick="A.rmBudget('${key.toLowerCase()}','${l.id}')">×</button></div>`).join(""):'<div class="empty">—</div>');
  return `<div class="card"><div class="sec-row"><h2 class="sec">This month</h2></div>
    <div class="two"><div class="stat"><div class="n">${money(inc)}</div><div class="l">Income</div></div><div class="stat"><div class="n">${money(exp)}</div><div class="l">Budgeted</div></div><div class="stat"><div class="n">${money(spent)}</div><div class="l">Spent</div></div><div class="stat"><div class="n">${money(inc-exp-sav)}</div><div class="l">Left after savings</div></div></div>
    <div class="progress" style="margin-top:8px"><i style="width:${exp?Math.min(100,spent/exp*100):0}%;${exp&&spent>exp?"background:var(--warn)":""}"></i></div></div>
    <div class="card"><div class="sec-row"><h2 class="sec">Budget</h2><button class="btn ghost sm" onclick="A.openBudgetModal()">${ICON.plus} Line</button></div>${cat(b.income,"Income")+cat(b.expense,"Expense")+cat(b.savings,"Savings")}</div>
    <div class="card"><div class="sec-row"><h2 class="sec">Spending</h2><button class="btn ghost sm" onclick="A.openSpendModal()">${ICON.plus} Log</button></div>
    ${S.items.filter(i=>i.kind==="spend").sort((a,c)=>c.createdAt-a.createdAt).slice(0,20).map(sp=>`<div class="row"><div class="grow"><div class="title">${esc(sp.desc)}</div><div class="sub">${esc(sp.cat||"")} · ${sp.date} · ${esc(sp.ownerInitials||"")}</div></div><div class="amt" style="font-weight:600">${money(sp.amount)}</div><button class="x" onclick="A.delItem('${sp.id}')">×</button></div>`).join("")||'<div class="empty">Nothing logged this month.</div>'}</div>
    <div class="card"><div class="sec-row"><h2 class="sec">Savings funds</h2><button class="btn ghost sm" onclick="A.openFundModal()">${ICON.plus} Fund</button></div>
    ${(S.state.funds||[]).map(f=>{const pct=f.goal?Math.min(100,(+f.saved||0)/f.goal*100):0;return `<div class="row" style="align-items:flex-start"><div class="grow"><div class="title">${esc(f.name)}</div><div class="sub">${money(f.saved)} of ${money(f.goal)}</div><div class="progress" style="margin-top:6px"><i style="width:${pct}%"></i></div></div><button class="btn ghost sm" onclick="A.addToFund('${f.id}')">+ Add</button><button class="x" onclick="A.rmFund('${f.id}')">×</button></div>`;}).join("")||'<div class="empty">A fund for something you\'re saving toward.</div>'}</div>
    <div class="card"><div class="sec-row"><h2 class="sec">Debts</h2><button class="btn ghost sm" onclick="A.openDebtModal()">${ICON.plus} Debt</button></div>
    ${(S.state.debts||[]).map(d=>`<div class="row"><div class="grow"><div class="title">${esc(d.name)}</div><div class="sub">${d.rate?d.rate+"% · ":""}${d.payment?money(d.payment)+"/mo":""}</div></div><div class="amt" style="font-weight:600;color:var(--warn)">${money(d.balance)}</div><button class="x" onclick="A.rmDebt('${d.id}')">×</button></div>`).join("")||'<div class="empty">None tracked.</div>'}</div>`;
}
A.openBudgetModal=()=>openModal(`<h3>Budget line</h3><label class="f">Type</label><select id="m-b-type"><option value="income">Income</option><option value="expense" selected>Expense</option><option value="savings">Savings</option></select><label class="f">Name</label><input id="m-b-name" placeholder="Tithe · Rent · Groceries"><label class="f">Monthly amount</label><input id="m-b-amt" type="number" inputmode="decimal" placeholder="0.00"><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createBudget()">Add</button></div>`);
A.createBudget=()=>{ const t=$("m-b-type").value,n=$("m-b-name").value.trim(),a=+$("m-b-amt").value||0; if(!n)return; const b=S.state.budget||{income:[],expense:[],savings:[]}; b[t]=(b[t]||[]).concat([{id:rid(),name:n,amt:a}]); saveKey("budget",b); closeModal(); };
A.rmBudget=(t,id)=>{ const b=S.state.budget||{}; b[t]=(b[t]||[]).filter(l=>l.id!==id); saveKey("budget",b); };
A.openSpendModal=()=>openModal(`<h3>Log spending</h3><label class="f">What</label><input id="m-s-desc" placeholder="Aldi run"><label class="f">Amount</label><input id="m-s-amt" type="number" inputmode="decimal" placeholder="0.00"><label class="f">Category</label><input id="m-s-cat" placeholder="Groceries"><label class="f">Date</label><input id="m-s-date" type="date" value="${todayS()}"><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createSpend()">Log</button></div>`);
A.createSpend=()=>{ const d=$("m-s-desc").value.trim(); if(!d)return; addItem({kind:"spend",desc:d,amount:+$("m-s-amt").value||0,cat:$("m-s-cat").value.trim(),date:$("m-s-date").value||todayS()}); closeModal(); };
A.openFundModal=()=>openModal(`<h3>Savings fund</h3><label class="f">Name</label><input id="m-f-name" placeholder="Emergency fund"><label class="f">Goal</label><input id="m-f-goal" type="number" inputmode="decimal"><label class="f">Already saved</label><input id="m-f-saved" type="number" inputmode="decimal" value="0"><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createFund()">Add</button></div>`);
A.createFund=()=>{ const n=$("m-f-name").value.trim(); if(!n)return; saveKey("funds",(S.state.funds||[]).concat([{id:rid(),name:n,goal:+$("m-f-goal").value||0,saved:+$("m-f-saved").value||0}])); closeModal(); };
A.addToFund=id=>openModal(`<h3>Add to fund</h3><label class="f">Amount</label><input id="m-f-add" type="number" inputmode="decimal"><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.doAddFund('${id}')">Add</button></div>`);
A.doAddFund=id=>{ const a=+$("m-f-add").value||0; saveKey("funds",(S.state.funds||[]).map(f=>f.id===id?{...f,saved:(+f.saved||0)+a}:f)); closeModal(); };
A.rmFund=id=>saveKey("funds",(S.state.funds||[]).filter(f=>f.id!==id));
A.openDebtModal=()=>openModal(`<h3>Loan / debt</h3><label class="f">Name</label><input id="m-d-name" placeholder="Student loans"><label class="f">Balance</label><input id="m-d-bal" type="number" inputmode="decimal"><label class="f">Rate %</label><input id="m-d-rate" type="number" inputmode="decimal"><label class="f">Monthly payment</label><input id="m-d-pay" type="number" inputmode="decimal"><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createDebt()">Add</button></div>`);
A.createDebt=()=>{ const n=$("m-d-name").value.trim(); if(!n)return; saveKey("debts",(S.state.debts||[]).concat([{id:rid(),name:n,balance:+$("m-d-bal").value||0,rate:+$("m-d-rate").value||0,payment:+$("m-d-pay").value||0}])); closeModal(); };
A.rmDebt=id=>saveKey("debts",(S.state.debts||[]).filter(d=>d.id!==id));

/* ---------------- family & pets ---------------- */
function family(){
  const secs=S.items.filter(i=>i.kind==="famsec").sort((a,b)=>a.createdAt-b.createdAt);
  return `<div class="sec-row"><h2 class="sec">Family & pets</h2><button class="btn ghost sm" onclick="A.openFamModal()">${ICON.plus} Section</button></div>
  ${secs.map(s=>`<div class="card"><div class="sec-row"><h2 class="sec">${s.emoji||"🐾"} ${esc(s.name)}</h2><button class="x" onclick="A.rmFam('${s.id}')">×</button></div>
    ${(s.items||[]).map((it,ix)=>`<div class="row"><div class="grow"><div class="sub" style="text-transform:uppercase;letter-spacing:.06em">${esc(it.label)}</div><div class="title">${esc(it.value)}</div></div><button class="x" onclick="A.rmFamItem('${s.id}',${ix})">×</button></div>`).join("")||'<div class="empty">No details yet.</div>'}
    <div class="addline"><input id="faml-${s.id}" placeholder="Label (Vet)"><input id="famv-${s.id}" placeholder="Detail"><button class="iconbtn" onclick="A.addFamItem('${s.id}')">${ICON.plus}</button></div></div>`).join("")||'<div class="card"><div class="empty">Vet numbers, sizes, allergies, the things you look up twice a year.</div></div>'}`;
}
A.openFamModal=()=>openModal(`<h3>New section</h3><label class="f">Name</label><input id="m-fam-name" placeholder="Gordie · the baby"><label class="f">Emoji</label><input id="m-fam-emoji" placeholder="🐕" maxlength="4"><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createFam()">Add</button></div>`);
A.createFam=()=>{ const n=$("m-fam-name").value.trim(); if(!n)return; addItem({kind:"famsec",name:n,emoji:$("m-fam-emoji").value.trim()||"🐾",items:[]}); closeModal(); };
A.rmFam=id=>confirmModal("Delete this section?",()=>delItem(id));
A.addFamItem=id=>{ const s=S.items.find(i=>i.id===id); const l=$("faml-"+id).value.trim(), v=$("famv-"+id).value.trim(); if(!l&&!v)return; updItem(id,{items:(s.items||[]).concat([{label:l||"Note",value:v}])}); };
A.rmFamItem=(id,ix)=>{ const s=S.items.find(i=>i.id===id); updItem(id,{items:(s.items||[]).filter((_,j)=>j!==ix)}); };

/* ---------------- notes ---------------- */
function notes(){
  const ns=S.items.filter(i=>i.kind==="note"&&(i.shared!==false||isMine(i))).sort((a,b)=>b.createdAt-a.createdAt);
  return `<div class="sec-row"><h2 class="sec">Notes</h2><button class="btn ghost sm" onclick="A.openNoteModal()">${ICON.plus} Note</button></div>
  ${ns.map(n=>`<div class="card"><div class="sec-row"><h2 class="sec">${esc(n.title)}</h2>${isMine(n)?`<button class="x" onclick="A.delItem('${n.id}')">×</button>`:""}</div><div style="white-space:pre-wrap;color:var(--ink-2)">${esc(n.body)}</div><div class="sub" style="margin-top:10px">${new Date(n.createdAt).toLocaleDateString()} · ${n.shared===false?"Private":"Both"}</div></div>`).join("")||'<div class="card"><div class="empty">Try writing your household\'s "why."</div></div>'}`;
}
A.openNoteModal=()=>openModal(`<h3>New note</h3><label class="f">Title</label><input id="m-n-title" placeholder="Our why"><label class="f">Note</label><textarea id="m-n-body" rows="4"></textarea><label class="f">Visibility</label><select id="m-n-vis"><option value="both" selected>Both of us</option><option value="private">Just me</option></select><div class="actions"><button class="btn ghost" onclick="A.closeModal()">Cancel</button><button class="btn" onclick="A.createNote()">Save</button></div>`);
A.createNote=()=>{ const t=$("m-n-title").value.trim(), b=$("m-n-body").value.trim(); if(!t&&!b)return; addItem({kind:"note",title:t||"Untitled",body:b,shared:$("m-n-vis").value==="both"}); closeModal(); };

registerScreen("more",render);
