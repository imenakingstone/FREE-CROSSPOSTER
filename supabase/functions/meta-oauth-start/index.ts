import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const APP_ID = "2284146279108911";
const CONFIG_ID = "29317741961178231";
const API_VERSION = "v27.0";
const ALLOWED_ORIGINS = new Set([
  "https://free-crossposter-zcpn.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://free-crossposter-zcpn.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });

  try {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return Response.json({ error: "Open FREE CROSSPOSTER from its registered website before connecting Instagram." }, { status: 403, headers });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Sign in first." }, { status: 401, headers });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Your session is invalid. Sign in again." }, { status: 401, headers });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const nonce = crypto.randomUUID();
    const { error: stateError } = await admin.from("meta_oauth_states").insert({
      nonce,
      user_id: user.id,
      return_url: origin,
    });
    if (stateError) throw stateError;

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const authorize = new URL(`https://www.facebook.com/${API_VERSION}/dialog/oauth`);
    authorize.searchParams.set("client_id", APP_ID);
    authorize.searchParams.set("config_id", CONFIG_ID);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("state", nonce);

    return Response.json({ url: authorize.toString(), redirect_uri: redirectUri }, { headers });
  } catch (error) {
    console.error("Meta OAuth start error", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Could not start Meta login. Check Edge Function configuration." }, { status: 500, headers });
  }
});
