import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { refundOrder, releaseOrder } from "@/lib/orders";

/** Staff decide a dispute. POST { orderId, action: "refund" | "release", note } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const { orderId, action, note } = (await req.json()) as { orderId: string; action: "refund" | "release"; note?: string };
  try {
    if (action === "refund") await refundOrder(orderId); else await releaseOrder(orderId);
    await admin().from("disputes").update({ status: action === "refund" ? "resolved_refund" : "resolved_release", resolution_note: note || null, resolved_by: me.id, resolved_at: new Date().toISOString() }).eq("order_id", orderId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
