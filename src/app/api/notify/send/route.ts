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
  await admin.rpc("run_price_drops");

  // Held-money timers: auto-release delivered orders after the 3-day window; auto-refund pickup orders nobody completed.
  if (process.env.STRIPE_SECRET_KEY) {
    const { releaseOrder, refundOrder } = await import("@/lib/orders");
    const nowIso = new Date().toISOString();
    const { data: toRelease } = await admin.from("orders").select("id").eq("status", "paid").lt("release_after", nowIso).limit(50);
    for (const o of toRelease || []) { try { await releaseOrder(o.id); } catch (e) { console.error("auto-release", o.id, e); } }
    // referral credits for people already on Pro → apply as a coupon on their subscription
    const { data: credited } = await admin.from("profiles").select("id, pro_credit_months, stripe_subscription_id").gt("pro_credit_months", 0).not("stripe_subscription_id", "is", null).limit(50);
    if (credited?.length) {
      const { stripe } = await import("@/lib/stripe");
      const st = stripe();
      for (const p of credited) {
        try {
          const c = await st.coupons.create({ percent_off: 100, duration: "repeating", duration_in_months: p.pro_credit_months, name: "Referral credit", max_redemptions: 1 });
          await st.subscriptions.update(p.stripe_subscription_id!, { discounts: [{ coupon: c.id }] });
          await admin.from("profiles").update({ pro_credit_months: 0 }).eq("id", p.id);
        } catch (e) { console.error("referral credit", p.id, e); }
      }
    }
    const { data: toRefund } = await admin.from("orders").select("id").eq("status", "paid").eq("fulfillment", "pickup").lt("expires_at", nowIso).limit(50);
    for (const o of toRefund || []) { try { await refundOrder(o.id); } catch (e) { console.error("auto-refund", o.id, e); } }
  }

  const { flushNotifications } = await import("@/lib/notify");
  const result = await flushNotifications(200);

  // nightly backup of every table to the private "backups" bucket (keeps 30 days)
  try {
    const { runBackup } = await import("@/lib/backup");
    await runBackup();
  } catch (e) { console.error("backup", e); }

  return NextResponse.json(result);
}
