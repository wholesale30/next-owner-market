import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { admin, stripe, stripeSettings } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

async function sendOrderEmails(orderId: string) {
  if (!process.env.RESEND_API_KEY) return;
  const db = admin();
  const { data: o } = await db.from("orders").select("*, items(sku, title)").eq("id", orderId).single();
  if (!o) return;
  const [{ data: buyer }, { data: seller }, { data: biz }] = await Promise.all([
    db.from("profiles").select("email, full_name").eq("id", o.buyer_id).single(),
    db.from("profiles").select("email, full_name, business_name, role, city, state").eq("id", o.seller_id).single(),
    db.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const b = (biz?.value as { name?: string; location?: string; address?: string; pickup_hours?: string; contact_phone?: string }) || {};
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const from = process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`;
  const item = o.items as unknown as { sku: string; title: string };
  const platform = seller?.role === "admin" || seller?.role === "staff";
  const link = `${site}/account/orders/${o.id}`;
  const send = (to: string, subject: string, text: string) => fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text }) }).catch(() => {});
  if (buyer?.email) {
    const where = o.fulfillment === "pickup"
      ? platform ? `Pickup: ${b.address || b.location || "our warehouse"}${b.pickup_hours ? ` (${b.pickup_hours})` : ""}${b.contact_phone ? `, ${b.contact_phone}` : ""}.\nYour pickup code is ${o.pickup_code}. Give it to us only when the item is in your hands; that releases your payment.`
        : `Pickup in ${[seller?.city, seller?.state].filter(Boolean).join(", ") || "the seller's area"}. The seller will message you the exact spot and time (check My account → Messages).\nYour pickup code is ${o.pickup_code}. Give it to the seller only when the item is in your hands; that releases their payment.`
      : `The seller will ship it and add tracking to your order page. Payment releases when you confirm delivery, or 3 days after it's delivered.`;
    await send(buyer.email, `Order confirmed: ${item.title}`, `Thanks${buyer.full_name ? " " + buyer.full_name.split(" ")[0] : ""}. You paid $${Number(o.total).toFixed(2)} for "${item.title}" (${item.sku}).\n\n${where}\n\nYour order: ${link}\nProblem? Use "Report a problem" on that page; your money stays on hold until it's sorted.`);
  }
  if (seller?.email && !platform) {
    await send(seller.email, `You made a sale: ${item.title}`, `${buyer?.full_name || "A buyer"} paid $${Number(o.total).toFixed(2)} for "${item.title}".\n\n${o.fulfillment === "pickup" ? "Message the buyer with a pickup spot and time. At hand-off, enter their 6-digit code on the order page and your payout ($" + Number(o.seller_due).toFixed(2) + ") goes to your bank in about 2 business days." : "Ship it and add the tracking number on the order page. You're paid ($" + Number(o.seller_due).toFixed(2) + ") when the buyer confirms delivery or 3 days after it arrives."}\n\nOrder: ${link}`);
  }
}

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
        await sendOrderEmails(cs.metadata.order_id);
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
