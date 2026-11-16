import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = "imenaking12@gmail.com";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "Supabase server configuration is incomplete." }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return response({ error: "Sign in required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return response({ error: "Your session is invalid. Please sign in again." }, 401);
  if ((authData.user.email || "").toLowerCase() !== adminEmail) {
    return response({ error: "You are not authorized to view system diagnostics." }, 403);
  }

  const checks: Array<Record<string, unknown>> = [];
  const requiredSecrets = [
    "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET",
    "TIKTOK_SANDBOX_CLIENT_KEY", "TIKTOK_SANDBOX_CLIENT_SECRET",
    "META_APP_SECRET", "TOKEN_ENCRYPTION_KEY", "OPENAI_API_KEY",
  ];
  const presentSecrets = requiredSecrets.filter((name) => Boolean(Deno.env.get(name)));
  const missingSecrets = requiredSecrets.filter((name) => !Deno.env.get(name));

  checks.push({
    id: "credentials",
    title: "Integration secrets",
    status: missingSecrets.length ? "warning" : "healthy",
    summary: missingSecrets.length ? `${missingSecrets.length} expected secret(s) are not configured.` : "All checked integration secrets are present.",
    details: { present: presentSecrets, missing: missingSecrets },
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: snapshot, error: dbError } = await serviceClient.rpc("admin_system_health_snapshot");

  if (dbError) {
    checks.push({ id: "database", title: "Database diagnostics", status: "critical", summary: "Could not read the database health snapshot.", details: { message: dbError.message } });
  } else {
    checks.push({ id: "database", title: "Database connectivity", status: "healthy", summary: "The database health snapshot was collected successfully.", details: { sizeBytes: snapshot?.database_size_bytes, checkedAt: snapshot?.checked_at } });
    const tables = Array.isArray(snapshot?.tables) ? snapshot.tables : [];
    const rlsOff = tables.filter((t: any) => t.schema === "public" && !t.rls_enabled);
    const serverOnlyTables = ["meta_oauth_states"];
    const publicNoPolicies = tables.filter((t: any) => t.schema === "public" && !serverOnlyTables.includes(t.name) && t.rls_enabled && Number(t.policy_count) === 0);
    checks.push({
      id: "rls", title: "Row Level Security",
      status: rlsOff.length ? "critical" : publicNoPolicies.length ? "warning" : "healthy",
      summary: rlsOff.length ? `${rlsOff.length} public table(s) have RLS disabled.` : publicNoPolicies.length ? `${publicNoPolicies.length} public table(s) have RLS enabled but no policies.` : "RLS is enabled on all checked public tables and policies exist.",
      details: { rlsDisabled: rlsOff, publicTablesWithoutPolicies: publicNoPolicies },
    });
    const extensions = Array.isArray(snapshot?.extensions_in_public) ? snapshot.extensions_in_public : [];
    checks.push({ id: "extensions", title: "Database extensions", status: extensions.length ? "warning" : "healthy", summary: extensions.length ? `${extensions.length} extension(s) are installed in the public schema.` : "No extensions were found in the public schema.", details: { extensions } });
    const unused = Array.isArray(snapshot?.unused_indexes) ? snapshot.unused_indexes : [];
    checks.push({ id: "indexes", title: "Index usage", status: unused.length ? "info" : "healthy", summary: unused.length ? `${unused.length} non-primary index(es) currently show zero scans since statistics reset.` : "No unused indexes were reported.", details: { indexes: unused } });
  }

  const critical = checks.filter((c) => c.status === "critical").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  return response({
    checkedAt: new Date().toISOString(),
    overall: critical ? "critical" : warnings ? "warning" : "healthy",
    counts: { critical, warnings, info: checks.filter((c) => c.status === "info").length, healthy: checks.filter((c) => c.status === "healthy").length },
    checks,
    note: "This is a read-only initial scan. Secret values are never returned. Log trends, storage usage and external platform health will be added in later checks.",
  });
});