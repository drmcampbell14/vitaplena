/* VITA PLENA v4 — views/extras.js — Meals & Grocery, Finance, Family & Pets, Notes (drawer pages) */
import { $, esc, rid, money, todayS, S, saveKey, saveField, addItem, updItem, delItem,
  isMine, setVal, debounce, toast } from "../data.js";

/* ---- MEALS ---- */
export function renderMeals(){
  $("meal-days").innerHTML=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=>`<button class="daytab ${S.mealDay===i?"on":""}" onclick="setMealDay(${i})">${d}</button>`).join("");
  const m=(S.state.meals||{})[S.mealDay]||{};
  setVal("meal-b",m.b);setVal("meal-l",m.l);setVal("meal-d",m.d);
  $("friday-hint").style.display=S.mealDay===4?"":"none";
  $("grocery-list").innerHTML=(S.state.grocery||[]).map(g=>`<div class="row"><button class="chk ${g.done?"on":""}" onclick="toggleGrocery('${g.id}')">✓</button><div class="grow title ${g.done?"done-text":""}">${esc(g.text)}</div><button class="x" onclick="rmGrocery('${g.id}')">×</button></div>`).join("")||'<div class="empty">Nothing yet.</div>';
}
function saveMealNow(){
  if(!S.hid)return;
  const cur=(S.state.meals||{})[S.mealDay]||{};
  const next={b:$("meal-b").value,l:$("meal-l").value,d:$("meal-d").value};
  if(cur.b===next.b&&cur.l===next.l&&cur.d===next.d)return;
  S.state.meals={...(S.state.meals||{}),[S.mealDay]:next};
  saveField("meals."+S.mealDay,next);
}
const saveMealDeb=debounce(saveMealNow,700);
export function wireMeals(){ ["meal-b","meal-l","meal-d"].forEach(id=>$(id).addEventListener("input",saveMealDeb)); }
window.setMealDay=i=>{saveMealNow();S.mealDay=i;renderMeals();};
window.clearWeekMeals=()=>window.confirmModal("Clear the whole week's meals?",()=>saveKey("meals",{}));
window.addGrocery=()=>{const v=$("grocery-in").value.trim();if(!v)return;$("grocery-in").value="";saveKey("grocery",(S.state.grocery||[]).concat([{id:rid(),text:v,done:false}]));};
window.toggleGrocery=id=>saveKey("grocery",(S.state.grocery||[]).map(g=>g.id===id?{...g,done:!g.done}:g));
window.rmGrocery=id=>saveKey("grocery",(S.state.grocery||[]).filter(g=>g.id!==id));
window.clearDoneGroceries=()=>saveKey("grocery",(S.state.grocery||[]).filter(g=>!g.done));

/* ---- FINANCE ---- */
export function renderFinance(){
  const b=S.state.budget||{income:[],expense:[],savings:[]};
  const sum=a=>(a||[]).reduce((s,x)=>s+(+x.amt||0),0);
  const inc=sum(b.income),exp=sum(b.expense),sav=sum(b.savings);
  const monthKey=todayS().slice(0,7);
  const spent=S.items.filter(i=>i.kind==="spend"&&(i.date||"").startsWith(monthKey)).reduce((s,x)=>s+(+x.amount||0),0);
  $("fs-inc").textContent=money(inc);$("fs-exp").textContent=money(exp);$("fs-sav").textContent=money(sav);
  $("fs-net").textContent=money(inc-exp-sav);
  $("fs-spent").textContent=money(spent);$("fs-budg").textContent=money(exp);
  $("fin-bar-i").style.width=(exp?Math.min(100,spent/exp*100):0)+"%";
  $("fin-bar-i").style.background=exp&&spent>exp?"var(--terra)":"var(--sage)";
  const cat=(arr,key,cls)=>`<div class="fin-cat ${cls}">${key}</div>`+((arr&&arr.length)?arr.map(l=>`<div class="money-row"><div class="grow">${esc(l.name)}</div><div class="amt">${money(l.amt)}</div><button class="x" onclick="rmBudget('${key.toLowerCase()}','${l.id}')">×</button></div>`).join(""):'<div class="empty">—</div>')+`<div class="money-row" style="border:none;justify-content:flex-end"><span class="hint">Total: ${money(sum(arr))}</span></div>`;
  $("budget-list").innerHTML=cat(b.income,"Income","c-inc")+cat(b.expense,"Expense","c-exp")+cat(b.savings,"Savings","c-sav");
  $("spend-list").innerHTML=S.items.filter(i=>i.kind==="spend").sort((a,b2)=>b2.createdAt-a.createdAt).slice(0,25)
    .map(sp=>`<div class="row"><div class="grow"><div class="title">${esc(sp.desc)}</div><div class="sub">${esc(sp.cat||"")} · ${sp.date} · ${esc(sp.ownerInitials)}</div></div><div class="amt" style="font-weight:600">${money(sp.amount)}</div><button class="x" onclick="delItem('${sp.id}')">×</button></div>`).join("")||'<div class="empty">No spending logged yet.</div>';
  $("fund-list").innerHTML=(S.state.funds||[]).map(f=>{const pct=f.goal?Math.min(100,(+f.saved||0)/f.goal*100):0;
    return `<div class="row" style="align-items:flex-start"><div class="grow"><div class="title">${esc(f.name)}</div><div class="sub">${money(f.saved)} of ${money(f.goal)}</div><div class="progress-sm"><i style="width:${pct}%"></i></div></div><button class="btn ghost sm" onclick="addToFund('${f.id}')">+ Add</button><button class="x" onclick="rmFund('${f.id}')">×</button></div>`;}).join("")||'<div class="empty">No savings funds yet — try “Ponte Vedra Practice Fund.”</div>';
  $("debt-list").innerHTML=(S.state.debts||[]).map(d=>`<div class="row"><div class="grow"><div class="title">${esc(d.name)}</div><div class="sub">${d.rate?d.rate+"% · ":""}${d.payment?money(d.payment)+"/mo":""}</div></div><div class="amt" style="font-weight:600;color:var(--terra)">${money(d.balance)}</div><button class="x" onclick="rmDebt('${d.id}')">×</button></div>`).join("")||'<div class="empty">No debts tracked.</div>';
}
window.openBudgetModal=()=>window.openModal(`<h3>Budget line</h3>
  <label class="f">Type</label><select id="m-b-type"><option value="income">Income</option><option value="expense" selected>Expense</option><option value="savings">Savings</option></select>
  <label class="f">Name</label><input id="m-b-name" placeholder="e.g. Tithe · Rent · Groceries">
  <label class="f">Monthly amount</label><input id="m-b-amt" type="number" inputmode="decimal" placeholder="0.00">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createBudget()">Add</button></div>`);
