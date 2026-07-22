/* ================================================================
   VITA PLENA v4 — data.js
   Firebase config + init, shared state, constants, utils,
   Firestore write helpers, recurrence engine.
   ================================================================ */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAoWENkKyQi_sgvGrwREAE3xn3a7A32pU4",
  authDomain: "vita-plena-a7efa.firebaseapp.com",
  projectId: "vita-plena-a7efa",
  storageBucket: "vita-plena-a7efa.firebasestorage.app",
  messagingSenderId: "321629125374",
  appId: "1:321629125374:web:3130956b0be69f921383af"
};
export const GOOGLE_CLIENT_ID = "321629125374-jqeuba99c0gm7qb4ja9q47pmkc5j8674.apps.googleusercontent.com";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------- liturgical engine (season is a text detail now, not the theme) ---------------- */
export function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da);}
export function addD(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
export function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
export function season(d){
  const y=d.getFullYear(), E=easter(y);
  const ash=addD(E,-46), holyThu=addD(E,-3), pent=addD(E,49);
  const xmas=new Date(y,11,25);
  let adv=new Date(y,11,25); adv=addD(adv,-(adv.getDay()||7)); adv=addD(adv,-21);
  const epiph=new Date(y,0,6); let bapt=addD(epiph,7-epiph.getDay()||7); if(epiph.getDay()===0) bapt=addD(epiph,7);
  const t=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const cmp=(a,b)=>a.getTime()-new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime();
  if(cmp(t,new Date(y,0,1))>=0 && cmp(t,bapt)<=0) return {name:"Christmas"};
  if(cmp(t,ash)>=0 && cmp(t,holyThu)<0) return {name:"Lent"};
  if(cmp(t,holyThu)>=0 && cmp(t,E)<0) return {name:"Sacred Triduum"};
  if(cmp(t,E)>=0 && cmp(t,pent)<0) return {name:"Easter"};
  if(cmp(t,pent)===0) return {name:"Pentecost"};
  if(cmp(t,adv)>=0 && cmp(t,xmas)<0) return {name:"Advent"};
  if(cmp(t,xmas)>=0) return {name:"Christmas"};
  return {name:"Ordinary Time"};
}

/* ---------------- constants (ported verbatim from v3) ---------------- */
export const SAINTS={ "01-01":"Mary, Mother of God","01-02":"Ss. Basil & Gregory Nazianzen","01-04":"St. Elizabeth Ann Seton","01-05":"St. John Neumann","01-17":"St. Anthony of Egypt","01-21":"St. Agnes","01-24":"St. Francis de Sales","01-25":"Conversion of St. Paul","01-26":"Ss. Timothy & Titus","01-28":"St. Thomas Aquinas","01-31":"St. John Bosco",
"02-02":"Presentation of the Lord","02-03":"St. Blaise","02-05":"St. Agatha","02-06":"St. Paul Miki & Companions","02-10":"St. Scholastica","02-11":"Our Lady of Lourdes","02-14":"Ss. Cyril & Methodius","02-22":"Chair of St. Peter","02-23":"St. Polycarp",
"03-03":"St. Katharine Drexel","03-07":"Ss. Perpetua & Felicity","03-17":"St. Patrick","03-19":"St. Joseph","03-25":"The Annunciation",
"04-04":"St. Isidore of Seville","04-07":"St. John Baptist de la Salle","04-11":"St. Stanislaus","04-21":"St. Anselm","04-23":"St. George","04-25":"St. Mark","04-29":"St. Catherine of Siena","04-30":"St. Pius V",
"05-01":"St. Joseph the Worker","05-02":"St. Athanasius","05-03":"Ss. Philip & James","05-10":"St. Damien of Molokai","05-13":"Our Lady of Fatima","05-14":"St. Matthias","05-15":"St. Isidore the Farmer","05-22":"St. Rita of Cascia","05-26":"St. Philip Neri","05-30":"St. Joan of Arc","05-31":"The Visitation",
"06-01":"St. Justin Martyr","06-03":"St. Charles Lwanga & Companions","06-05":"St. Boniface","06-11":"St. Barnabas","06-13":"St. Anthony of Padua","06-21":"St. Aloysius Gonzaga","06-22":"Ss. John Fisher & Thomas More","06-24":"Nativity of St. John the Baptist","06-28":"St. Irenaeus","06-29":"Ss. Peter & Paul",
"07-01":"St. Junipero Serra","07-03":"St. Thomas the Apostle","07-06":"St. Maria Goretti","07-11":"St. Benedict","07-14":"St. Kateri Tekakwitha","07-15":"St. Bonaventure","07-16":"Our Lady of Mt. Carmel","07-22":"St. Mary Magdalene","07-23":"St. Bridget of Sweden","07-25":"St. James","07-26":"Ss. Joachim & Anne","07-29":"Ss. Martha, Mary & Lazarus","07-31":"St. Ignatius of Loyola",
"08-01":"St. Alphonsus Liguori","08-04":"St. John Vianney","08-06":"Transfiguration of the Lord","08-08":"St. Dominic","08-09":"St. Teresa Benedicta (Edith Stein)","08-10":"St. Lawrence","08-11":"St. Clare","08-14":"St. Maximilian Kolbe","08-15":"Assumption of Mary","08-20":"St. Bernard of Clairvaux","08-21":"St. Pius X","08-22":"Queenship of Mary","08-27":"St. Monica","08-28":"St. Augustine","08-29":"Passion of St. John the Baptist",
"09-03":"St. Gregory the Great","09-05":"St. Teresa of Calcutta","09-08":"Nativity of Mary","09-09":"St. Peter Claver","09-13":"St. John Chrysostom","09-14":"Exaltation of the Holy Cross","09-15":"Our Lady of Sorrows","09-16":"Ss. Cornelius & Cyprian","09-21":"St. Matthew","09-23":"St. Padre Pio","09-27":"St. Vincent de Paul","09-29":"Ss. Michael, Gabriel & Raphael","09-30":"St. Jerome",
"10-01":"St. Thérèse of Lisieux","10-02":"Guardian Angels","10-04":"St. Francis of Assisi","10-05":"St. Faustina Kowalska","10-07":"Our Lady of the Rosary","10-11":"St. John XXIII","10-15":"St. Teresa of Ávila","10-16":"St. Margaret Mary Alacoque","10-17":"St. Ignatius of Antioch","10-18":"St. Luke","10-22":"St. John Paul II","10-28":"Ss. Simon & Jude",
"11-01":"All Saints","11-02":"All Souls","11-03":"St. Martin de Porres","11-04":"St. Charles Borromeo","11-09":"Dedication of the Lateran Basilica","11-10":"St. Leo the Great","11-11":"St. Martin of Tours","11-13":"St. Frances Xavier Cabrini","11-17":"St. Elizabeth of Hungary","11-21":"Presentation of Mary","11-22":"St. Cecilia","11-30":"St. Andrew",
"12-03":"St. Francis Xavier","12-06":"St. Nicholas","12-07":"St. Ambrose","12-08":"Immaculate Conception","12-09":"St. Juan Diego","12-12":"Our Lady of Guadalupe","12-13":"St. Lucy","12-14":"St. John of the Cross","12-25":"Nativity of the Lord","12-26":"St. Stephen","12-27":"St. John the Apostle","12-28":"Holy Innocents"};
export const QUOTES=[["Be what you are and be that well.","St. Francis de Sales"],["Pray, hope, and don't worry.","St. Padre Pio"],["Late have I loved you, Beauty so ancient and so new.","St. Augustine"],["Do small things with great love.","St. Teresa of Calcutta"],["The world offers you comfort. But you were not made for comfort. You were made for greatness.","Pope Benedict XVI"],["To one who has faith, no explanation is necessary.","St. Thomas Aquinas"],["Let nothing disturb you. God alone suffices.","St. Teresa of Ávila"],["Holiness consists simply in doing God's will, and being just what God wants us to be.","St. Thérèse of Lisieux"],["Charity is the sweet and holy bond which links the soul with its Creator.","St. Catherine of Siena"],["He who labors as he prays lifts his heart to God with his hands.","St. Benedict"],["The family that prays together stays together.","Ven. Patrick Peyton"],["Love is shown more in deeds than in words.","St. Ignatius of Loyola"],["Have patience with all things, but chiefly have patience with yourself.","St. Francis de Sales"],["Our hearts are restless until they rest in You.","St. Augustine"],["Faith is to believe what you do not see; the reward of this faith is to see what you believe.","St. Augustine"],["Nothing is far from God.","St. Monica"],["Serve the Lord with laughter.","St. Padre Pio"],["Christ has no body now but yours.","St. Teresa of Ávila"],["The Rosary is the weapon for these times.","St. Padre Pio"],["Man cannot live without love.","St. John Paul II"],["Do not be afraid. Open wide the doors for Christ.","St. John Paul II"],["Give me a soul in a state of grace and I will give you a saint.","St. John Vianney"],["Where there is no love, put love — and you will find love.","St. John of the Cross"],["It is Jesus that you seek when you dream of happiness.","St. John Paul II"],["Great holiness consists in carrying out the little duties of each moment.","St. Josemaría Escrivá"],["You cannot be half a saint; you must be a whole saint or no saint at all.","St. Thérèse of Lisieux"]];
export const PROMPTS=["When did you feel closest to God this week — and was I part of it, or apart from it?","What's something you're carrying right now that you haven't told me yet?","If Christ sat at our table tonight, what would He praise in our home? What would He gently correct?","What did you need from me this week that you didn't ask for?","When have you felt most proud of us lately?","What's a dream for our life you're almost afraid to say out loud?","Where is God asking us to be braver?","What part of your day do you wish I could see through your eyes?","What's one memory of us you hope we never lose?","Who has God placed in our path right now who needs us?","What would you want more of in our marriage — and what less?","How can I make it easier for you to be holy?","What are you grieving that I might not have noticed?","If our marriage preached a homily this month, what would it have said?","What's one way we've changed since our wedding day that you're grateful for?","What should we bring to the altar together this Sunday?"];
export const DOMAINS=[
 {name:"Our Prayer Life",qs:["Is our prayer together honest, or hurried? What would it take to pray as a couple like we mean it?","Where have we seen God answer something this year?","What's one devotion we could adopt together this season?"]},
 {name:"Our Mission & Vocation",qs:["What is God asking of our family right now that He isn't asking of anyone else?","Are our work lives serving our vocation — or competing with it?","If our home were fully a domestic church five years from now, what would look different?"]},
 {name:"Money & Stewardship",qs:["Does our spending look like our stated priorities? Where doesn't it?","Is our giving first-fruits, or leftovers?","What financial worry needs to be said out loud and handed to God?"]},
 {name:"Tenderness & Intimacy",qs:["When do you feel most cherished by me — and when least?","Where has our affection gone quiet that we want to wake it up?","Is there anything about our intimacy we've been avoiding talking about?"]},
 {name:"Family & the Future",qs:["What are we hoping for that we haven't said out loud?","How are we forming — or preparing to form — our children in the faith?","Who in our families needs more of us right now?"]},
 {name:"Forgiveness & Old Wounds",qs:["Is there anything from this season I still owe you an apology for?","What wound keeps resurfacing that we should bring to Confession or wise counsel?","Whom do we need to forgive together — including each other?"]},
 {name:"Our Rule of Life",qs:["Which of our commitments are bearing fruit — and which have gone stale?","What should we add, drop, or change for the coming month?","Where is God gently asking us to stretch?"]}];
export const THREE_WORDS=[["please","🙏","Please","Make one request kindly today — ask, don't demand."],["thanks","🌞","Thank you","Say one specific thank-you out loud."],["sorry","🕊","Sorry","Make peace before the sun goes down."]];
export const EXAMEN_Q=["Where did I meet Christ in the people I encountered today?","What am I most grateful for today?","When today did I act out of love — and when out of fear?","What one grace do I need for tomorrow?","Where did I resist God's promptings today?","How did I love my spouse today?","What moment today deserves a second look with God?","Did my day reflect my Plan of Life?"];
export const DEFAULT_PRACTICES=[{id:"p1",name:"Morning Offering",emoji:"🙏",time:"07:00",mins:5,days:[0,1,2,3,4,5,6]},{id:"p2",name:"Holy Mass",emoji:"✝️",time:"08:00",mins:60,days:[0,1,2,3,4,5,6]},{id:"p3",name:"Angelus",emoji:"🔔",time:"12:00",mins:5,days:[0,1,2,3,4,5,6]},{id:"p4",name:"Holy Rosary",emoji:"📿",time:"19:00",mins:20,days:[0,1,2,3,4,5,6]},{id:"p5",name:"Evening Examen",emoji:"🕯️",time:"21:00",mins:10,days:[0,1,2,3,4,5,6]}];
export const DEFAULT_PLAN=[{id:"pl1",text:"Daily Mass"},{id:"pl2",text:"Holy Rosary"},{id:"pl3",text:"Spiritual reading 15 min"},{id:"pl4",text:"Weekly confession"}];
export const VIRTUES=["Faith","Hope","Charity","Prudence","Justice","Fortitude","Temperance","Humility","Patience","Chastity","Diligence","Kindness","Generosity","Meekness","Gratitude","Obedience","Perseverance","Silence & Recollection"];

/* ---------------- tiny utils ---------------- */
export const $=id=>document.getElementById(id);
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const uid6=()=>Array.from({length:6},()=>"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*31)]).join("");
export const rid=()=>Math.random().toString(36).slice(2,10);
export const money=n=>"$"+(+n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
export const fmtT=t=>{if(!t)return"";const[h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";return((h%12)||12)+":"+String(m).padStart(2,"0")+" "+ap;};
export const todayS=()=>ymd(new Date());
export const dayIdx=d=>Math.floor(d.getTime()/864e5);
export function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2400);}
export function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
export function setVal(id,v){const el=$(id);if(el&&document.activeElement!==el)el.value=v??"";}
export function fmtMins(m){if(m<60)return m+" min";const h=Math.floor(m/60);return h+"h"+(m%60?" "+(m%60)+"m":"");}
export function ordinal(n){const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
export const DOWS=["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ---------------- app state + render bus ---------------- */
export const S={user:null,profile:null,hid:null,house:null,state:{},items:[],selDate:todayS(),calCursor:new Date(),mealDay:(new Date().getDay()+6)%7,calFilter:"all",faithTab:"rhythm",shareRefl:false,ci:{scale:0,pray:null,date:null},sdIdx:null,gcalToken:null,gcalConnected:false,unsubs:[]};
window.S=S;
/* views register their render functions on the bus; app.js drives it */
export const bus={render:()=>{}};

/* ---------------- firebase ---------------- */
export const app=initializeApp(FIREBASE_CONFIG);
export const auth=getAuth(app);
let _db;
try{_db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});}
catch(e){_db=initializeFirestore(app,{});}
export const db=_db;
export const provider=new GoogleAuthProvider();

/* ---------------- write helpers ---------------- */
export const stateRef=()=>doc(db,"households",S.hid,"state","main");
export const itemsCol=()=>collection(db,"households",S.hid,"items");
export function saveKey(key,val){setDoc(stateRef(),{[key]:val},{merge:true}).catch(e=>toast(e.message));}
export function saveField(path,val){updateDoc(stateRef(),{[path]:val}).catch(e=>setDoc(stateRef(),{},{merge:true}).then(()=>updateDoc(stateRef(),{[path]:val})).catch(()=>{}));}
export function addItem(data){return addDoc(itemsCol(),{...data,owner:S.user.uid,ownerName:S.profile?.name||"",ownerInitials:S.profile?.initials||"",createdAt:Date.now()}).catch(e=>toast(e.message));}
export function updItem(id,data){return updateDoc(doc(db,"households",S.hid,"items",id),data).catch(e=>toast(e.message));}
export function delItem(id){return deleteDoc(doc(db,"households",S.hid,"items",id)).catch(e=>toast(e.message));}
window.delItem=delItem;window.updItem=updItem;

export const partnerUid=()=>(S.house?.members||[]).find(m=>m!==S.user.uid);
export const partnerName=()=>{const u=partnerUid();return u?profOf(u).name:"your spouse";};
export const profOf=u=>S.house?.profiles?.[u]||{name:"—",initials:"·"};
export const isMine=it=>it.owner===S.user.uid;
export const tagCls=it=>isMine(it)?"":"p2";

/* ---------------- recurrence engine ---------------- */
export function scheduledToday(p,d){const dt=d||new Date();return(p.days||[]).includes(dt.getDay());}
export function doneSet(dateS){return new Set(((S.state.rhythmDone||{})[dateS]||{})[S.user.uid]||[]);}
export function taskOccursOn(t,dateS){
  if(t.kind!=="task")return false;
  if(t.repeat){
    const d=new Date(dateS+"T12:00");
    if(t.repeat.type==="weekly")return (t.repeat.days||[]).includes(d.getDay());
    if(t.repeat.type==="every"){const a=new Date((t.repeat.anchor||dateS)+"T12:00");const diff=Math.round((d-a)/864e5);return diff>=0&&diff%(Math.max(1,t.repeat.n||1))===0;}
    if(t.repeat.type==="monthly"){
      const dom=Math.max(1,Math.min(31,t.repeat.dom||1));
      const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
      return d.getDate()===Math.min(dom,lastDay);
    }
    return false;
  }
  return t.due===dateS;
}
export function taskDoneOn(t,dateS){return t.repeat?!!((t.doneDates||{})[dateS]):!!t.done;}
window.toggleTaskOn=(id,dateS)=>{
  const t=S.items.find(i=>i.id===id);if(!t)return;
  if(t.repeat){const dd={...(t.doneDates||{})};dd[dateS]?delete dd[dateS]:dd[dateS]=true;updItem(id,{doneDates:dd});}
  else updItem(id,{done:!t.done});
};
export function repeatLabel(t){
  if(!t.repeat)return t.due?("Due "+new Date(t.due+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})):"";
  if(t.repeat.type==="weekly")return "↻ "+[1,2,3,4,5,6,0].filter(d=>(t.repeat.days||[]).includes(d)).map(d=>DOWS[d]).join(" · ");
  if(t.repeat.type==="monthly")return "↻ the "+ordinal(t.repeat.dom||1)+" of each month";
  return "↻ every "+t.repeat.n+" days";
}
export function areaTag(t){
  if(t.area==="together")return '<span class="owner-tag">BOTH</span>';
  const p=profOf(t.area);return `<span class="owner-tag ${t.area===S.user.uid?"":"p2"}">${esc(p.initials)}</span>`;
}
export function ensureSection(area,name){
  /* find (or create) a task section in the given area; loose name match */
  const secs=(S.state.taskSections||{})[area]||[];
  const nm=(name||"").toLowerCase().trim();
  let sec=nm?secs.find(s=>(s.name||"").toLowerCase().includes(nm)||nm.includes((s.name||"").toLowerCase())):null;
  if(!sec)sec=secs[0];
  if(!sec){
    const label=name?name.charAt(0).toUpperCase()+name.slice(1):"General";
    sec={id:rid(),name:label,emoji:"📌"};
    saveField("taskSections."+area,secs.concat([sec]));
  }
  return sec;
}
