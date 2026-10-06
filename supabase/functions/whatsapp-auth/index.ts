import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.daim-post.online",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeIraqPhone(value: string) {
  const compact = value.trim().replace(/[()\s-]/g, "");
  let national = compact;
  if (national.startsWith("+964")) national = national.slice(4);
  else if (national.startsWith("00964")) national = national.slice(5);
  else if (national.startsWith("0")) national = national.slice(1);

  const digits = national.replace(/\D/g, "");
  if (!/^7\d{9}$/.test(digits)) throw new Error("invalid_phone");
  return "+964" + digits;
}

function randomNumericCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashOtp(otp: string) {
  const pepper = Deno.env.get("WHATSAPP_RECOVERY_PEPPER") ?? "";
  if (!pepper) throw new Error("whatsapp_secret_not_configured");
  return sha256Hex(pepper + ":" + otp);
}

async function hashResetToken(token: string) {
  const pepper = Deno.env.get("WHATSAPP_RECOVERY_PEPPER") ?? "";
  if (!pepper) throw new Error("whatsapp_secret_not_configured");
  return sha256Hex(pepper + ":reset:" + token);
}

function requireServerConfig() {
  const required = [
    "SUPABASE_URL",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_AUTH_TEMPLATE_NAME",
    "WHATSAPP_AUTH_TEMPLATE_LANGUAGE",
    "WHATSAPP_RECOVERY_PEPPER",
  ];
  const hasSupabaseAdminKey =
    Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ||
    Boolean(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const missing = required.filter((key) => !Deno.env.get(key));
  if (!hasSupabaseAdminKey) missing.push("SUPABASE_SECRET_KEYS");
  if (missing.length) throw new Error("whatsapp_configuration_missing");
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, string>;
      key = parsed.default ?? key;
    } catch {
      // Fall back to legacy service_role for compatibility.
    }
  }
  if (!key) throw new Error("whatsapp_configuration_missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function currentUser(admin: ReturnType<typeof adminClient>, request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function createChallenge(
  admin: ReturnType<typeof adminClient>,
  purpose: "password_recovery" | "phone_enrollment",
  userId: string | null,
  phone: string,
  otpHash: string,
) {
  const { data, error } = await admin.rpc("create_whatsapp_challenge", {
    p_purpose: purpose,
    p_user_id: userId,
    p_phone_e164: phone,
    p_otp_hash: otpHash,
  });
  if (error) {
    if (/rate.?limited/i.test(error.message)) throw new Error("whatsapp_otp_rate_limited");
    if (/already in use/i.test(error.message)) throw new Error("phone_already_in_use");
    throw new Error("whatsapp_challenge_create_failed");
  }
  return data as {
    accepted: boolean;
    challenge_id: string;
    user_id?: string | null;
    purpose?: string;
  };
}

async function verifyChallenge(
  admin: ReturnType<typeof adminClient>,
  challengeId: string,
  otpHash: string,
  resetTokenHash: string | null,
) {
  const { data, error } = await admin.rpc("verify_whatsapp_challenge", {
    p_challenge_id: challengeId,
    p_otp_hash: otpHash,
    p_reset_token_hash: resetTokenHash,
  });
  if (error) throw new Error("whatsapp_otp_verify_failed");
  return data as {
    ok: boolean;
    error?: string;
    user_id?: string;
    purpose?: string;
    phone_e164?: string;
  };
}

async function finalizeRecovery(
  admin: ReturnType<typeof adminClient>,
  challengeId: string,
  resetTokenHash: string,
) {
  const { data, error } = await admin.rpc("finalize_whatsapp_password_recovery", {
    p_challenge_id: challengeId,
    p_reset_token_hash: resetTokenHash,
  });
  if (error) throw new Error("invalid_reset_token");
  return data as { ok: boolean; error?: string; user_id?: string };
}