window.createBudget=()=>{const t=$("m-b-type").value,n=$("m-b-name").value.trim(),a=+$("m-b-amt").value||0;if(!n)return;
  const b=S.state.budget||{income:[],expense:[],savings:[]};b[t]=(b[t]||[]).concat([{id:rid(),name:n,amt:a}]);saveKey("budget",b);window.closeModal();};
window.rmBudget=(t,id)=>{const b=S.state.budget||{};b[t]=(b[t]||[]).filter(l=>l.id!==id);saveKey("budget",b);};
window.openSpendModal=()=>window.openModal(`<h3>Log spending</h3>
  <label class="f">Description</label><input id="m-s-desc" placeholder="e.g. Aldi run">
  <label class="f">Amount</label><input id="m-s-amt" type="number" inputmode="decimal" placeholder="0.00">
  <label class="f">Category</label><input id="m-s-cat" placeholder="Groceries">
  <label class="f">Date</label><input id="m-s-date" type="date" value="${todayS()}">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createSpend()">Log</button></div>`);
window.createSpend=()=>{const d=$("m-s-desc").value.trim();if(!d)return;addItem({kind:"spend",desc:d,amount:+$("m-s-amt").value||0,cat:$("m-s-cat").value.trim(),date:$("m-s-date").value||todayS()});window.closeModal();};
window.openFundModal=()=>window.openModal(`<h3>Savings fund</h3>
  <label class="f">Name</label><input id="m-f-name" placeholder="Emergency fund">
  <label class="f">Goal</label><input id="m-f-goal" type="number" inputmode="decimal">
  <label class="f">Already saved</label><input id="m-f-saved" type="number" inputmode="decimal" value="0">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createFund()">Add</button></div>`);
window.createFund=()=>{const n=$("m-f-name").value.trim();if(!n)return;saveKey("funds",(S.state.funds||[]).concat([{id:rid(),name:n,goal:+$("m-f-goal").value||0,saved:+$("m-f-saved").value||0}]));window.closeModal();};
window.addToFund=id=>window.openModal(`<h3>Add to fund</h3><label class="f">Amount</label><input id="m-f-add" type="number" inputmode="decimal">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="doAddFund('${id}')">Add</button></div>`);
window.doAddFund=id=>{const a=+$("m-f-add").value||0;saveKey("funds",(S.state.funds||[]).map(f=>f.id===id?{...f,saved:(+f.saved||0)+a}:f));window.closeModal();};
window.rmFund=id=>saveKey("funds",(S.state.funds||[]).filter(f=>f.id!==id));
window.openDebtModal=()=>window.openModal(`<h3>Loan / debt</h3>
  <label class="f">Name</label><input id="m-d-name" placeholder="Student loans">
  <label class="f">Balance</label><input id="m-d-bal" type="number" inputmode="decimal">
  <label class="f">Rate %</label><input id="m-d-rate" type="number" inputmode="decimal">
  <label class="f">Monthly payment</label><input id="m-d-pay" type="number" inputmode="decimal">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createDebt()">Add</button></div>`);
