(()=>{"use strict";
const STORAGE_KEY="souviks:attribution:v1";
const ALLOWED_CHANNELS=new Set(["organic_search","paid_search","paid_social","paid_media","social","referral","email","direct","whatsapp","phone","offline","unknown","other"]);
let memoryState=null;
const clean=(value,max=120)=>String(value??"").replace(/https?:\/\/\S+/gi,"").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/[<>]/g,"").trim().slice(0,max);
const safePath=value=>{try{return new URL(value,window.location.origin).pathname.slice(0,500)||"/"}catch{return "/"}};
const safeHost=value=>{try{return new URL(value).hostname.toLowerCase().slice(0,160)}catch{return ""}};
const sanitizeTouch=touch=>({
 channel:ALLOWED_CHANNELS.has(touch?.channel)?touch.channel:"unknown",
 source:clean(touch?.source,120)||"unknown",
 medium:clean(touch?.medium,120)||"unknown",
 campaign:clean(touch?.campaign,120),
 term:clean(touch?.term,120),
 content:clean(touch?.content,120),
 referrer_host:clean(touch?.referrer_host,160),
 landing_page:safePath(touch?.landing_page||"/")
});
const readState=()=>{if(memoryState)return memoryState;try{const raw=window.localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed&&typeof parsed==="object"&&parsed.firstTouch&&parsed.lastTouch){memoryState={firstTouch:sanitizeTouch(parsed.firstTouch),lastTouch:sanitizeTouch(parsed.lastTouch)};return memoryState}}}catch{}return null};
const saveState=state=>{memoryState=state;try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{}};
const inferChannel=(source,medium,clickId)=>{
 const s=String(source||"").toLowerCase(),m=String(medium||"").toLowerCase();
 if(clickId==="gclid"||clickId==="msclkid"||/^(cpc|ppc|paid.?search|sem)$/.test(m))return "paid_search";
 if(clickId==="fbclid"||clickId==="ttclid"||/paid.?social|social.?paid/.test(m))return "paid_social";
 if(/email/.test(m))return "email";
 if(/organic/.test(m))return "organic_search";
 if(/social/.test(m))return "social";
 if(/^(display|banner|cpm|paid|paid.?media|ads)$/.test(m))return "paid_media";
 if(/^(google|bing|yahoo|duckduckgo|baidu|yandex)$/.test(s)&&m==="organic")return "organic_search";
 return source||medium?"other":"direct";
};
const detectTouch=()=>{
 const currentUrl=new URL(window.location.href),params=currentUrl.searchParams;
 let source=clean(params.get("utm_source"),120),medium=clean(params.get("utm_medium"),120);
 const campaign=clean(params.get("utm_campaign"),120),term=clean(params.get("utm_term"),120),content=clean(params.get("utm_content"),120);
 let clickId="";
 if(params.has("gclid")){source=source||"google";medium=medium||"cpc";clickId="gclid"}
 else if(params.has("msclkid")){source=source||"microsoft";medium=medium||"cpc";clickId="msclkid"}
 else if(params.has("fbclid")){source=source||"facebook";medium=medium||"paid_social";clickId="fbclid"}
 else if(params.has("ttclid")){source=source||"tiktok";medium=medium||"paid_social";clickId="ttclid"}
 const referrerHost=safeHost(document.referrer),siteHost=window.location.hostname.toLowerCase();
 let channel=inferChannel(source,medium,clickId);
 if(!source&&!medium&&!campaign&&!term&&!content&&!clickId&&referrerHost&&referrerHost!==siteHost&&!referrerHost.endsWith("."+siteHost)){
  if(/(^|\.)((google|bing|yahoo|duckduckgo|baidu|yandex)\.[a-z.]+)$/.test(referrerHost)){
   channel="organic_search";
   source=(referrerHost.match(/(google|bing|yahoo|duckduckgo|baidu|yandex)/)||[])[1]||referrerHost;
   medium="organic";
  }else{channel="referral";source=referrerHost;medium="referral"}
 }
 if(channel==="direct"){source=source||"direct";medium=medium||"none"}
 if(source&&!medium)medium="unknown";
 return sanitizeTouch({channel,source:source||"unknown",medium:medium||"unknown",campaign,term,content,referrer_host:referrerHost,landing_page:currentUrl.pathname});
};
const currentTouch=detectTouch();
let state=readState();
if(!state){state={firstTouch:currentTouch,lastTouch:currentTouch};saveState(state)}
else if(currentTouch.channel!=="direct"){state={firstTouch:state.firstTouch,lastTouch:currentTouch};saveState(state)}
const getPayload=()=>{
 const latest=sanitizeTouch(state?.lastTouch||currentTouch);
 const first=sanitizeTouch(state?.firstTouch||currentTouch);
 const effective=latest.channel!=="direct"?latest:first;
 const path=safePath(window.location.pathname);
 return {
  source_channel:effective.channel,source:effective.source,medium:effective.medium,campaign:effective.campaign||null,term:effective.term||null,content:effective.content||null,referrer_host:effective.referrer_host||null,landing_page:effective.landing_page||path,conversion_page:path,
  first_touch_channel:first.channel,first_touch_source:first.source,first_touch_medium:first.medium,first_touch_campaign:first.campaign||null,first_touch_term:first.term||null,first_touch_content:first.content||null,first_touch_referrer_host:first.referrer_host||null,first_touch_landing_page:first.landing_page,
  last_touch_channel:latest.channel,last_touch_source:latest.source,last_touch_medium:latest.medium,last_touch_campaign:latest.campaign||null,last_touch_term:latest.term||null,last_touch_content:latest.content||null,last_touch_referrer_host:latest.referrer_host||null,last_touch_landing_page:latest.landing_page
 };
};
const plain=(value,max=4000)=>String(value??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g," ").replace(/[<>]/g,"").trim().slice(0,max);
const recordLead=async(reference,leadType,details={})=>{
 const ref=clean(reference,60),type=clean(leadType,40);
 if(!/^(ENQ|RFQ)-[0-9]{10,20}$/.test(ref)||!["contact","request_part","rfq_guest"].includes(type))return {recorded:false,reason:"invalid_reference_or_type"};
 try{
  if(typeof supabaseClient==="undefined"||!supabaseClient?.rpc)return {recorded:false,reason:"analytics_unavailable"};
  const sourceDetails=details&&typeof details==="object"?details:{};
  const itemLabels=[["Vehicle",sourceDetails.vehicle],["Urgency",sourceDetails.urgency],["Part number",sourceDetails.partnumber||sourceDetails.part_number],["Requirement",sourceDetails.requirement],["Message",sourceDetails.message],["Location",sourceDetails.location],["Requested items",sourceDetails.rfq_items]];
  const leadDetails=plain(sourceDetails.lead_details||itemLabels.filter(([label,value])=>value).map(([label,value])=>label+": "+String(value)).join("\n"),4000);
  const p_details={
   customer_name:plain(sourceDetails.name||sourceDetails.customer_name,120),
   customer_phone:plain(sourceDetails.phone||sourceDetails.customer_phone,40),
   customer_email:plain(sourceDetails.email||sourceDetails.customer_email,254),
   company:plain(sourceDetails.company,160),
   lead_details:leadDetails
  };
  const {data,error}=await supabaseClient.rpc("record_website_lead_details",{p_lead_reference:ref,p_lead_type:type,p_attribution:getPayload(),p_details});
  if(error){window.SouviksErrors?.log("[Souviks Attribution] Lead recording failed.",error,"warn");return {recorded:false,reason:"rpc_error"}}
  return data&&typeof data==="object"?data:{recorded:false,reason:"empty_response"};
 }catch(error){window.SouviksErrors?.log("[Souviks Attribution] Lead recording failed.",error,"warn");return {recorded:false,reason:"exception"}}
};
window.SouviksAttribution={getPayload,recordLead};
})();