import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * Sends queued notifications by email (Resend) and SMS (Twilio) when keys are set.
 * Runs on a Vercel cron every 15 min, or hit it manually with the CRON_SECRET header.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin.rpc("close_ended_auctions");

  // Held-money timers: auto-release delivered orders after the 3-day window; auto-refund pickup orders nobody completed.
  if (process.env.STRIPE_SECRET_KEY) {
    const { releaseOrder, refundOrder } = await import("@/lib/orders");
    const nowIso = new Date().toISOString();
    const { data: toRelease } = await admin.from("orders").select("id").eq("status", "paid").lt("release_after", nowIso).limit(50);
    for (const o of toRelease || []) { try { await releaseOrder(o.id); } catch (e) { console.error("auto-release", o.id, e); } }
    const { data: toRefund } = await admin.from("orders").select("id").eq("status", "paid").eq("fulfillment", "pickup").lt("expires_at", nowIso).limit(50);
    for (const o of toRefund || []) { try { await refundOrder(o.id); } catch (e) { console.error("auto-refund", o.id, e); } }
  }

  const { data: queue } = await admin.from("notifications").select("*").is("sent_at", null).limit(100);
  const { data: biz } = await admin.from("settings").select("value").eq("key", "business").maybeSingle();
  const business = (biz?.value as { name?: string; contact_email?: string }) || {};
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  let sent = 0, skipped = 0;

  for (const n of queue || []) {
    const to = n.contact as string | null;
    if (!to) { skipped++; continue; }
    const isPhone = /^[\d\s()+-]{7,}$/.test(to);
    const link = n.related_item_id ? `${site}/item/${(await admin.from("items").select("sku").eq("id", n.related_item_id).single()).data?.sku}` : site;
    let ok = false;
    try {
      if (isPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
        const body = new URLSearchParams({ To: to.replace(/[\s()-]/g, ""), From: process.env.TWILIO_FROM, Body: `${n.body} ${link}` });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body,
        });
        ok = r.ok;
      } else if (!isPhone && process.env.RESEND_API_KEY) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: process.env.EMAIL_FROM || `${business.name || "Next Owner Market"} <onboarding@resend.dev>`, to, subject: n.subject || "Update", html: `<p>${n.body}</p><p><a href="${link}">${link}</a></p>` }),
        });
        ok = r.ok;
      } else { skipped++; continue; }
    } catch { ok = false; }
    if (ok) { await admin.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", n.id); sent++; }
  }
  return NextResponse.json({ sent, skipped, queued: queue?.length || 0 });
}