async function sendWhatsAppOtp(phone: string, otp: string) {
  const version = Deno.env.get("WHATSAPP_API_VERSION") ?? "v25.0";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
  const templateName = Deno.env.get("WHATSAPP_AUTH_TEMPLATE_NAME")!;
  const languageCode = Deno.env.get("WHATSAPP_AUTH_TEMPLATE_LANGUAGE")!;

  const response = await fetch(
    "https://graph.facebook.com/" + version + "/" + phoneNumberId + "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: otp }],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }],
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("WhatsApp send failed", response.status, detail.slice(0, 500));
    throw new Error("whatsapp_send_failed");
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    requireServerConfig();
    const admin = adminClient();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "invalid_json" }, 400);

    const action = String(body.action ?? "");

    if (action === "request_recovery") {
      let phone: string;
      try { phone = normalizeIraqPhone(String(body.phone ?? "")); }
      catch { return json({ error: "invalid_phone" }, 400); }

      const otp = randomNumericCode();
      const otpHash = await hashOtp(otp);
      const challenge = await createChallenge(admin, "password_recovery", null, phone, otpHash);

      if (challenge.accepted) {
        try {
          await sendWhatsAppOtp(phone, otp);
        } catch {
          return json({ error: "whatsapp_send_failed" }, 502);
        }
      }

      return json({
        ok: true,
        requestId: challenge.challenge_id,
        message: "If the number is eligible, a verification code has been sent.",
      });
    }

    if (action === "verify_recovery") {
      const challengeId = String(body.requestId ?? "");
      const phone = normalizeIraqPhone(String(body.phone ?? ""));
      const otp = String(body.otp ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(otp)) {
        return json({ error: "invalid_otp" }, 400);
      }

      const resetToken = randomToken();
      const result = await verifyChallenge(
        admin,
        challengeId,
        await hashOtp(otp),
        await hashResetToken(resetToken),
      );

      if (!result.ok || result.purpose !== "password_recovery" || !result.user_id || result.phone_e164 !== phone) {
        return json({ error: "invalid_otp" }, 400);
      }

      return json({ ok: true, resetToken });
    }

    if (action === "reset_password") {
      const challengeId = String(body.requestId ?? "");
      const resetToken = String(body.resetToken ?? "").trim();
      const password = String(body.password ?? "");

      if (!/^[0-9a-f-]{36}$/i.test(challengeId) || resetToken.length < 40) {
        return json({ error: "invalid_reset_token" }, 400);
      }
      if (password.length < 8) return json({ error: "password_too_short" }, 400);

      const result = await finalizeRecovery(admin, challengeId, await hashResetToken(resetToken));
      if (!result.ok || !result.user_id) return json({ error: "invalid_reset_token" }, 400);

      const { error: passwordError } = await admin.auth.admin.updateUserById(result.user_id, {
        password,
      });
      if (passwordError) {
        console.error("WhatsApp password update failed", passwordError.message);
        return json({ error: "password_update_failed" }, 500);
      }

      try {
        await admin.from("audit_logs").insert({
          actor_user_id: result.user_id,
          action: "whatsapp_password_recovery_completed",
          entity_type: "auth_user",
          entity_id: result.user_id,
          metadata: { channel: "whatsapp" },
        });
      } catch {
        // Audit failure must not expose sensitive auth state after a successful password update.
      }

      return json({ ok: true });
    }

    if (action === "request_phone_enrollment") {
      const user = await currentUser(admin, request);
      if (!user) return json({ error: "not_authenticated" }, 401);

      let phone: string;
      try { phone = normalizeIraqPhone(String(body.phone ?? "")); }
      catch { return json({ error: "invalid_phone" }, 400); }

      const otp = randomNumericCode();
      const challenge = await createChallenge(
        admin,
        "phone_enrollment",
        user.id,
        phone,
        await hashOtp(otp),
      );

      await sendWhatsAppOtp(phone, otp);

      return json({
        ok: true,
        requestId: challenge.challenge_id,
        message: "Verification code sent.",
      });
    }

    if (action === "verify_phone_enrollment") {
      const user = await currentUser(admin, request);
      if (!user) return json({ error: "not_authenticated" }, 401);

      const challengeId = String(body.requestId ?? "");
      const otp = String(body.otp ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(otp)) {
        return json({ error: "invalid_otp" }, 400);
      }

      const result = await verifyChallenge(admin, challengeId, await hashOtp(otp), null);
      if (!result.ok || result.purpose !== "phone_enrollment" || result.user_id !== user.id || !result.phone_e164) {
        return json({ error: "invalid_otp" }, 400);
      }

      const { error: userError } = await admin.auth.admin.updateUserById(user.id, {
        phone: result.phone_e164,
        phone_confirm: true,
      });
      if (userError) return json({ error: "phone_update_failed" }, 500);

      const { error: profileError } = await admin
        .from("profiles")
        .update({ phone: result.phone_e164 })
        .eq("id", user.id);
      if (profileError) {
        console.error("profile phone sync failed", profileError.message);
      }

      return json({ ok: true, phone: result.phone_e164 });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    if (message === "whatsapp_otp_rate_limited") return json({ error: "rate_limited" }, 429);
    if (message === "phone_already_in_use") return json({ error: "phone_already_in_use" }, 409);
    if (message === "invalid_phone") return json({ error: "invalid_phone" }, 400);
    if (message === "whatsapp_configuration_missing" || message === "whatsapp_secret_not_configured") {
      return json({ error: "whatsapp_not_configured" }, 503);
    }

    console.error("whatsapp-auth error", message);
    return json({ error: "whatsapp_auth_failed" }, 500);
  }
});
