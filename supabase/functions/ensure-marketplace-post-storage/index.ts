import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

const BUCKET = "marketplace-posts";
const MAX_FILE_SIZE = 6 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "storage_admin_configuration_missing" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return json({ error: "not_authenticated" }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  if (userError || !userResult.user) return json({ error: "not_authenticated" }, 401);

  const { data: assignments, error: rolesError } = await admin
    .from("user_roles")
    .select("role_code")
    .eq("user_id", userResult.user.id);

  if (rolesError) return json({ error: "role_lookup_failed" }, 500);

  const roleCodes = (assignments || [])
    .map((row) => row.role_code)
    .filter((value): value is string => Boolean(value));

  if (!roleCodes.length) return json({ error: "platform_permission_required" }, 403);

  const { data: permissionRows, error: permissionError } = await admin
    .from("role_permissions")
    .select("permission_code")
    .in("role_code", roleCodes)
    .eq("permission_code", "platform.manage")
    .limit(1);

  if (permissionError) return json({ error: "permission_lookup_failed" }, 500);
  if (!permissionRows || permissionRows.length === 0) {
    return json({ error: "platform_permission_required" }, 403);
  }

  const { data: existingBucket, error: getBucketError } = await admin.storage.getBucket(BUCKET);

  if (!existingBucket) {
    const { data: createdBucket, error: createError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_FILE_SIZE) + "b",
      allowedMimeTypes: ["image/*"],
    });

    if (createError && !/already exists|duplicate/i.test(createError.message)) {
      return json({ error: "storage_bucket_create_failed", detail: createError.message }, 500);
    }

    return json({
      ok: true,
      bucket: BUCKET,
      created: Boolean(createdBucket),
      lookupError: getBucketError ? getBucketError.message : null,
      maxFileSizeBytes: MAX_FILE_SIZE,
    });
  }

  if (existingBucket.public !== true) {
    const { error: updateError } = await admin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_FILE_SIZE) + "b",
      allowedMimeTypes: ["image/*"],
    });

    if (updateError) {
      return json({ error: "storage_bucket_update_failed", detail: updateError.message }, 500);
    }
  }

  return json({
    ok: true,
    bucket: BUCKET,
    created: false,
    maxFileSizeBytes: MAX_FILE_SIZE,
  });
});
