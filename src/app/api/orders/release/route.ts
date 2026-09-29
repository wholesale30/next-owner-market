import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { releaseOrder } from "@/lib/orders";

/** Seller/staff enters the buyer's pickup code → funds released. POST { orderId, code } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId, code } = (await req.json()) as { orderId: string; code: string };
  const { data: o } = await admin().from("orders").select("seller_id, pickup_code, status").eq("id", orderId).single();
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const staff = me.role === "admin" || me.role === "staff";
  if (o.seller_id !== me.id && !staff) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (o.status !== "paid") return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
  if (String(code || "").trim() !== o.pickup_code) return NextResponse.json({ error: "That code doesn't match. Ask the buyer to read it from their order page." }, { status: 400 });
  try {
    await releaseOrder(orderId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
