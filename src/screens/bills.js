/* Vita Plena — Bills. Not tasks, not events: money that is due on a day. Each
   bill is a payee, an amount, and either a day of the month or one date; paid is
   tracked per month. Bills stay out of the task schedule and the event list —
   they get a card on Today when something is due soon, rows on the calendar,
   and a sheet of their own reached from Today or Tasks. */
import { S, esc, jsq, money, todayS, ymd, addD, addItem, updItem, delItem,
  billDueOn, billPaidOn, billPeriod, nextBillDate, daysBetween } from "../core/data.js";
import { $, A, ICON, openModal, closeModal, confirmModal, openSheet, toast } from "../ui/dom.js";

const bills=()=>S.items.filter(i=>i.kind==="bill");
const fmtDue=ds=>new Date(ds+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});

/** Every bill with the date that matters for it right now: an unpaid due date
    this period (possibly in the past), else its next one. */
export function billsInView(){
  const today=todayS();
  return bills().map(b=>{
    const thisPeriod=b.dueDom?today.slice(0,7):null;
    const dueThisPeriod=thisPeriod?nextBillDate(b,thisPeriod+"-01"):b.due;
    const unpaidPast=dueThisPeriod&&dueThisPeriod<today&&!billPaidOn(b,dueThisPeriod);
    const date=unpaidPast?dueThisPeriod:nextBillDate(b,today);
    return date?{b,date,paid:billPaidOn(b,date),overdue:!!unpaidPast,days:daysBetween(today,date)}:null;
  }).filter(Boolean).sort((x,y)=>(Number(x.paid)-Number(y.paid))||x.date.localeCompare(y.date));
}

const row=(v,compact)=>`<div class="row ${v.paid?"done":""}">
  <button class="chk ${v.paid?"on":""}" onclick="A.toggleBillPaid('${v.b.id}','${v.date}')" aria-label="${v.paid?"Paid":"Mark paid"}">${ICON.check}</button>
  <div class="grow"><div class="title ${v.paid?"done-text":""}">${esc(v.b.text)}</div>
    <div class="kind">${v.paid?"Paid":v.overdue?`<span style="color:var(--warn)">${v.days<0?-v.days+"d overdue":"overdue"}</span>`:v.days===0?"Due today":v.days===1?"Due tomorrow":"Due "+fmtDue(v.date)}${v.b.dueDom?" · monthly":""}${v.b.autopay?" · autopay":""}</div></div>
  <div class="disp num" style="font-size:19px;font-weight:600">${money(v.b.amount)}</div>
  ${compact?"":`<button class="editp" onclick="A.openBillModal('${v.b.id}')">${ICON.edit}</button>`}
</div>`;

/** The card on Today: overdue and due within a week. Nothing at all if none. */
export function billsCard(){
  const soon=billsInView().filter(v=>!v.paid&&v.days<=7);
  if(!bills().length)return "";
  const due=soon.reduce((n,v)=>n+(+v.b.amount||0),0);
  return `<div class="card" style="margin-top:14px">
    <div class="sec-row"><h2 class="sec">Bills</h2><button class="link" onclick="A.openBills()">${soon.length?money(due)+" due this week →":"All →"}</button></div>
    ${soon.length?soon.map(v=>row(v,true)).join(""):'<div class="empty">Nothing due this week.</div>'}
  </div>`;
}

/** Rows for a calendar day: the bills that fall due on it. */
export function billRowsOn(dateS){
  return bills().filter(b=>billDueOn(b,dateS)).map(b=>{ const paid=billPaidOn(b,dateS);
    return `<div class="row ${paid?"done":""}"><button class="chk ${paid?"on":""}" onclick="A.toggleBillPaid('${b.id}','${dateS}')">${ICON.check}</button><div class="ev-time">bill</div><div class="grow"><div class="title ${paid?"done-text":""}">${esc(b.text)}</div></div><div class="disp num" style="font-size:18px">${money(b.amount)}</div></div>`; }).join("");
}
/** One-line items for the week strip. */
export function billItemsOn(dateS){
  return bills().filter(b=>billDueOn(b,dateS)).map(b=>`<div class="wk-item"><span class="t">bill</span><span class="${billPaidOn(b,dateS)?"done-text":""}">${esc(b.text)} <span class="muted">· ${money(b.amount)}</span></span></div>`).join("");
}

