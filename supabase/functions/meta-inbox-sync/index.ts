import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const API_VERSION = "v27.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
function decode(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
async function decryptToken(value: string) {
  const encoded = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("Token encryption is not configured.");
  const keyBytes = decode(encoded), packed = decode(value);
  if (keyBytes.length !== 32 || packed.length < 29) throw new Error("Stored social token is invalid.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return new TextDecoder().decode(plain);
}
function providerError(payload: any) {
  const error = payload?.error || {};
  const code = Number(error.code);
  const subcode = error.error_subcode ? Number(error.error_subcode) : null;
  const message = typeof error.message === "string" ? error.message.slice(0, 260) : "No additional details were returned by Meta.";
  if (code === 10 || code === 200) return `Meta denied access to the conversations endpoint (code ${code}${subcode ? ", subcode " + subcode : ""}). The connected System User token may have Instagram messaging access but this endpoint can require a Page access token with the linked Page's MESSAGING task and Page permissions. Meta says: ${message}`;
  if (code === 190) return "Meta rejected the saved token as expired or invalid (code 190). Reconnect the Instagram account.";
  if (code === 4 || code === 17 || code === 613 || code === 80006) return "Meta is rate-limiting inbox sync. Wait before retrying. Meta says: " + message;
  return `Meta conversations request failed (HTTP/API code ${code || "unknown"}${subcode ? ", subcode " + subcode : ""}). Meta says: ${message}`;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anon || !service || !authorization) return reply({ error: "Sign in first." }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return reply({ error: "Your session expired. Sign in again." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: accounts, error: accountError } = await admin.from("social_accounts")
      .select("id,user_id,platform_user_id,access_token_encrypted,scopes,account_status,environment")
      .eq("user_id", user.id).eq("platform", "instagram").eq("account_status", "connected").eq("environment", "production");
    if (accountError) throw accountError;
    const eligible = (accounts || []).filter((a: any) => Array.isArray(a.scopes) && a.scopes.includes("instagram_manage_messages") && a.access_token_encrypted);
    if (!eligible.length) return reply({ synced: 0, conversations: 0, messages: 0, errors: accounts?.length ? ["Connect an Instagram account with instagram_manage_messages permission."] : ["Connect an Instagram professional account first."] });
    let conversationsSynced = 0, messagesSynced = 0;
    const errors: string[] = [];
    for (const account of eligible) {
      try {
        const token = await decryptToken(account.access_token_encrypted);
        // Keep the conversations request lightweight. Meta can reject nested message
        // expansions with error code 1 when too much data is requested in one call.
        const query = new URL("https://graph.facebook.com/" + API_VERSION + "/" + encodeURIComponent(account.platform_user_id) + "/conversations");
        query.searchParams.set("platform", "instagram");
        query.searchParams.set("limit", "20");
        query.searchParams.set("fields", "id,updated_time,participants");
        const response = await fetch(query, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(20000) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn("Meta conversations list rejected", { status: response.status, code: payload?.error?.code, subcode: payload?.error?.error_subcode, type: payload?.error?.type, message: String(payload?.error?.message || "").slice(0, 260) });
          errors.push("Conversations list: " + providerError(payload));
          const code = Number(payload?.error?.code);
          if (code === 4 || code === 17 || code === 613 || code === 80006) break;
          continue;
        }
        for (const thread of (Array.isArray(payload?.data) ? payload.data : [])) {
          const participants = Array.isArray(thread?.participants?.data) ? thread.participants.data : [];
          const other = participants.find((p: any) => String(p?.id || "") !== String(account.platform_user_id));
          if (!other?.id) continue;
          const { data: existing } = await admin.from("inbox_conversations").select("id,unread_count,last_inbound_at,last_message_at,participant_profile_picture_url")
            .eq("social_account_id", account.id).eq("platform_conversation_id", String(other.id)).maybeSingle();
          let participantProfilePictureUrl = existing?.participant_profile_picture_url || null;
          if (!participantProfilePictureUrl) {
            try {
              const profileUrl = new URL("https://graph.facebook.com/" + API_VERSION + "/" + encodeURIComponent(String(other.id)));
              profileUrl.searchParams.set("fields", "id,name,username,profile_pic");
              profileUrl.searchParams.set("access_token", token);
              const profileResponse = await fetch(profileUrl, { signal: AbortSignal.timeout(10000) });
              const profileData = await profileResponse.json().catch(() => ({}));
              if (profileResponse.ok && typeof profileData?.profile_pic === "string" && profileData.profile_pic.startsWith("https://")) {
                participantProfilePictureUrl = profileData.profile_pic;
                await admin.from("inbox_conversations").update({ participant_profile_picture_url: participantProfilePictureUrl })
                  .eq("id", existing.id).eq("user_id", user.id);
              } else if (!profileResponse.ok) {
                console.info("Instagram participant profile photo unavailable", { status: profileResponse.status, code: profileData?.error?.code });
              }
            } catch (profileError) {
              console.info("Instagram participant profile photo lookup skipped", profileError instanceof Error ? profileError.message : "unknown error");
            }
          }
          // Skip unchanged threads after attempting to fill a missing profile photo.
          if (existing?.last_message_at && thread.updated_time &&
              new Date(existing.last_message_at).getTime() >= new Date(thread.updated_time).getTime()) {
            conversationsSynced++;
            continue;
          }
          // Fetch only the five newest messages for changed conversations.
          const messagesUrl = new URL("https://graph.facebook.com/" + API_VERSION + "/" + encodeURIComponent(String(thread.id)) + "/messages");
          messagesUrl.searchParams.set("limit", "5");
          messagesUrl.searchParams.set("fields", "id,created_time,from,to,message,attachments");
          const messagesResponse = await fetch(messagesUrl, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(15000) });
          const messagesPayload = await messagesResponse.json().catch(() => ({}));
          if (!messagesResponse.ok) {
            console.warn("Meta conversation messages rejected", { conversation_id: String(thread.id), status: messagesResponse.status, code: messagesPayload?.error?.code, subcode: messagesPayload?.error?.error_subcode, message: String(messagesPayload?.error?.message || "").slice(0, 260) });
            errors.push("Messages for conversation " + String(thread.id) + ": " + providerError(messagesPayload));
            const code = Number(messagesPayload?.error?.code);
            if (code === 4 || code === 17 || code === 613 || code === 80006) break;
            continue;
          }
          const messages = Array.isArray(messagesPayload?.data) ? messagesPayload.data : [];
          const ordered = [...messages].sort((a: any, b: any) => new Date(a.created_time || 0).getTime() - new Date(b.created_time || 0).getTime());
          const latest = ordered[ordered.length - 1];
          const latestText = latest?.message || (latest?.attachments?.data?.length ? "Attachment" : "New message");
          const latestAt = latest?.created_time || thread.updated_time || new Date().toISOString();
          const lastInbound = ordered.filter((m: any) => String(m?.from?.id || "") !== String(account.platform_user_id))
            .map((m: any) => m.created_time).filter(Boolean).sort().at(-1) || existing?.last_inbound_at || null;
          const { data: conversation, error: conversationError } = await admin.from("inbox_conversations").upsert({
            user_id: user.id, social_account_id: account.id, platform: "instagram",
            platform_conversation_id: String(other.id), participant_id: String(other.id),
            participant_name: other.name || other.username || null, participant_username: other.username || null,
            participant_profile_picture_url: participantProfilePictureUrl,
            last_message_text: latestText, last_message_at: latestAt, last_inbound_at: lastInbound,
            unread_count: Number(existing?.unread_count || 0), updated_at: new Date().toISOString()
          }, { onConflict: "social_account_id,platform_conversation_id" }).select("id,unread_count").single();
          if (conversationError || !conversation) throw conversationError || new Error("Could not save conversation.");
          conversationsSynced++;
          let newInbound = 0;
          for (const message of ordered) {
            if (!message?.id) continue;
            const outbound = String(message?.from?.id || "") === String(account.platform_user_id);
            const createdAt = message.created_time || new Date().toISOString();
            const attachments = Array.isArray(message?.attachments?.data) ? message.attachments.data : [];
            const { data: inserted, error: messageError } = await admin.from("inbox_messages").upsert({
              user_id: user.id, conversation_id: conversation.id, platform_message_id: String(message.id),
              direction: outbound ? "outbound" : "inbound", sender_id: String(message?.from?.id || ""),
              message_text: typeof message.message === "string" ? message.message : null,
              attachments, delivery_status: outbound ? "sent" : "received", sent_at: createdAt
            }, { onConflict: "conversation_id,platform_message_id", ignoreDuplicates: true }).select("id");
            if (messageError) throw messageError;
            if (inserted?.length) { messagesSynced += inserted.length; if (!outbound) newInbound += inserted.length; }
          }
          if (newInbound) {
            const { error: unreadError } = await admin.from("inbox_conversations").update({ unread_count: Number(conversation.unread_count || 0) + newInbound })
              .eq("id", conversation.id).eq("user_id", user.id);
            if (unreadError) throw unreadError;
          }
        }
      } catch (error) {
        console.error("Instagram inbox sync failed for account", account.id, error);
        errors.push(error instanceof Error ? error.message : "An Instagram account could not be synced.");
      }
    }
    return reply({ synced: true, conversations: conversationsSynced, messages: messagesSynced, errors });
  } catch (error) {
    console.error("meta-inbox-sync error", error);
    return reply({ error: "Instagram inbox sync failed. Try again or reconnect the account." }, 500);
  }
});