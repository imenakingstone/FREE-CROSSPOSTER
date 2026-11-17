import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  try {
    const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), auth=req.headers.get("Authorization");
    if(!url||!anon||!service||!auth) return reply({error:"Session unavailable."},401);
    const client=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user) return reply({error:"Sign in again."},401);
    const body=await req.json().catch(()=>({}));
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    if(body?.online===false) {
      const {error:deleteError}=await admin.from("user_presence").delete().eq("user_id",user.id);
      if(deleteError) throw deleteError;
      return reply({online:false});
    }
    const now=new Date().toISOString();
    const {error:upsertError}=await admin.from("user_presence").upsert({user_id:user.id,last_seen_at:now,updated_at:now},{onConflict:"user_id"});
    if(upsertError) throw upsertError;
    return reply({online:true,checked_at:now});
  } catch(e) { console.error("presence-heartbeat failed",e); return reply({error:"Presence update failed."},500); }
});