import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const API_VERSION = "v27.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function decryptToken(value: string, encodedKey: string): Promise<string> {
  const packed = decodeBase64(value);
  if (packed.length <= 12) throw new Error("Stored Instagram token is invalid.");
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const rawKey = decodeBase64(encodedKey);
  if (rawKey.length !== 32) throw new Error("Token encryption key is invalid.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}
async function graphPost(path: string, params: Record<string, string>, accessToken: string) {
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${path}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error?.message || "Meta rejected the publishing request.");
  return data;
}
async function graphGet(path: string, params: Record<string, string>, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error?.message || "Could not check Instagram media status.");
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return Response.json({ error: "Sign in first." }, { status: 401, headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  let postId: string | null = null;
  let destinationId: string | null = null;
  let confirmedInstagramMediaId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;

  try {
    if (!encryptionKey) throw new Error("Server token encryption is not configured.");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Your session is invalid. Sign in again." }, { status: 401, headers: cors });

    const body = await req.json();
    postId = body?.post_id;
    destinationId = typeof body?.destination_id === "string" ? body.destination_id : null;
    if (typeof postId !== "string" || !postId) return Response.json({ error: "A post ID is required." }, { status: 400, headers: cors });

    admin = createClient(supabaseUrl, serviceKey);
    const { data: post, error: postError } = await admin.from("posts")
      .select("id,user_id,caption,media_path,media_type,status")
      .eq("id", postId).eq("user_id", user.id).maybeSingle();
    if (postError || !post) return Response.json({ error: "Post not found." }, { status: 404, headers: cors });
    if (!post.media_path || (post.media_type !== "image" && post.media_type !== "video")) {
      return Response.json({ error: "Add a supported image or video before publishing." }, { status: 400, headers: cors });
    }

    let destinationQuery = admin.from("post_destinations")
      .select("id,status,social_account_id")
      .eq("post_id", post.id).eq("user_id", user.id).eq("platform", "instagram");
    if (destinationId) destinationQuery = destinationQuery.eq("id", destinationId);
    const { data: destination, error: destinationError } = await destinationQuery.maybeSingle();
    if (destinationError || !destination) return Response.json({ error: "This draft was not assigned to Instagram. Save it again with Instagram selected." }, { status: 400, headers: cors });
    if (destination.status === "published") return Response.json({ error: "This post has already been published to Instagram." }, { status: 409, headers: cors });

    let accountQuery = admin.from("social_accounts")
      .select("id,platform_user_id,access_token_encrypted,token_expires_at")
      .eq("user_id", user.id).eq("platform", "instagram").eq("account_status", "connected");
    if (destination.social_account_id) accountQuery = accountQuery.eq("id", destination.social_account_id);
    const { data: account, error: accountError } = await accountQuery.limit(1).maybeSingle();
    if (accountError || !account?.access_token_encrypted || !account.platform_user_id) {
      return Response.json({ error: "Connect an Instagram professional account before publishing." }, { status: 400, headers: cors });
    }

    if (account.token_expires_at && new Date(account.token_expires_at).getTime() <= Date.now()) {
      throw new Error("Your Instagram authorization has expired. Reconnect Instagram before publishing.");
    }
    const accessToken = await decryptToken(account.access_token_encrypted, encryptionKey);

    const { data: media, error: mediaError } = await admin.storage.from("user-media").createSignedUrl(post.media_path, 60 * 60);
    if (mediaError || !media?.signedUrl) throw new Error("Could not prepare your media for Instagram.");

    const containerParams: Record<string, string> = { caption: post.caption || "" };
    if (post.media_type === "image") {
      containerParams.image_url = media.signedUrl;
    } else {
      containerParams.media_type = "REELS";
      containerParams.video_url = media.signedUrl;
      containerParams.share_to_feed = "true";
    }

    const container = await graphPost(`${account.platform_user_id}/media`, containerParams, accessToken);
    if (!container.id) throw new Error("Meta did not create an Instagram media container.");

    if (post.media_type === "video") {
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const status = await graphGet(String(container.id), { fields: "status_code,status" }, accessToken);
        if (status.status_code === "FINISHED") { ready = true; break; }
        if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
          throw new Error(status.status || "Meta could not process this video.");
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (!ready) throw new Error("Instagram is still processing this video. Please try publishing again in a moment.");
    }

    const published = await graphPost(`${account.platform_user_id}/media_publish`, {
      creation_id: String(container.id),
    }, accessToken);
    if (!published.id) throw new Error("Meta did not confirm the published Instagram post.");
    confirmedInstagramMediaId = String(published.id);

    const now = new Date().toISOString();
    const { error: updateDestinationError } = await admin.from("post_destinations").update({
      status: "published",
      platform_post_id: String(published.id),
      published_at: now,
      error_message: null,
      updated_at: now,
    }).eq("id", destination.id).eq("user_id", user.id);
    if (updateDestinationError) console.error("Instagram published, but destination status sync failed:", updateDestinationError.message);

    const { data: remaining, error: remainingError } = await admin.from("post_destinations")
      .select("status").eq("post_id", post.id).neq("status", "published");
    if (remainingError) console.error("Instagram published, but remaining destination lookup failed:", remainingError.message);
    const nextPostStatus = remaining?.length ? "partially_published" : "published";
    const { error: postUpdateError } = await admin.from("posts").update({ status: nextPostStatus, updated_at: now })
      .eq("id", post.id).eq("user_id", user.id);
    if (postUpdateError) console.error("Instagram published, but post status sync failed:", postUpdateError.message);

    return Response.json({ ok: true, instagram_media_id: String(published.id), status: "published" }, { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram publishing failed.";
    if (confirmedInstagramMediaId) {
      console.error("Instagram publish succeeded; follow-up workspace sync had an issue:", message);
      return Response.json({ ok: true, status: "published", instagram_media_id: confirmedInstagramMediaId, warning: "Instagram published successfully. Workspace status may take a moment to refresh." }, { headers: cors });
    }
    console.error("Instagram publishing error", message);
    try {
      if (postId && admin) {
        let failureQuery = admin.from("post_destinations").update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        }).eq("post_id", postId).eq("platform", "instagram");
        if (destinationId) failureQuery = failureQuery.eq("id", destinationId);
        await failureQuery;
      }
    } catch { /* Preserve the original publishing error. */ }
    return Response.json({ error: message }, { status: 500, headers: cors });
  }
});