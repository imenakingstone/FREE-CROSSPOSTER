import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:cors});
  try{
    const h=req.headers.get("Authorization");
    if(!h)throw new Error("Sign in first.");
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const c=createClient(url,anon,{global:{headers:{Authorization:h}}});
    const {data,error}=await c.auth.getUser();
    if(error||!data.user)throw new Error("Session expired.");
    const body=await req.json().catch(()=>({}));
    const environment=body?.environment==="sandbox"?"sandbox":"production";
    const prefix=environment==="sandbox"?"TIKTOK_SANDBOX":"TIKTOK";
    const key=Deno.env.get(prefix+"_CLIENT_KEY");
    const secret=Deno.env.get(prefix+"_CLIENT_SECRET");
    if(!key||!secret)throw new Error(environment==="sandbox"?"Add TIKTOK_SANDBOX_CLIENT_KEY and TIKTOK_SANDBOX_CLIENT_SECRET to Supabase Edge Function secrets first.":"TikTok Client Key and Client Secret must be added to Supabase Edge Function secrets first.");
    const nonce=crypto.randomUUID();
    const admin=createClient(url,service);
    const {error:se}=await admin.from("meta_oauth_states").insert({nonce,user_id:data.user.id,return_url:"tiktok:"+environment});
    if(se)throw se;
    const redirect=`${url}/functions/v1/tiktok-oauth-callback`;
    const u=new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.searchParams.set("client_key",key);
    u.searchParams.set("response_type","code");
    u.searchParams.set("scope","user.info.basic,video.publish");
    u.searchParams.set("redirect_uri",redirect);
    u.searchParams.set("state",nonce);
    return Response.json({url:u.toString(),environment},{headers:cors});
  }catch(e){return Response.json({error:e instanceof Error?e.message:"Could not start TikTok authorization."},{status:400,headers:cors})}
});