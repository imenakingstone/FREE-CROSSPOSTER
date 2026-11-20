import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const VERSION = "v27.0";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function decode(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
async function decrypt(value: string) {
  const encoded = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("Token encryption is not configured.");
  const keyBytes = decode(encoded), packed = decode(value);
  if (keyBytes.length !== 32 || packed.length < 29) throw new Error("Stored token is invalid.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return new TextDecoder().decode(plain);
}
async function probe(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL("https://graph.facebook.com/" + VERSION + "/" + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(12000) });
    const body = await response.json().catch(() => ({}));
    const result: any = { http_status: response.status, ok: response.ok };
    if (body?.error) result.error = { code: body.error.code ?? null, subcode: body.error.error_subcode ?? null, type: body.error.type ?? null, message: String(body.error.message || "Meta API error").slice(0, 350) };
    if (Array.isArray(body?.data)) result.data = body.data.map((item: any) => ({
      id: item?.id ? String(item.id) : null,
      name: item?.name ? String(item.name) : null,
      username: item?.username ? String(item.username) : null,
      tasks: Array.isArray(item?.tasks) ? item.tasks : undefined,
      instagram_business_account: item?.instagram_business_account?.id ? String(item.instagram_business_account.id) : undefined
    }));
    else if (body?.id) result.data = { id: String(body.id), name: body.name ? String(body.name) : undefined, username: body.username ? String(body.username) : undefined };
    return result;
  } catch (error) {
    return { http_status: 0, ok: false, error: { message: error instanceof Error ? error.message : "Network request failed" } };
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anon || !service || !authorization) return json({ error: "Sign in first." }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session expired. Sign in again." }, 401);
    if (user.email?.toLowerCase() !== "imenaking12@gmail.com") return json({ error: "This diagnostic is restricted to the workspace administrator." }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: account, error: accountError } = await admin.from("social_accounts")
      .select("id,platform_user_id,username,access_token_encrypted,scopes,auth_method,token_type,provider_metadata")
      .eq("user_id", user.id).eq("platform", "instagram").eq("environment", "production").eq("account_status", "connected")
      .order("connected_at", { ascending: false }).limit(1).maybeSingle();
    if (accountError) throw accountError;
    if (!account?.access_token_encrypted) return json({ error: "No connected production Instagram account was found." }, 404);
    const token = await decrypt(account.access_token_encrypted);
    const igId = String(account.platform_user_id);
    const [me, assignedInstagram, pages, profile, conversations, subscriptions] = await Promise.all([
      probe(token, "me", { fields: "id,name" }),
      probe(token, "me/assigned_instagram_accounts", { fields: "id,username" }),
      probe(token, "me/accounts", { fields: "id,name,tasks,instagram_business_account", limit: "50" }),
      probe(token, igId, { fields: "id,username" }),
      probe(token, igId + "/conversations", { platform: "instagram", limit: "1", fields: "id,updated_time,participants" }),
      probe(token, igId + "/subscribed_apps", { fields: "id" })
    ]);
    return json({
      account: { username: account.username, instagram_id: igId, auth_method: account.auth_method, token_type: account.token_type, scopes: account.scopes || [], api_host_saved: account.provider_metadata?.api_host || null },
      checks: { me, assigned_instagram_accounts: assignedInstagram, pages, instagram_profile: profile, conversations, subscribed_apps: subscriptions },
      note: "Diagnostic responses omit access tokens and message contents."
    });
  } catch (error) {
    console.error("meta-inbox-diagnostic failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Instagram diagnostic failed. Check the Edge Function logs." }, 500);
  }
});
