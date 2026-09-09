/* Vita Plena — shared app state. Pure: no Firebase, no DOM at import time, so
   modules that only need S (people, tests) can load it in Node.
   S.user/profile/hid/house/state/items are filled by the realtime listeners in main.js. */
import { todayS } from "./util.js";

export const S={user:null,profile:null,hid:null,house:null,state:{},items:[],selDate:todayS(),calCursor:new Date(),calMode:"month",mealDay:(new Date().getDay()+6)%7,calFilter:"all",shareRefl:false,sdIdx:null,gcalToken:null,gcalConnected:false,unsubs:[],briefing:null};
if(typeof window!=="undefined")window.S=S;

/* views register their render function on the bus; the shell drives it */
export const bus={render:()=>{}};

export const profOf=u=>S.house?.profiles?.[u]||{name:"—",initials:"·"};
export const partnerUid=()=>(S.house?.members||[]).find(m=>m!==S.user?.uid);
export const partnerName=()=>{const u=partnerUid();return u?profOf(u).name:"your spouse";};
export const isMine=it=>it.owner===S.user?.uid;
export const tagCls=it=>isMine(it)?"":"p2";