function pane(){
  const list=billsInView();
  const month=todayS().slice(0,7);
  const monthTotal=bills().filter(b=>b.dueDom).reduce((n,b)=>n+(+b.amount||0),0);
  const unpaid=list.filter(v=>!v.paid&&v.date.slice(0,7)<=month).reduce((n,v)=>n+(+v.b.amount||0),0);
  return `<div class="reader" data-pane="bills"><div class="eyebrow lit">${new Date().toLocaleDateString(undefined,{month:"long"})}</div>
    <div class="r-title" style="font-size:30px">Bills</div>
    <div class="r-note">${bills().length?`${money(monthTotal)} a month in regular bills · ${unpaid?money(unpaid)+" still unpaid":"all paid up"}`:"Rent, utilities, the phone. Add them once and they come back every month."}</div>
    <div class="amen" style="margin-top:18px"><button class="btn block" onclick="A.openBillModal()">${ICON.plus} Add a bill</button></div>
    <div style="margin-top:18px">${list.map(v=>row(v,false)).join("")||'<div class="empty">No bills yet.</div>'}</div>
  </div>`;
}
function repaint(){ if(document.querySelector('.sheet.open [data-pane="bills"]'))$("sheet-body").innerHTML=pane(); }
A.openBills=()=>openSheet(pane(),{cls:"full"});

A.toggleBillPaid=(id,dateS)=>{
  const b=S.items.find(i=>i.id===id); if(!b)return;
  const paid=billPaidOn(b,dateS);
  const patch=b.dueDom?{paidMonths:{...(b.paidMonths||{}),[billPeriod(b,dateS)]:!paid}}:{paid:!paid};
  updItem(id,patch).then(repaint);
  if(!paid)toast("Paid · "+money(b.amount));
};

A.openBillModal=id=>{
  const b=id?S.items.find(i=>i.id===id):null;
  const mode=b?(b.dueDom?"monthly":"once"):"monthly";
  openModal(`<h3>${b?"Edit bill":"New bill"}</h3>
    <label class="f">Payee</label><input id="m-b-text" value="${b?esc(b.text):""}" placeholder="Mortgage · Electric · Phone">
    <label class="f">Amount</label><input id="m-b-amt" type="number" inputmode="decimal" step="0.01" value="${b?b.amount:""}" placeholder="0.00">
    <label class="f">Due</label>
    <div class="pills" id="m-b-mode" data-v="${mode}">${[["monthly","Every month"],["once","Once"]].map(([v,l])=>`<button class="pill ${mode===v?"on":""}" data-m="${v}" onclick="A.billMode('${v}')">${l}</button>`).join("")}</div>
    <div id="m-b-dom-wrap"><label class="f">Day of the month</label><input id="m-b-dom" type="number" inputmode="numeric" min="1" max="31" value="${b?.dueDom||1}"></div>
    <div id="m-b-date-wrap" style="display:none"><label class="f">Date</label><input id="m-b-date" type="date" value="${b?.due||todayS()}"></div>
    <div class="kv" style="margin-top:12px"><div class="k">Autopay<small>Paid on its own; shown for the record.</small></div><button class="switch ${b?.autopay?"on":""}" id="m-b-auto" onclick="this.classList.toggle('on')"></button></div>
    <div class="actions">${b?`<button class="btn ghost" onclick="A.rmBill('${id}')">Delete</button>`:`<button class="btn ghost" onclick="A.closeModal()">Cancel</button>`}<button class="btn" onclick="A.saveBill('${id||""}')">${b?"Save":"Add"}</button></div>`);
  A.billMode(mode);
};
A.billMode=v=>{ $("m-b-mode").dataset.v=v; [...$("m-b-mode").children].forEach(x=>x.classList.toggle("on",x.dataset.m===v)); $("m-b-dom-wrap").style.display=v==="monthly"?"":"none"; $("m-b-date-wrap").style.display=v==="once"?"":"none"; };
A.saveBill=id=>{
  const text=$("m-b-text").value.trim(); if(!text)return toast("Who is the bill to?");
  const amount=Math.round((+$("m-b-amt").value||0)*100)/100; if(!(amount>0))return toast("Add the amount");
  const monthly=$("m-b-mode").dataset.v==="monthly";
  const prev=id?S.items.find(i=>i.id===id):null;
  const data={kind:"bill",text,amount,autopay:$("m-b-auto").classList.contains("on"),
    dueDom:monthly?Math.max(1,Math.min(31,+$("m-b-dom").value||1)):null, due:monthly?"":($("m-b-date").value||todayS()),
    paidMonths:prev?.paidMonths||{}, paid:prev?!!prev.paid:false};
  (id?updItem(id,data):addItem(data)).then(repaint); closeModal();
};
A.rmBill=id=>{ closeModal(); confirmModal("Delete this bill?",()=>delItem(id).then(repaint)); };
