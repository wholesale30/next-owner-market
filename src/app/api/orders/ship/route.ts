import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";

/** Seller adds tracking. POST { orderId, carrier, number } ; or marks delivered: { orderId, delivered: true } (starts the 3-day auto-release clock) */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId, carrier, number, delivered } = (await req.json()) as { orderId: string; carrier?: string; number?: string; delivered?: boolean };
  const db = admin();
  const { data: o } = await db.from("orders").select("seller_id, status, fulfillment").eq("id", orderId).single();
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const staff = me.role === "admin" || me.role === "staff";
  if (o.seller_id !== me.id && !staff) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (o.status !== "paid") return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (carrier || number) { patch.tracking_carrier = carrier || null; patch.tracking_number = number || null; patch.shipped_at = new Date().toISOString(); }
  if (delivered) { patch.delivered_at = new Date().toISOString(); patch.release_after = new Date(Date.now() + 3 * 86400000).toISOString(); }
  const { error } = await db.from("orders").update(patch).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
