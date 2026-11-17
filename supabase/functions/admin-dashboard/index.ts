import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  try {
    const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const auth=req.headers.get("Authorization");
    if(!url||!anon||!service||!auth) return reply({error:"Server configuration or session is missing."},401);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await userClient.auth.getUser();
    if(error||!user) return reply({error:"Sign in again."},401);
    if((user.email||"").toLowerCase()!=="imenaking12@gmail.com") return reply({error:"Administrator access required."},403);
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error:scanError}=await admin.rpc("admin_dashboard_snapshot");
    if(scanError) throw scanError;
    return reply(data||{});
  } catch(e) { console.error("admin-dashboard failed",e); return reply({error:"Could not load administrator metrics."},500); }
});