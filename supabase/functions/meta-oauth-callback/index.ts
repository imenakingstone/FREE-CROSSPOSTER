import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const APP_ID = "2284146279108911";
const API_VERSION = "v27.0";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function page(title: string, message: string, ok = false) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:16px system-ui;background:#0b1020;color:#f4f6fb;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}.card{max-width:540px;background:#151d31;border:1px solid #293653;border-radius:18px;padding:30px}h1{font-size:24px}.muted{color:#b8c3d8;line-height:1.6}.mark{color:${ok ? "#55d6a1" : "#ffb86b"}}</style></head><body><main class="card"><div class="mark">FREE CROSSPOSTER</div><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(message)}</p><p class="muted">You can close this tab and return to FREE CROSSPOSTER.</p></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function encryptToken(token: string, encodedKey: string): Promise<string> {
  const rawKey = decodeBase64(encodedKey);
  if (rawKey.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...packed));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) return page("Instagram authorization was not completed", oauthError);

  const code = url.searchParams.get("code");
  const nonce = url.searchParams.get("state");
  if (!code || !nonce) return page("Missing authorization details", "Meta did not return the required authorization code and state.");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appSecret = Deno.env.get("META_APP_SECRET");
    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY");
    if (!appSecret || !encryptionKey) {
      console.error("Missing required Meta OAuth or encryption secret.");
      return page("Server setup still needed", "The Meta App Secret or token-encryption key is missing from Supabase Edge Function secrets.");
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: state, error: stateError } = await admin.from("meta_oauth_states")
      .select("nonce,user_id,created_at,consumed_at,return_url")
      .eq("nonce", nonce).is("consumed_at", null)
      .gt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .maybeSingle();
    if (stateError || !state) return page("Login session expired", "Please return to FREE CROSSPOSTER and start Instagram connection again.");

    const { data: consumed, error: consumeError } = await admin.from("meta_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("nonce", nonce).is("consumed_at", null)
      .select("user_id").maybeSingle();
    if (consumeError || !consumed) return page("Login session already used", "Please start a new Instagram connection from FREE CROSSPOSTER.");

    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const tokenUrl = new URL(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", APP_ID);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(20000) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      console.error("Meta authorization-code exchange failed", { status: tokenResponse.status, error: tokenData?.error?.code, type: tokenData?.error?.type });
      return page("Meta could not complete the connection", "The authorization code exchange failed. Check the Meta app configuration and try again.");
    }

    const accessToken = tokenData.access_token as string;
    // Verify that the returned token belongs to this Meta app before storing it.
    const appAccessToken = `${APP_ID}|${appSecret}`;
    const debugUrl = new URL(`https://graph.facebook.com/${API_VERSION}/debug_token`);
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", appAccessToken);
    const debugResponse = await fetch(debugUrl, { signal: AbortSignal.timeout(15000) });
    const debugPayload = await debugResponse.json().catch(() => ({}));
    const debug = debugPayload?.data;
    if (!debugResponse.ok || debug?.is_valid !== true || String(debug?.app_id || "") !== APP_ID) {
      console.error("Meta access-token validation failed", { status: debugResponse.status, code: debugPayload?.error?.code, isValid: debug?.is_valid, appMatches: String(debug?.app_id || "") === APP_ID });
      return page("Meta could not verify this connection", "The access token was not valid for the FREE CROSSPOSTER app. Please start the Instagram connection again.");
    }

    const permissionsUrl = new URL(`https://graph.facebook.com/${API_VERSION}/me/permissions`);
    permissionsUrl.searchParams.set("access_token", accessToken);
    const permissionsResponse = await fetch(permissionsUrl, { signal: AbortSignal.timeout(15000) });
    const permissionsData = await permissionsResponse.json().catch(() => ({}));
    if (!permissionsResponse.ok) {
      console.error("Meta granted-permissions lookup failed", { status: permissionsResponse.status, code: permissionsData?.error?.code });
      return page("Could not verify Instagram permissions", "Meta did not allow FREE CROSSPOSTER to verify the permissions granted to this connection. Please try again.");
    }
    const grantedScopes = Array.isArray(permissionsData?.data)
      ? permissionsData.data.filter((item: any) => item?.status === "granted" && typeof item?.permission === "string").map((item: any) => item.permission)
      : [];
    const accountUrl = new URL(`https://graph.facebook.com/${API_VERSION}/me/assigned_instagram_accounts`);
    accountUrl.searchParams.set("fields", "id,username");
    accountUrl.searchParams.set("access_token", accessToken);
    const accountResponse = await fetch(accountUrl, { signal: AbortSignal.timeout(20000) });
    const accountData = await accountResponse.json().catch(() => ({}));
    if (!accountResponse.ok) {
      console.error("Meta Instagram asset discovery failed", { status: accountResponse.status, error: accountData?.error?.code, type: accountData?.error?.type, message: accountData?.error?.message });
      return page("Instagram account access could not be confirmed", "Meta approved the login, but did not return the Instagram account assets. Check that the Instagram account was selected and shared in the authorization window, and that the configuration grants the required asset permissions.");
    }

    const accounts = Array.isArray(accountData?.data) ? accountData.data.filter((item: any) => item?.id) : [];
    if (accounts.length === 0) {
      console.error("Meta returned no assigned Instagram accounts for the authorized identity.");
      return page("No Instagram account was shared", "Login succeeded, but Meta returned no Instagram accounts for this authorization. Reconnect and make sure you select the professional Instagram account in the business-asset selection step.");
    }

    const encryptedToken = await encryptToken(accessToken, encryptionKey);
    const expiresAt = Number(tokenData.expires_in) > 0
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : Number(debug?.expires_at) > 0 ? new Date(Number(debug.expires_at) * 1000).toISOString() : null;
    const tokenType = ["USER", "SYSTEM_USER", "PAGE", "INSTAGRAM_USER"].includes(String(debug?.type || "").toUpperCase())
      ? String(debug.type).toUpperCase()
      : "UNKNOWN";
    const now = new Date().toISOString();
    const saved: string[] = [];

    for (const account of accounts) {
      const accountId = String(account.id);
      let username = typeof account.username === "string" ? account.username : null;
      if (!username) {
        try {
          const profileUrl = new URL(`https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(accountId)}`);
          profileUrl.searchParams.set("fields", "id,username");
          profileUrl.searchParams.set("access_token", accessToken);
          const profileResponse = await fetch(profileUrl, { signal: AbortSignal.timeout(15000) });
          const profileData = await profileResponse.json().catch(() => ({}));
          if (profileResponse.ok && typeof profileData?.username === "string") username = profileData.username;
        } catch { /* Username is optional; account ID is sufficient for API calls. */ }
      }
      const payload = {
        user_id: consumed.user_id,
        platform: "instagram",
        platform_user_id: accountId,
        username,
        display_name: username ? `@${username}` : "Instagram professional account",
        access_token_encrypted: encryptedToken,
        refresh_token_encrypted: null,
        token_expires_at: expiresAt,
        scopes: grantedScopes,
        environment: "production",
        account_status: "connected",
        auth_method: "meta_unified_login",
        token_type: tokenType,
        provider_business_id: null,
        provider_metadata: {
          api_host: "graph.facebook.com",
          api_version: API_VERSION,
          token_expires_at: expiresAt,
          data_access_expires_at: Number(debug?.data_access_expires_at) > 0 ? new Date(Number(debug.data_access_expires_at) * 1000).toISOString() : null,
          granted_scopes: grantedScopes,
          granular_scope_count: Array.isArray(debug?.granular_scopes) ? debug.granular_scopes.length : 0
        },
        connected_at: now,
        updated_at: now,
      };
      const { error: saveError } = await admin.from("social_accounts")
        .upsert(payload, { onConflict: "user_id,platform,platform_user_id,environment" });
      if (saveError) throw saveError;
      try {
        const subscribeUrl = new URL(`https://graph.facebook.com/${API_VERSION}/${accountId}/subscribed_apps`);
        subscribeUrl.searchParams.set("subscribed_fields", "messages");
        subscribeUrl.searchParams.set("access_token", accessToken);
        const subscribeResponse = await fetch(subscribeUrl, { method: "POST", signal: AbortSignal.timeout(15000) });
        if (!subscribeResponse.ok) {
          const details = await subscribeResponse.json().catch(() => ({}));
          console.warn("Instagram messaging webhook subscription not completed", { status: subscribeResponse.status, code: details?.error?.code });
        }
      } catch (subscriptionError) {
        console.warn("Instagram webhook subscription failed", subscriptionError instanceof Error ? subscriptionError.message : "unknown error");
      }
      saved.push(username ? `@${username}` : accountId);
    }

    const returnOrigin = typeof state.return_url === "string" && (/^https:\/\/[a-z0-9.-]+$/.test(state.return_url) || /^https?:\/\/(localhost:5173|127\.0\.0\.1:5173)$/.test(state.return_url)) ? state.return_url : null;
    if (!returnOrigin) return page("Instagram connected successfully", `FREE CROSSPOSTER securely saved ${saved.length} Instagram account(s). Return URL was not available; open your workspace and refresh.`, true);
    const destination = new URL("/", returnOrigin);
    destination.searchParams.set("connection", "instagram");
    destination.searchParams.set("connected", "1");
    destination.searchParams.set("account", saved.join(", "));
    return new Response(null, { status: 302, headers: { Location: destination.toString(), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Meta OAuth callback failed", error instanceof Error ? error.message : "Unknown error");
    return page("Connection could not be completed", "A server error occurred while saving the Instagram connection. Please return to FREE CROSSPOSTER and try again.");
  }
});
