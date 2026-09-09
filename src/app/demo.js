/* Vita Plena — preview mode.
   Open the app with ?demo=1 to load a sample household entirely in memory: no
   sign-in, no Firestore. Reads and writes work for the session and vanish on
   reload. Used for screenshots, for the App Store reviewers' demo account, and
   for smoke-testing every screen in a headless browser. */
import { S, todayS, ymd, addD, DEFAULT_PLAN } from "../core/data.js";

export function isDemo(){ return new URLSearchParams(location.search).get("demo")==="1"; }

export function loadDemo(){
  const me="demo-mitch", her="demo-liz", today=todayS();
  const d=n=>ymd(addD(new Date(),n));
  S.demo=true;
  S.user={uid:me,displayName:"Mitch Campbell",email:"mitch@example.com",getIdToken:async()=>"demo"};
  S.hid="demo-household";
  S.house={name:"The Campbell Household",code:"ADVENT",owner:me,members:[me,her],profiles:{[me]:{name:"Mitch",initials:"MC"},[her]:{name:"Liz",initials:"LC"}},countdown:{label:"Advent begins",date:"2026-11-29"},subscription:{status:"trial",plan:"family",source:"none",trialEndsAt:d(21)}};
  S.briefing={weekOf:d(-((new Date().getDay())||7)),text:"Mitch and Liz, the week opens in Ordinary Time and closes with the Exaltation of the Holy Cross on Sunday. Clinic runs both blocks on Tuesday and Thursday; the Kellys come Tuesday evening, so the Rosary moves to after dinner that night. Anna's CCD sign-up is due Friday, and the case notes are already a day behind. Keep the Rosary each evening and let the rest fall in around it; a house that prays at seven o'clock has already won the day."};
  S.profile=S.house.profiles[me];
  S.state={
    wake:"06:30",marriageRhythm:"weekly",
    practices:[
      {id:"p1",name:"Morning Offering",emoji:"🙏",time:"06:30",mins:5,days:[0,1,2,3,4,5,6]},
      {id:"p6",name:"Scripture / Lectio",emoji:"📖",time:"06:50",mins:15,days:[1,2,3,4,5]},
      {id:"p3",name:"Angelus",emoji:"🔔",time:"12:00",mins:5,days:[0,1,2,3,4,5,6]},
      {id:"p7",name:"Divine Mercy Chaplet",emoji:"🕊️",time:"15:00",mins:10,days:[5]},
      {id:"p4",name:"Family Rosary",emoji:"📿",time:"19:00",mins:20,days:[0,1,2,3,4,5,6]},
      {id:"p5",name:"Evening Examen",emoji:"🕯️",time:"21:00",mins:10,days:[0,1,2,3,4,5,6]}
    ],
    rhythmDone:{[today]:{[me]:["p1","p6"],[her]:["p1"]}},
    plan:DEFAULT_PLAN,
    taskSections:{[me]:[{id:"s1",name:"Clinic",emoji:"🩺"}],together:[{id:"s2",name:"Household",emoji:"🏡"},{id:"s3",name:"Faith",emoji:"✝️"}]},
    focus:[{id:"f1",text:"Finish the case notes by Thursday",done:false},{id:"f2",text:"Call Fr. Michael about the baptism",done:true}],
    countdowns:[{id:"c1",label:"Liz's birthday",date:d(23)}],
    confession:{[me]:{cadence:14,log:[d(-9)]}},
    people:[{id:"k1",name:"Anna",emoji:"👧",role:"child"},{id:"k2",name:"Joseph",emoji:"👦",role:"child"},{id:"k3",name:"Gordie",emoji:"🐕",role:"pet"}],
    famSections:[{id:"fm1",name:"Gordie",emoji:"🐕",notes:[]}],
    virtue:{name:"Patience",res:"Count to three before answering the kids."},
    meals:{1:{b:"Oatmeal",l:"Leftovers",d:"Chicken and rice"},4:{b:"",l:"",d:"Fish tacos"}},
    grocery:[{id:"g1",text:"Eggs",done:false},{id:"g2",text:"Coffee",done:true}],
    budget:{income:[{id:"b1",name:"Clinic",amt:9000}],expense:[{id:"b2",name:"Tithe",amt:900},{id:"b3",name:"Mortgage",amt:2400},{id:"b4",name:"Groceries",amt:900}],savings:[{id:"b5",name:"Emergency fund",amt:500}]},
    funds:[{id:"fd1",name:"Ponte Vedra practice fund",goal:50000,saved:18500}],debts:[],
    modules:{meals:true,finance:true,family:true,notes:true},
    threeWords:{[today]:{[me]:["thanks"]}}
  };
  const item=(o)=>({id:"i"+Math.random().toString(36).slice(2,8),owner:me,ownerName:"Mitch",ownerInitials:"MC",createdAt:Date.now()-Math.floor(Math.random()*8.64e7),...o});
  S.items=[
    item({kind:"event",title:"Clinic",date:today,time:"08:00",endTime:"12:00",area:me,source:"manual"}),
    item({kind:"event",title:"Clinic",date:today,time:"14:00",endTime:"18:00",area:me,source:"manual"}),
    item({kind:"event",title:"Dinner with the Kellys",date:today,time:"18:30",area:"together",location:"Home",source:"manual"}),
    item({kind:"event",title:"Evening with Liz",date:today,time:"20:00",area:"together",protected:true,source:"manual"}),
    item({kind:"event",title:"Liz · Pilates",date:today,time:"06:00",area:her,owner:her,ownerName:"Liz",ownerInitials:"LC",source:"gcal",gcalId:"g1"}),
    item({kind:"event",title:"Holy Mass",date:d(1),time:"08:00",area:"together",source:"manual"}),
    item({kind:"event",title:"Parish council",date:d(2),time:"19:00",area:me,source:"manual"}),
    item({kind:"task",text:"Vacuum",area:me,sectionId:"s2",repeat:{type:"weekly",days:[2]},doneDates:{},done:false}),
    item({kind:"task",text:"Order dog food",area:me,sectionId:"s2",due:today,whenHint:"evening",repeat:null,doneDates:{},done:false}),
    item({kind:"task",text:"Sign the kids up for CCD",area:her,owner:her,ownerName:"Liz",ownerInitials:"LC",sectionId:"s3",due:d(3),repeat:null,doneDates:{},done:false}),
    item({kind:"task",text:"Plan Advent wreath night",area:"together",sectionId:"s3",due:d(10),repeat:null,doneDates:{},done:false}),
    item({kind:"task",text:"Case notes",area:me,sectionId:"s1",due:d(-1),repeat:null,doneDates:{},done:false}),
    item({kind:"task",text:"Wash the dogs",area:"together",sectionId:"s2",repeat:{type:"every",n:14,anchor:d(-3)},doneDates:{},done:false}),
    item({kind:"task",text:"Feed Gordie",area:"p:k1",rotate:["p:k1","p:k2"],sectionId:"s2",repeat:{type:"weekly",days:[0,1,2,3,4,5,6]},doneDates:{},done:false}),
    item({kind:"task",text:"Set the table",area:"p:k2",rotate:["p:k2","p:k1"],sectionId:"s2",repeat:{type:"weekly",days:[0,1,2,3,4,5,6]},doneDates:{[today]:true},done:false}),
    item({kind:"task",text:"Empty the dishwasher",area:"p:k1",sectionId:"s2",repeat:{type:"weekly",days:[1,3,5]},doneDates:{},done:false}),
    item({kind:"book",title:"Introduction to the Devout Life",author:"St. Francis de Sales",start:d(-12),goal:15,log:{[d(-3)]:15,[d(-2)]:20,[d(-1)]:15},notes:[],finished:false}),
    item({kind:"examen",text:"Short with the kids at bedtime. Grateful for the quiet drive home."}),
    item({kind:"checkin",scale:4,pray:true,dateNight:false,appr:"You handled the insurance call so I didn't have to.",well:"",god:"",name:"",need:""}),
    item({kind:"sharedtodo",text:"Book the retreat weekend",done:false}),
    item({kind:"reflection",text:"He was closest in the kitchen at 6 AM when nobody else was up.",shared:true}),
    item({kind:"famsec",name:"Gordie",emoji:"🐕",items:[{label:"Vet",value:"Dr. Alvarez · 904-555-0192"},{label:"Food",value:"Purina Pro Plan, 2 cups"}]}),
    item({kind:"note",title:"Our why",body:"A house ordered toward God, where the kids grow up hearing the bells.",shared:true}),
    item({kind:"spend",desc:"Aldi run",amount:142.18,cat:"Groceries",date:today})
  ];
  S.gcalConnected=true;
}
