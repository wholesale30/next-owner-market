import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { refundOrder } from "@/lib/orders";

/** Cancel a paid order before hand-off (either party, or staff) → full refund. POST { orderId } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId } = (await req.json()) as { orderId: string };
  const { data: o } = await admin().from("orders").select("buyer_id, seller_id, status, shipped_at").eq("id", orderId).single();
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const staff = me.role === "admin" || me.role === "staff";
  if (o.buyer_id !== me.id && o.seller_id !== me.id && !staff) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  const sellerRefundingDispute = o.status === "disputed" && (o.seller_id === me.id || staff);
  if (o.status !== "paid" && !sellerRefundingDispute) return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
  if (o.status === "paid" && o.shipped_at && !staff) return NextResponse.json({ error: "Already shipped. Open a problem instead." }, { status: 400 });
  try {
    await refundOrder(orderId);
    if (sellerRefundingDispute) await admin().from("disputes").update({ status: "resolved_refund", resolution_note: staff ? "Refunded by staff" : "Seller refunded the buyer", resolved_by: me.id, resolved_at: new Date().toISOString() }).eq("order_id", orderId).eq("status", "open");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