window.createDebt=()=>{const n=$("m-d-name").value.trim();if(!n)return;saveKey("debts",(S.state.debts||[]).concat([{id:rid(),name:n,balance:+$("m-d-bal").value||0,rate:+$("m-d-rate").value||0,payment:+$("m-d-pay").value||0}]));window.closeModal();};
window.rmDebt=id=>saveKey("debts",(S.state.debts||[]).filter(d=>d.id!==id));

/* ---- FAMILY & PETS ---- */
export function renderFamily(){
  const secs=S.items.filter(i=>i.kind==="famsec").sort((a,b)=>a.createdAt-b.createdAt);
  $("fam-empty").style.display=secs.length?"none":"";
  $("fam-list").innerHTML=secs.map(s=>{
    const its=s.items||[];
    return `<div class="card"><div class="sec-row"><h2 class="sec" style="margin:0">${s.emoji||"🐾"} ${esc(s.name)}</h2><button class="x" onclick="rmFam('${s.id}')">×</button></div>
    ${its.map((it,ix)=>`<div class="row"><div class="grow"><div class="sub" style="text-transform:uppercase;letter-spacing:.06em">${esc(it.label)}</div><div class="title">${esc(it.value)}</div></div><button class="x" onclick="rmFamItem('${s.id}',${ix})">×</button></div>`).join("")||'<div class="empty">No details yet.</div>'}
    <div class="addline"><input id="faml-${s.id}" placeholder="Label (e.g. Vet)" style="flex:1"><input id="famv-${s.id}" placeholder="Detail" style="flex:1.3"><button class="iconbtn" onclick="addFamItem('${s.id}')">+</button></div></div>`;
  }).join("");
}
window.openFamModal=()=>window.openModal(`<h3>New section</h3>
  <label class="f">Name</label><input id="m-fam-name" placeholder="Denver · Gordie · Baby">
  <label class="f">Emoji</label><input id="m-fam-emoji" placeholder="🐕" maxlength="4">
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createFam()">Add</button></div>`);
window.createFam=()=>{const n=$("m-fam-name").value.trim();if(!n)return;addItem({kind:"famsec",name:n,emoji:$("m-fam-emoji").value.trim()||"🐾",items:[]});window.closeModal();};
window.rmFam=id=>window.confirmModal("Delete this section?",()=>delItem(id));
window.addFamItem=id=>{const s=S.items.find(i=>i.id===id);const l=$("faml-"+id).value.trim(),v=$("famv-"+id).value.trim();if(!l&&!v)return;updItem(id,{items:(s.items||[]).concat([{label:l||"Note",value:v}])});};
window.rmFamItem=(id,ix)=>{const s=S.items.find(i=>i.id===id);updItem(id,{items:(s.items||[]).filter((_,j)=>j!==ix)});};

/* ---- NOTES ---- */
export function renderNotes(){
  const ns=S.items.filter(i=>i.kind==="note"&&(i.shared!==false||isMine(i))).sort((a,b)=>b.createdAt-a.createdAt);
  $("note-list").innerHTML=ns.map(n=>`<div class="card"><div class="sec-row"><h2 class="sec" style="margin:0;color:var(--ink)">${esc(n.title)}</h2>${isMine(n)?`<button class="x" onclick="delItem('${n.id}')">×</button>`:""}</div>
    <div style="font-size:15px;color:var(--muted);white-space:pre-wrap">${esc(n.body)}</div>
    <div class="sub" style="margin-top:10px">${new Date(n.createdAt).toLocaleDateString()} · <span class="owner-tag" style="text-transform:uppercase">${n.shared===false?"Private":"Both"}</span></div></div>`).join("")||'<div class="card"><div class="empty">No notes yet. Try writing your household\'s "why."</div></div>';
}
window.openNoteModal=()=>window.openModal(`<h3>New note</h3>
  <label class="f">Title</label><input id="m-n-title" placeholder="Our Why">
  <label class="f">Note</label><textarea id="m-n-body" rows="4" placeholder="We want to build a life that reflects what we're called to…"></textarea>
  <label class="f">Visibility</label><select id="m-n-vis"><option value="both" selected>Both of us</option><option value="private">Just me</option></select>
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="createNote()">Save</button></div>`);
window.createNote=()=>{const t=$("m-n-title").value.trim(),b=$("m-n-body").value.trim();if(!t&&!b)return;addItem({kind:"note",title:t||"Untitled",body:b,shared:$("m-n-vis").value==="both"});window.closeModal();};
