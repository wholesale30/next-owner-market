import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { releaseOrder } from "@/lib/orders";

/** Buyer confirms "I got it" → release now. POST { orderId } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId } = (await req.json()) as { orderId: string };
  const { data: o } = await admin().from("orders").select("buyer_id, status").eq("id", orderId).single();
  if (!o || o.buyer_id !== me.id) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (o.status !== "paid") return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
  try {
    await releaseOrder(orderId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
