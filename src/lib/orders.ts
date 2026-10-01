import { admin, stripe, cents } from "@/lib/stripe";

/** Release held funds to the seller (transfer) and mark the order released. Staff-owned items need no transfer. */
export async function releaseOrder(orderId: string) {
  const db = admin();
  const { data: o } = await db.from("orders").select("*, profiles!orders_seller_id_fkey(role, stripe_account_id, stripe_payouts_ready, email, full_name), items(title)").eq("id", orderId).single();
  if (!o) throw new Error("Order not found");
  if (o.status !== "paid" && o.status !== "disputed") throw new Error(`Order is ${o.status}`);
  const seller = o.profiles as unknown as { role: string; stripe_account_id: string | null; stripe_payouts_ready: boolean; email: string | null; full_name: string | null };
  let transferId: string | null = null;
  let pending = false;
  if (seller.role !== "admin" && seller.role !== "staff") {
    if (!seller.stripe_account_id || !seller.stripe_payouts_ready) pending = true;
    else {
      try { transferId = await transferFor(o); } catch (e) { console.error("transfer failed, holding", o.id, e); pending = true; }
    }
  }
  const now = new Date().toISOString();
  const { error } = await db.from("orders").update({ status: "released", released_at: now, stripe_transfer_id: transferId, payout_pending: pending, payout_pending_since: pending ? now : null }).eq("id", orderId);
  if (error) throw error;
  if (pending && seller.email) {
    const { sendAutoEmail } = await import("@/lib/automations");
    const amt = `$${Number(o.seller_due || 0).toFixed(2)}`;
    const title = (o.items as unknown as { title?: string } | null)?.title || "your item";
    await sendAutoEmail(seller.email, `You sold ${title}. ${amt} is waiting for you`, `Hi ${seller.full_name?.split(" ")[0] || "there"},\n\nYour sale is done and ${amt} is being held for you.\n\nTo get it, set up payouts (about 5 minutes: name, address, bank account, handled by Stripe):\n${process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com"}/app/money\n\nThe moment you finish, the money is sent to your bank automatically, along with anything else you sell.`, { profile_id: o.seller_id, kind: "payout_waiting", ref_id: o.id });
  }
}

/** Send a released order's money to the seller's Stripe account. Returns the transfer id. */
async function transferFor(o: { id: string; seller_due: number; stripe_payment_intent_id: string | null; seller_id: string }) {
  const db = admin();
  const { data: p } = await db.from("profiles").select("stripe_account_id").eq("id", o.seller_id).single();
  if (!p?.stripe_account_id) throw new Error("no account");
  const s = stripe();
  const pi = await s.paymentIntents.retrieve(o.stripe_payment_intent_id!);
  const t = await s.transfers.create({
    amount: cents(o.seller_due), currency: "usd", destination: p.stripe_account_id, transfer_group: o.id,
    source_transaction: typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id,
    metadata: { order_id: o.id },
  });
  return t.id;
}

/** Pay out everything held for a seller who has now finished payout setup. Returns count and total sent. */
export async function payPendingFor(sellerId: string) {
  const db = admin();
  const { data: p } = await db.from("profiles").select("stripe_account_id, stripe_payouts_ready").eq("id", sellerId).single();
  if (!p?.stripe_account_id || !p.stripe_payouts_ready) return { paid: 0, total: 0 };
  const { data: owed } = await db.from("orders").select("id, seller_due, stripe_payment_intent_id, seller_id").eq("seller_id", sellerId).eq("payout_pending", true);
  let paid = 0, total = 0;
  for (const o of owed || []) {
    try {
      const tid = await transferFor(o);
      await db.from("orders").update({ payout_pending: false, stripe_transfer_id: tid }).eq("id", o.id);
      paid++; total += Number(o.seller_due || 0);
    } catch (e) { console.error("pending transfer failed", o.id, e); }
  }
  return { paid, total };
}

/** Refund the buyer in full and mark the order refunded. */
export async function refundOrder(orderId: string) {
  const db = admin();
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!o) throw new Error("Order not found");
  if (o.status !== "paid" && o.status !== "disputed") throw new Error(`Order is ${o.status}`);
  const r = await stripe().refunds.create({ payment_intent: o.stripe_payment_intent_id!, metadata: { order_id: o.id } });
  const { error } = await db.from("orders").update({ status: "refunded", refunded_at: new Date().toISOString(), stripe_refund_id: r.id }).eq("id", orderId);
  if (error) throw error;
}
