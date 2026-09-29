import { admin, stripe, cents } from "@/lib/stripe";

/** Release held funds to the seller (transfer) and mark the order released. Staff-owned items need no transfer. */
export async function releaseOrder(orderId: string) {
  const db = admin();
  const { data: o } = await db.from("orders").select("*, profiles!orders_seller_id_fkey(role, stripe_account_id)").eq("id", orderId).single();
  if (!o) throw new Error("Order not found");
  if (o.status !== "paid" && o.status !== "disputed") throw new Error(`Order is ${o.status}`);
  const seller = o.profiles as unknown as { role: string; stripe_account_id: string | null };
  let transferId: string | null = null;
  if (seller.role !== "admin" && seller.role !== "staff") {
    if (!seller.stripe_account_id) throw new Error("Seller has no payout account");
    const s = stripe();
    const pi = await s.paymentIntents.retrieve(o.stripe_payment_intent_id!);
    const t = await s.transfers.create({
      amount: cents(o.seller_due), currency: "usd", destination: seller.stripe_account_id, transfer_group: o.id,
      source_transaction: typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id,
      metadata: { order_id: o.id },
    });
    transferId = t.id;
  }
  const { error } = await db.from("orders").update({ status: "released", released_at: new Date().toISOString(), stripe_transfer_id: transferId }).eq("id", orderId);
  if (error) throw error;
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
