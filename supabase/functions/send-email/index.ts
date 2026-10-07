import { Resend } from "npm:resend@^6";
import { Webhook } from "npm:standardwebhooks@^1";

const resendApiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").trim().replace("v1,whsec_", "");
const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();

const resend = new Resend(resendApiKey);
const webhook = new Webhook(hookSecret);

type HookPayload = {
  user: { email?: string | null; new_email?: string | null };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function copyFor(action: string) {
  switch (action) {
    case "recovery":
      return { subject: "گۆڕینی وشەی نهێنی — SHAKH", title: "وشەی نهێنیت گۆڕینەوە", intro: "داواکارییەک بۆ گۆڕینی وشەی نهێنی هەژمارەکەت کراوە.", button: "گۆڕینی وشەی نهێنی" };
    case "email_change":
      return { subject: "پشتڕاستکردنەوەی ئیمەیڵ — SHAKH", title: "پشتڕاستکردنەوەی ئیمەیڵ", intro: "داواکارییەک بۆ گۆڕینی ئیمەیڵی هەژمارەکەت کراوە.", button: "پشتڕاستکردنەوەی ئیمەیڵ" };
    case "magiclink":
      return { subject: "چوونەژوورەوە بۆ SHAKH", title: "بچۆ ژوورەوە بۆ SHAKH", intro: "ئەم لینکە بۆ چوونەژوورەوە بۆ هەژمارەکەتە.", button: "چوونەژوورەوە" };
    case "invite":
      return { subject: "بانگهێشت بۆ SHAKH", title: "بانگهێشت کراویت بۆ SHAKH", intro: "بانگهێشتێکت بۆ بەشداری لە SHAKH هەیە.", button: "وەرگرتنی بانگهێشت" };
    default:
      return { subject: "بەخێربێیت بۆ SHAKH", title: "بەخێربێیت بۆ SHAKH", intro: "هەژمارەکەت دروست کراوە. تکایە ئیمەیڵەکەت پشتڕاست بکەرەوە بۆ دەستپێکردن.", button: "پشتڕاستکردنەوەی هەژمار" };
  }
}

function buildVerifyUrl(tokenHash: string, action: string, redirectTo: string) {
  const url = new URL(supabaseUrl + "/auth/v1/verify");
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", action);
  url.searchParams.set("redirect_to", redirectTo || supabaseUrl);
  return url.toString();
}

function emailHtml(params: { title: string; intro: string; button: string; verifyUrl: string; token?: string; address: string }) {
  const tokenBlock = params.token
    ? `<p style="margin:28px 0 8px;font-size:13px;line-height:22px;color:#6b7280;">کۆدی کاتی:</p><div style="padding:14px;background:#f3f4f6;border-radius:10px;font-size:20px;letter-spacing:3px;color:#111827;text-align:center;">${escapeHtml(params.token)}</div>`
    : "";
  return `<!DOCTYPE html><html lang="ku" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7fb;"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;"><tr><td bgcolor="#111827" style="padding:26px;text-align:center;background:#111827;"><div style="font-size:26px;line-height:32px;font-weight:700;color:#ffffff;">SHAKH — شاخ</div><div style="margin-top:6px;font-size:13px;line-height:20px;color:#d1d5db;">بۆ ژیانی ئاسانتر</div></td></tr><tr><td style="padding:42px 32px;text-align:right;"><div style="font-size:14px;line-height:22px;color:#6b7280;">سڵاو ${escapeHtml(params.address)}</div><h1 style="margin:10px 0 16px;font-size:30px;line-height:38px;color:#111827;">${params.title}</h1><p style="margin:0 0 26px;font-size:16px;line-height:28px;color:#374151;">${params.intro}</p><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#f97316" style="background:#f97316;border-radius:10px;text-align:center;"><a href="${params.verifyUrl}" style="display:inline-block;padding:14px 26px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${params.button}</a></td></tr></table>${tokenBlock}<p style="margin:24px 0 0;font-size:12px;line-height:20px;color:#9ca3af;">ئەگەر ئەم داواکارییەت نەکردووە، دەتوانیت ئەم ئیمەیڵە پشتگوێ بخەیت.</p></td></tr><tr><td style="padding:20px 32px 24px;text-align:center;border-top:1px solid #eef0f4;"><div style="font-size:12px;line-height:20px;color:#9ca3af;">© SHAKH. هەموو مافەکان پارێزراون.</div></td></tr></table></td></tr></table></body></html>`;
}

async function sendAuthEmail(params: { email: string; token: string; tokenHash: string; action: string; redirectTo: string }) {
  const copy = copyFor(params.action);
  const verifyUrl = buildVerifyUrl(params.tokenHash, params.action, params.redirectTo);
  const { error } = await resend.emails.send({
    from: "SHAKH <auth@mail.daim-post.online>",
    to: [params.email],
    subject: copy.subject,
    html: emailHtml({ ...copy, verifyUrl, token: params.token, address: params.email }),
    text: `${copy.title}\n\n${copy.intro}\n\n${verifyUrl}${params.token ? `\n\nکۆد: ${params.token}` : ""}`,
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "GET") return Response.json({ ok: true, function: "send-email" });
  if (req.method !== "POST") return new Response("not allowed", { status: 405 });

  if (!resendApiKey || !hookSecret || !supabaseUrl) {
    console.error("send-email configuration missing", {
      resendApiKeyPresent: Boolean(resendApiKey),
      hookSecretPresent: Boolean(hookSecret),
      supabaseUrlPresent: Boolean(supabaseUrl),
    });
    return Response.json({ error: { http_code: 500, message: "email hook is not configured" } }, { status: 500 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let data: HookPayload;
  try {
    data = webhook.verify(payload, headers) as HookPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown verification error";
    console.error("send-email webhook verification failed", {
      error: message,
      hasWebhookId: Boolean(headers["webhook-id"]),
      hasWebhookTimestamp: Boolean(headers["webhook-timestamp"]),
      hasWebhookSignature: Boolean(headers["webhook-signature"]),
    });
    return Response.json({
      error: { http_code: 401, message: "Webhook signature verification failed" },
    }, { status: 401 });
  }

  try {
    const emailData = data.email_data ?? {};
    const action = emailData.email_action_type ?? "signup";
    const redirectTo = emailData.redirect_to ?? emailData.site_url ?? supabaseUrl;
    const userEmail = data.user?.email?.trim() ?? "";
    const newEmail = data.user?.new_email?.trim() ?? "";

    if (!userEmail && !newEmail) {
      return Response.json({ error: { http_code: 400, message: "Missing recipient" } }, { status: 400 });
    }

    if (action === "email_change" && emailData.token_hash_new && emailData.token) {
      if (!userEmail) return Response.json({ error: { http_code: 400, message: "Missing current email" } }, { status: 400 });
      await sendAuthEmail({
        email: userEmail,
        token: emailData.token,
        tokenHash: emailData.token_hash_new,
        action,
        redirectTo,
      });

      if (emailData.token_hash && emailData.token_new && newEmail) {
        await sendAuthEmail({
          email: newEmail,
          token: emailData.token_new,
          tokenHash: emailData.token_hash,
          action,
          redirectTo,
        });
      }
    } else {
      const email = action === "email_change" && newEmail ? newEmail : userEmail;
      const token = emailData.token ?? emailData.token_new ?? "";
      const tokenHash = emailData.token_hash ?? emailData.token_hash_new ?? "";

      if (!email || !tokenHash) {
        return Response.json({ error: { http_code: 400, message: "Invalid hook payload" } }, { status: 400 });
      }

      await sendAuthEmail({ email, token, tokenHash, action, redirectTo });
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    console.error("send-email Resend delivery failed", { error: message });
    return Response.json({
      error: { http_code: 502, message: "Email delivery failed" },
    }, { status: 502 });
  }
});