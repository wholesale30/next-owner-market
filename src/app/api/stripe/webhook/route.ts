import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { admin, stripe, stripeSettings } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") || "";
  const { webhook_secret } = await stripeSettings();
  if (!webhook_secret) return NextResponse.json({ error: "webhook not set up" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, webhook_secret);
  } catch (e) {
    return NextResponse.json({ error: `bad signature: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }
  const db = admin();

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object;
      if (cs.mode === "payment" && cs.metadata?.order_id) {
        const { data: o } = await db.from("orders").select("fulfillment").eq("id", cs.metadata.order_id).single();
        const expires = o?.fulfillment === "pickup" ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
        const ship = (cs as unknown as { collected_information?: { shipping_details?: { name?: string; address?: Record<string, string> } }; shipping_details?: { name?: string; address?: Record<string, string> } }).collected_information?.shipping_details || (cs as unknown as { shipping_details?: { name?: string; address?: Record<string, string> } }).shipping_details || null;
        await db.from("orders").update({
          status: "paid", paid_at: new Date().toISOString(), expires_at: expires, shipping_address: ship,
          stripe_payment_intent_id: typeof cs.payment_intent === "string" ? cs.payment_intent : cs.payment_intent?.id,
        }).eq("id", cs.metadata.order_id).eq("status", "pending_payment");
        await alertStaff("New order paid", `$${((cs.amount_total || 0) / 100).toFixed(2)} order paid in the store (${o?.fulfillment}).`, `/account/orders/${cs.metadata.order_id}`);
      }
      if (cs.mode === "subscription" && cs.metadata?.profile_id) {
        await db.from("profiles").update({ plan: "pro", stripe_customer_id: typeof cs.customer === "string" ? cs.customer : cs.customer?.id, stripe_subscription_id: typeof cs.subscription === "string" ? cs.subscription : cs.subscription?.id }).eq("id", cs.metadata.profile_id);
      }
      break;
    }
    case "account.updated": {
      const a = event.data.object;
      const ready = !!a.payouts_enabled && a.capabilities?.transfers === "active";
      await db.from("profiles").update({ stripe_payouts_ready: ready }).eq("stripe_account_id", a.id);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const active = sub.status === "active" || sub.status === "trialing";
      const renews = sub.items.data[0]?.current_period_end;
      await db.from("profiles").update({ plan: active ? "pro" : "free", plan_renews_at: renews ? new Date(renews * 1000).toISOString() : null }).eq("stripe_subscription_id", sub.id);
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object;
      const oid = ch.metadata?.order_id;
      if (oid) await db.from("orders").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", oid).in("status", ["paid", "disputed"]);
      break;
    }
    case "charge.dispute.created": {
      const d = event.data.object;
      const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
      if (pi) await db.from("orders").update({ status: "disputed" }).eq("stripe_payment_intent_id", pi).eq("status", "paid");
      break;
    }
  }
  return NextResponse.json({ received: true });
}
