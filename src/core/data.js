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

/* Pure modules split out so they can be unit-tested without Firebase or a DOM.
   Everything is re-exported here so consumers keep importing from data.js. */
import { todayS, esc, rid, toast } from "./util.js";
import { season } from "./liturgical.js";
export * from "./util.js";
export * from "./liturgical.js";
export * from "./recurrence.js";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection } from "firebase/firestore";

/* ---------------- liturgical engine (season is a text detail now, not the theme) ---------------- */

/* ---------------- constants (ported verbatim from v3) ---------------- */
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
export function doneSet(dateS){return new Set(((S.state.rhythmDone||{})[dateS]||{})[S.user.uid]||[]);}
window.toggleTaskOn=(id,dateS)=>{
  const t=S.items.find(i=>i.id===id);if(!t)return;
  if(t.repeat){const dd={...(t.doneDates||{})};dd[dateS]?delete dd[dateS]:dd[dateS]=true;updItem(id,{doneDates:dd});}
  else updItem(id,{done:!t.done});
};
export function areaTag(t){
  if(t.area==="together")return '<span class="owner-tag">BOTH</span>';
  const p=profOf(t.area);return `<span class="owner-tag ${t.area===S.user.uid?"":"p2"}">${esc(p.initials)}</span>`;
}
export function ensureSection(area,name){
  /* projects are household-wide: match by name across every area; create under "together" */
  const byArea=S.state.taskSections||{};
  const all=Object.keys(byArea).flatMap(a=>byArea[a]||[]);
  const nm=(name||"").toLowerCase().trim();
  let sec=nm?all.find(s=>(s.name||"").toLowerCase().includes(nm)||nm.includes((s.name||"").toLowerCase())):null;
  if(!sec)sec=all.find(s=>(s.name||"").toLowerCase()==="general")||all[0];
  if(!sec){
    const label=name?name.charAt(0).toUpperCase()+name.slice(1):"General";
    sec={id:rid(),name:label,emoji:"📌"};
    saveField("taskSections.together",(byArea.together||[]).concat([sec]));
  }
  return sec;
}


/* ---------------- prayer library (traditional texts, tap-to-pray) ---------------- */
const P_HAILMARY="Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.";
export const PRAYER_LIB=[
 {id:"offering",match:["morning offering","offering"],emoji:"🙏",title:"The Morning Offering",
  body:`<p>O Jesus, through the Immaculate Heart of Mary, I offer You my prayers, works, joys, and sufferings of this day, for all the intentions of Your Sacred Heart, in union with the Holy Sacrifice of the Mass throughout the world, in reparation for my sins, for the intentions of all my relatives and friends, and in particular for the intentions of the Holy Father. Amen.</p>`},
 {id:"angelus",match:["angelus"],emoji:"🔔",title:"The Angelus",
  body:`<p><b>V.</b> The Angel of the Lord declared unto Mary,<br><b>R.</b> And she conceived of the Holy Spirit.</p>
<p><i>${P_HAILMARY}</i></p>
<p><b>V.</b> Behold the handmaid of the Lord,<br><b>R.</b> Be it done unto me according to thy word.</p>
<p><i>Hail Mary…</i></p>
<p><b>V.</b> And the Word was made flesh,<br><b>R.</b> And dwelt among us.</p>
<p><i>Hail Mary…</i></p>
<p><b>V.</b> Pray for us, O holy Mother of God,<br><b>R.</b> That we may be made worthy of the promises of Christ.</p>
<p><b>Let us pray:</b> Pour forth, we beseech Thee, O Lord, Thy grace into our hearts, that we, to whom the Incarnation of Christ Thy Son was made known by the message of an angel, may by His Passion and Cross be brought to the glory of His Resurrection. Through the same Christ our Lord. Amen.</p>`},
 {id:"reginacaeli",match:[],emoji:"🔔",title:"Regina Caeli",
  note:"During Eastertide, the Regina Caeli replaces the Angelus.",
  body:`<p><b>V.</b> Queen of Heaven, rejoice, alleluia.<br><b>R.</b> For He whom thou didst merit to bear, alleluia.</p>
<p><b>V.</b> Hath risen as He said, alleluia.<br><b>R.</b> Pray for us to God, alleluia.</p>
<p><b>V.</b> Rejoice and be glad, O Virgin Mary, alleluia.<br><b>R.</b> For the Lord hath truly risen, alleluia.</p>
<p><b>Let us pray:</b> O God, who through the Resurrection of Thy Son, our Lord Jesus Christ, didst vouchsafe to give joy to the world: grant, we beseech Thee, that through His Mother, the Virgin Mary, we may obtain the joys of everlasting life. Through the same Christ our Lord. Amen.</p>`},
 {id:"night",match:["night prayer","night prayers","evening prayer","compline","bedtime"],emoji:"🌙",title:"Night Prayers",
  body:`<p><b>Act of Contrition</b></p>
<p>O my God, I am heartily sorry for having offended Thee, and I detest all my sins because I dread the loss of Heaven and the pains of hell; but most of all because they offend Thee, my God, Who art all-good and deserving of all my love. I firmly resolve, with the help of Thy grace, to confess my sins, to do penance, and to amend my life. Amen.</p>
<p><b>Commendation</b></p>
<p>Into Thy hands, O Lord, I commend my spirit. Protect us, Lord, as we stay awake; watch over us as we sleep: that awake, we may keep watch with Christ, and asleep, rest in His peace.</p>
<p>May the Lord grant us a quiet night and a peaceful death. Amen.</p>
<p><i>Our Father… Hail Mary… Glory be…</i></p>`}
];
export function findPrayer(name){
  const n=(name||"").toLowerCase();
  let hit=PRAYER_LIB.find(pr=>pr.match.some(m=>n.includes(m)));
  if(hit&&hit.id==="angelus"&&season(new Date()).name==="Easter")hit=PRAYER_LIB.find(pr=>pr.id==="reginacaeli");
  return hit||null;
}
