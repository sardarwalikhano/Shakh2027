import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-shakh-signature, x-shakh-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fromHex(value: string): Uint8Array | null {
  const clean = value.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const provided = fromHex(signature);
  return !!provided && equal(signed, provided);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });

  const secret = Deno.env.get("MOBILE_CASH_WEBHOOK_SECRET") ?? "";
  if (!secret) return Response.json({ error: "webhook_secret_not_configured" }, { status: 503, headers: corsHeaders });

  const signature = req.headers.get("x-shakh-signature") ?? "";
  const headerEventId = req.headers.get("x-shakh-event-id") ?? "";
  const body = await req.text();
  if (!signature || !headerEventId || !(await verifySignature(body, signature, secret))) {
    return Response.json({ error: "invalid_webhook_signature" }, { status: 401, headers: corsHeaders });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(body); } catch { return Response.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }

  const bodyEventId = String(payload.event_id ?? "");
  if (!bodyEventId || bodyEventId !== headerEventId) return Response.json({ error: "event_id_mismatch" }, { status: 400, headers: corsHeaders });

  const checkoutSessionId = String(payload.checkout_session_id ?? "");
  const paymentIntentId = String(payload.payment_intent_id ?? "");
  const amount = Number(payload.amount_iqd);
  const providerStatus = String(payload.status ?? "");
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(checkoutSessionId)) {
    return Response.json({ error: "invalid_checkout_session_id" }, { status: 400, headers: corsHeaders });
  }
  if (!uuidPattern.test(paymentIntentId)) {
    return Response.json({ error: "invalid_payment_intent_id" }, { status: 400, headers: corsHeaders });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "invalid_amount_iqd" }, { status: 400, headers: corsHeaders });
  }
  if (!["succeeded", "failed", "cancelled"].includes(providerStatus)) {
    return Response.json({ error: "invalid_payment_status" }, { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const serviceKey = secretKeysRaw
    ? String((JSON.parse(secretKeysRaw) as Record<string, string>).default ?? "")
    : (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  if (!supabaseUrl || !serviceKey) return Response.json({ error: "server_payment_configuration_missing" }, { status: 503, headers: corsHeaders });

  const headers: Record<string, string> = { apikey: serviceKey, "Content-Type": "application/json" };
  if (!secretKeysRaw) headers.Authorization = `Bearer ${serviceKey}`;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_mobile_cash_webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_provider_event_id: bodyEventId,
      p_event_type: String(payload.event_type ?? "payment"),
      p_checkout_session_id: checkoutSessionId,
      p_payment_intent_id: paymentIntentId,
      p_amount_iqd: amount,
      p_status: providerStatus,
      p_provider_payment_id: payload.provider_payment_id ?? null,
      p_provider_reference: payload.provider_reference ?? null,
      p_payload: payload,
    }),
  });
  const data = await response.json().catch(() => ({ error: "invalid_database_response" }));
  return Response.json(data, { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
