import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const API_VERSION="v27.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function decode(v:string){return Uint8Array.from(atob(v),c=>c.charCodeAt(0))}
async function decryptToken(value:string){
  const encoded=Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if(!encoded)throw new Error("Token encryption is not configured.");
  const raw=decode(encoded),packed=decode(value);
  if(raw.length!==32||packed.length<29)throw new Error("Stored social token is invalid.");
  const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:packed.slice(0,12)},key,packed.slice(12));
  return new TextDecoder().decode(plain);
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Method not allowed."},405);
  try{
    const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const auth=req.headers.get("Authorization");
    if(!url||!anon||!service||!auth)return reply({error:"Sign in first."},401);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await userClient.auth.getUser();
    if(userError||!user)return reply({error:"Your session expired. Sign in again."},401);
    const body=await req.json();
    const conversationId=String(body?.conversation_id||"");
    const text=typeof body?.text==="string"?body.text.trim():"";
    if(!conversationId||!text||text.length>2000)return reply({error:"Choose a conversation and enter a message (maximum 2,000 characters)."},400);
    const {data:conversation,error:conversationError}=await userClient.from("inbox_conversations")
      .select("id,user_id,social_account_id,platform,participant_id,last_inbound_at")
      .eq("id",conversationId).eq("user_id",user.id).single();
    if(conversationError||!conversation)return reply({error:"Conversation not found."},404);
    const inboundAt=conversation.last_inbound_at?new Date(conversation.last_inbound_at).getTime():0;
    if(!inboundAt||Date.now()-inboundAt>24*60*60*1000)return reply({error:"The standard 24-hour reply window has expired. This app does not send outside the permitted window."},403);
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:account,error:accountError}=await admin.from("social_accounts")
      .select("id,user_id,platform,platform_user_id,access_token_encrypted,account_status,environment")
      .eq("id",conversation.social_account_id).eq("user_id",user.id).eq("account_status","connected").eq("environment","production").single();
    if(accountError||!account||account.platform!==conversation.platform||!account.access_token_encrypted)return reply({error:"The connected social account is unavailable. Reconnect it and try again."},409);
    const accessToken=await decryptToken(account.access_token_encrypted);
    const endpoint=conversation.platform==="instagram"
      ? `https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(account.platform_user_id)}/messages`
      : `https://graph.facebook.com/${API_VERSION}/me/messages`;
    const apiUrl=new URL(endpoint);
    apiUrl.searchParams.set("access_token",accessToken);
    const payload:any={recipient:{id:conversation.participant_id},message:{text}};
    if(conversation.platform==="facebook")payload.messaging_type="RESPONSE";
    const response=await fetch(apiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      const code=result?.error?.code;
      const subcode=result?.error?.error_subcode;
      console.warn("Meta send-message rejected",{platform:conversation.platform,status:response.status,code,subcode});
      const explanation=code===10||code===200
        ?"Meta has not granted this account the required messaging permission yet. Complete Meta App Review and reconnect the account."
        :code===551||subcode===2534037
        ?"Meta rejected this reply because the messaging window or conversation permissions do not allow it."
        :"Meta did not accept the message. Check the account's messaging permissions and try again.";
      return reply({error:explanation,provider_code:code||null},502);
    }
    const platformMessageId=String(result?.message_id||result?.id||`sent_${crypto.randomUUID()}`);
    const sentAt=new Date().toISOString();
    const {error:saveError}=await admin.from("inbox_messages").upsert({
      user_id:user.id,conversation_id:conversation.id,platform_message_id:platformMessageId,
      direction:"outbound",sender_id:account.platform_user_id,message_text:text,
      attachments:[],delivery_status:"sent",sent_at:sentAt
    },{onConflict:"conversation_id,platform_message_id",ignoreDuplicates:true});
    if(saveError)console.error("Message sent but local message record could not be saved",saveError);
    const {error:updateError}=await admin.from("inbox_conversations").update({
      last_message_text:text,last_message_at:sentAt,updated_at:sentAt
    }).eq("id",conversation.id).eq("user_id",user.id);
    if(updateError)console.error("Message sent but conversation preview could not be updated",updateError);
    return reply({sent:true,message_id:platformMessageId,sync_warning:Boolean(saveError||updateError)});
  }catch(error){
    console.error("meta-send-message error",error);
    return reply({error:error instanceof Error?error.message:"Message could not be sent."},500);
  }
});