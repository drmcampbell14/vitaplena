/* VITA PLENA v4 — gcal.js — Google Calendar sync (pull; two-way arrives in step 3) */
import { GOOGLE_CLIENT_ID, S, ymd, addD, addItem, updItem, delItem, toast, bus } from "./data.js";

let tokenClient=null;
function gisReady(){return typeof google!=="undefined"&&google.accounts&&google.accounts.oauth2;}
export function loadGis(){
  const sc=document.createElement("script");
  sc.src="https://accounts.google.com/gsi/client";sc.async=true;sc.defer=true;
  document.head.appendChild(sc);
}
window.connectGcal=()=>{
  if(!gisReady()){toast("Google sign-in is still loading — try again in a second");return;}
  if(!tokenClient){
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:GOOGLE_CLIENT_ID,
      scope:"https://www.googleapis.com/auth/calendar.readonly",
      callback:async(resp)=>{
        if(resp.error){toast("Calendar access was not granted");return;}
        S.gcalToken=resp.access_token;S.gcalConnected=true;
        bus.render();
        await syncGcal();
      }
    });
  }
  tokenClient.requestAccessToken({prompt:S.gcalToken?"":"consent"});
};
export async function syncGcal(){
  if(!S.gcalToken)return;
  toast("Syncing your Google Calendar…");
  try{
    const tmin=addD(new Date(),-7).toISOString(),tmax=addD(new Date(),90).toISOString();
    let items=[],pageToken="";
    do{
      const u=new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      u.searchParams.set("timeMin",tmin);u.searchParams.set("timeMax",tmax);
      u.searchParams.set("singleEvents","true");u.searchParams.set("orderBy","startTime");u.searchParams.set("maxResults","250");
      if(pageToken)u.searchParams.set("pageToken",pageToken);
      const r=await fetch(u,{headers:{Authorization:"Bearer "+S.gcalToken}});
      if(!r.ok)throw new Error("Google Calendar responded "+r.status);
      const j=await r.json();items=items.concat(j.items||[]);pageToken=j.nextPageToken||"";
    }while(pageToken);
    const seen=new Set();let added=0,updated=0;
    for(const ev of items){
      if(ev.status==="cancelled")continue;
      const startRaw=ev.start?.dateTime||ev.start?.date;if(!startRaw)continue;
      const gid=ev.id+"_"+(startRaw.slice(0,10));
      seen.add(gid);
      const date=startRaw.slice(0,10);
      const time=ev.start?.dateTime?startRaw.slice(11,16):"";
      const data={kind:"event",title:ev.summary||"(no title)",date,time,location:ev.location||"",source:"gcal",gcalId:gid};
      const existing=S.items.find(i=>i.kind==="event"&&i.gcalId===gid&&i.owner===S.user.uid);
      if(existing){
        if(existing.title!==data.title||existing.date!==data.date||existing.time!==data.time||existing.location!==data.location){await updItem(existing.id,data);updated++;}
      }else{await addItem(data);added++;}
    }
    const tminS=ymd(addD(new Date(),-7)),tmaxS=ymd(addD(new Date(),90));
    const stale=S.items.filter(i=>i.kind==="event"&&i.source==="gcal"&&i.owner===S.user.uid&&i.date>=tminS&&i.date<=tmaxS&&!seen.has(i.gcalId));
    for(const st of stale)await delItem(st.id);
    toast(`Calendar synced — ${added} new, ${updated} updated${stale.length?", "+stale.length+" removed":""}`);
  }catch(e){toast("Sync problem: "+e.message);}
}
