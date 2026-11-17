import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const API_VERSION = "v27.0";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
function equalHex(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function validSignature(body:string,signature:string,secret:string){
  if(!signature.startsWith("sha256="))return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body)));
  const hex=Array.from(digest).map(v=>v.toString(16).padStart(2,"0")).join("");
  return equalHex(hex,signature.slice(7).toLowerCase());
}
Deno.serve(async(req:Request)=>{
  const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(req.method==="GET"){
    const verifyToken=Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if(!verifyToken)return new Response("Webhook verification token is not configured.",{status:503});
    const u=new URL(req.url);
    const mode=u.searchParams.get("hub.mode")||u.searchParams.get("hub_mode");
    const token=u.searchParams.get("hub.verify_token")||u.searchParams.get("hub_verify_token");
    const challenge=u.searchParams.get("hub.challenge")||u.searchParams.get("hub_challenge");
    if(mode==="subscribe"&&token===verifyToken&&challenge)return new Response(challenge,{status:200});
    return new Response("Forbidden",{status:403});
  }
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  try{
    const appSecret=Deno.env.get("META_APP_SECRET");
    if(!url||!service||!appSecret)return json({error:"Webhook server configuration is incomplete."},503);
    const raw=await req.text();
    const signature=req.headers.get("x-hub-signature-256")||"";
    if(!await validSignature(raw,signature,appSecret))return json({error:"Invalid webhook signature."},401);
    const payload=JSON.parse(raw);
    const object=String(payload?.object||"");
    const platform=object==="instagram"?"instagram":object==="page"?"facebook":null;
    if(!platform)return json({received:true,ignored:true});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    let saved=0, ignored=0;
    for(const entry of (Array.isArray(payload?.entry)?payload.entry:[])){
      const accountId=String(entry?.id||"");
      if(!accountId){ignored++;continue;}
      const {data:accounts,error:accountError}=await admin.from("social_accounts")
        .select("id,user_id,platform_user_id").eq("platform",platform).eq("platform_user_id",accountId).eq("environment","production").eq("account_status","connected");
      if(accountError)throw accountError;
      if(!accounts?.length){ignored++;continue;}
      const events=Array.isArray(entry?.messaging)?entry.messaging:[];
      for(const event of events){
        const message=event?.message;
        const mid=message?.mid;
        if(!message||!mid){ignored++;continue;}
        for(const account of accounts){
          const isEcho=message.is_echo===true||String(event?.sender?.id||"")===accountId;
          const participantId=String(isEcho?event?.recipient?.id||"":event?.sender?.id||"");
          if(!participantId){ignored++;continue;}
          const sentAt=Number(event.timestamp)>0?new Date(Number(event.timestamp)).toISOString():new Date().toISOString();
          const text=typeof message.text==="string"?message.text:"";
          const attachments=Array.isArray(message.attachments)?message.attachments:[];
          const preview=text||(attachments.length?"Attachment":"New message");
          const convPayload:any={
            user_id:account.user_id,social_account_id:account.id,platform,
            platform_conversation_id:participantId,participant_id:participantId,
            last_message_text:preview,last_message_at:sentAt,updated_at:new Date().toISOString()
          };
          if(!isEcho)convPayload.last_inbound_at=sentAt;
          const {data:conversation,error:convError}=await admin.from("inbox_conversations")
            .upsert(convPayload,{onConflict:"social_account_id,platform_conversation_id"})
            .select("id,unread_count").single();
          if(convError)throw convError;
          const {data:inserted,error:messageError}=await admin.from("inbox_messages")
            .upsert({
              user_id:account.user_id,conversation_id:conversation.id,platform_message_id:String(mid),
              direction:isEcho?"outbound":"inbound",sender_id:String(event?.sender?.id||""),
              message_text:text||null,attachments,delivery_status:isEcho?"sent":"received",sent_at:sentAt
            },{onConflict:"conversation_id,platform_message_id",ignoreDuplicates:true})
            .select("id");
          if(messageError)throw messageError;
          if(inserted?.length){
            if(!isEcho){
              const {error:updateError}=await admin.from("inbox_conversations").update({unread_count:Number(conversation.unread_count||0)+1}).eq("id",conversation.id);
              if(updateError)throw updateError;
            }
            saved++;
          }
        }
      }
    }
    return json({received:true,saved,ignored});
  }catch(error){
    console.error("meta-messaging-webhook processing error",error);
    return json({error:"Webhook event could not be processed."},500);
  }
});