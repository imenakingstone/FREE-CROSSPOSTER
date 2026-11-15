import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const APP_ID = "2284146279108911";
const CONFIG_ID = "29317741961178231";
const API_VERSION = "v27.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Sign in first." }, { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Your session is invalid. Sign in again." }, { status: 401, headers: cors });

    const admin = createClient(supabaseUrl, serviceKey);
    const nonce = crypto.randomUUID();
    const origin = req.headers.get("origin") || "";
    const allowedOrigin = /^https?:\/\/(localhost:5173|127\.0\.0\.1:5173)$/.test(origin) || /^https:\/\/[a-z0-9.-]+$/.test(origin);
    if (!allowedOrigin) return Response.json({ error: "Open FREE CROSSPOSTER from its registered website before connecting Instagram." }, { status: 400, headers: cors });
    const { error: stateError } = await admin.from("meta_oauth_states").insert({ nonce, user_id: user.id, return_url: origin });
    if (stateError) throw stateError;

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const authorize = new URL(`https://www.facebook.com/${API_VERSION}/dialog/oauth`);
    authorize.searchParams.set("client_id", APP_ID);
    authorize.searchParams.set("config_id", CONFIG_ID);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("state", nonce);

    return Response.json({ url: authorize.toString(), redirect_uri: redirectUri }, { headers: cors });
  } catch (error) {
    console.error("Meta OAuth start error", error);
    return Response.json({ error: "Could not start Meta login. Check Edge Function configuration." }, { status: 500, headers: cors });
  }
});