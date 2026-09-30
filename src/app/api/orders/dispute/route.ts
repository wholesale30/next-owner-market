import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/** Open a problem on an order (buyer or seller); freezes the money. POST { orderId, reason }. The reporter can withdraw it: POST { orderId, withdraw: true } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId, reason, withdraw } = (await req.json()) as { orderId: string; reason?: string; withdraw?: boolean };
  if (withdraw) {
    const db = admin();
    const { data: o } = await db.from("orders").select("buyer_id, seller_id, status").eq("id", orderId).single();
    if (!o || (o.buyer_id !== me.id && o.seller_id !== me.id)) return NextResponse.json({ error: "Not your order" }, { status: 403 });
    if (o.status !== "disputed") return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
    const { data: d } = await db.from("disputes").select("id, opened_by").eq("order_id", orderId).eq("status", "open").maybeSingle();
    if (!d) return NextResponse.json({ error: "No open problem" }, { status: 400 });
    if (d.opened_by !== me.id) return NextResponse.json({ error: "Only the person who reported it can withdraw it." }, { status: 403 });
    await db.from("disputes").update({ status: "closed", resolution_note: "Withdrawn: sorted out between buyer and seller", resolved_by: me.id, resolved_at: new Date().toISOString() }).eq("id", d.id);
    await db.from("orders").update({ status: "paid" }).eq("id", orderId);
    return NextResponse.json({ ok: true });
  }
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
