import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function b64(v: string) {
  return Uint8Array.from(atob(v), c => c.charCodeAt(0));
}

async function encrypt(v: string) {
  const k = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!k) throw new Error("Token encryption is not configured.");
  const raw = b64(k);
  if (raw.length !== 32) throw new Error("Token encryption key must be base64-encoded 32 bytes.");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(v));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...out));
}

function esc(v: string) {
  return v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function html(title: string, message: string) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;background:#0b1020;color:#fff;padding:40px"><main style="max-width:520px;margin:10vh auto;background:#151d31;padding:28px;border-radius:18px"><b style="color:#6ee7b7">FREE CROSSPOSTER</b><h2>${esc(title)}</h2><p style="color:#cbd5e1;line-height:1.6">${esc(message)}</p><p style="color:#94a3b8">Close this tab and return to your workspace.</p></main></body>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function consumeState(nonce: string) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.from("meta_oauth_states")
    .select("nonce,user_id,created_at,consumed_at,return_url")
    .eq("nonce", nonce)
    .is("consumed_at", null)
    .gt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle();

  if (error || !data) throw new Error("Login session expired. Start a new TikTok connection.");

  const { data: used, error: useError } = await admin.from("meta_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .is("consumed_at", null)
    .select("user_id")
    .maybeSingle();

  if (useError || !used) throw new Error("Login session already used. Start a new TikTok connection.");
  return { admin, user_id: used.user_id, return_url: data.return_url };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const u = new URL(req.url);
  if (u.searchParams.has("error")) {
    return html("TikTok authorization cancelled", u.searchParams.get("error_description") || "You did not authorize TikTok.");
  }

  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (!code || !state) return html("Missing authorization details", "TikTok did not return the required code and state.");

  try {
    const { admin, user_id, return_url } = await consumeState(state);
    const environment = return_url === "tiktok:sandbox" ? "sandbox" : "production";
    const prefix = environment === "sandbox" ? "TIKTOK_SANDBOX" : "TIKTOK";

    // Trim accidental whitespace/newlines from dashboard secret values.
    const clientKey = (Deno.env.get(prefix + "_CLIENT_KEY") || "").trim();
    const clientSecret = (Deno.env.get(prefix + "_CLIENT_SECRET") || "").trim();

    if (!clientKey || !clientSecret) {
      throw new Error(environment === "sandbox"
        ? "TikTok Sandbox credentials are missing."
        : "TikTok production credentials are missing.");
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tiktok-oauth-callback`;
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache"
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });

    // TikTok OAuth v2 returns access_token and refresh_token at the top level.
    const tokenBody = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || tokenBody.error || !tokenBody.access_token) {
      const errorCode = typeof tokenBody.error === "string" ? tokenBody.error : "token_exchange_failed";
      const description = tokenBody.error_description || "TikTok rejected the token exchange.";
      const logId = tokenBody.log_id ? ` (TikTok log ID: ${tokenBody.log_id})` : "";
      console.error("TikTok token exchange failed", { environment, status: tokenRes.status, error: errorCode, description, log_id: tokenBody.log_id || null });
      throw new Error(`${description} [${errorCode}]${logId}`);
    }

    const accessToken = tokenBody.access_token;
    const profileRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profileBody = await profileRes.json().catch(() => ({}));

    if (!profileRes.ok || profileBody.error?.code !== "ok" || !profileBody.data?.user?.open_id) {
      console.error("TikTok profile lookup failed", {
        environment,
        status: profileRes.status,
        error: profileBody.error?.code || "profile_lookup_failed",
        log_id: profileBody.error?.log_id || null
      });
      throw new Error(profileBody.error?.message || "Could not read TikTok profile.");
    }

    const p = profileBody.data.user;
    const { error: saveError } = await admin.from("social_accounts").upsert({
      user_id,
      platform: "tiktok",
      platform_user_id: p.open_id,
      environment,
      username: null,
      display_name: p.display_name || "TikTok account",
      access_token_encrypted: await encrypt(accessToken),
      refresh_token_encrypted: tokenBody.refresh_token ? await encrypt(tokenBody.refresh_token) : null,
      token_expires_at: tokenBody.expires_in
        ? new Date(Date.now() + Number(tokenBody.expires_in) * 1000).toISOString()
        : null,
      scopes: typeof tokenBody.scope === "string"
        ? tokenBody.scope.split(",").map((s: string) => s.trim()).filter(Boolean)
        : ["user.info.basic", "video.publish"],
      account_status: "connected",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,platform,platform_user_id,environment" });

    if (saveError) throw saveError;

    return html("TikTok connected", `Connected ${p.display_name || "your TikTok account"}. Return to FREE CROSSPOSTER.`);
  } catch (e) {
    console.error("TikTok OAuth callback", e);
    return html("TikTok connection not completed", e instanceof Error ? e.message : "Unexpected server error.");
  }
});