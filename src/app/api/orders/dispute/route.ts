import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/** Open a problem on an order (buyer or seller). Freezes the money until staff decide. POST { orderId, reason } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId, reason } = (await req.json()) as { orderId: string; reason: string };
  if (!reason?.trim()) return NextResponse.json({ error: "Tell us what went wrong." }, { status: 400 });
  const db = admin();
  const { data: o } = await db.from("orders").select("buyer_id, seller_id, status").eq("id", orderId).single();
  if (!o || (o.buyer_id !== me.id && o.seller_id !== me.id)) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (o.status !== "paid") return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
  const { error } = await db.from("disputes").insert({ order_id: orderId, opened_by: me.id, reason: reason.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("orders").update({ status: "disputed", release_after: null, expires_at: null }).eq("id", orderId);
  await alertStaff("Problem reported on an order", reason.trim().slice(0, 140), "/app/disputes");
  return NextResponse.json({ ok: true });
}
