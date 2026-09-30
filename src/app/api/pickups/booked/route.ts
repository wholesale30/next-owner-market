import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, site } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/** After a buyer books a warehouse slot: confirmation email to the buyer + staff alert. POST { pickupId } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { pickupId } = (await req.json()) as { pickupId: string };
  const db = admin();
  const { data: p } = await db.from("pickups").select("*, pickup_slots(starts_at, ends_at), items(sku, title), orders(id, pickup_code)").eq("id", pickupId).single();
  if (!p || p.buyer_id !== me.id) return NextResponse.json({ error: "Not yours" }, { status: 403 });
  const slot = p.pickup_slots as unknown as { starts_at: string; ends_at: string };
  const item = p.items as unknown as { sku: string; title: string };
  const order = p.orders as unknown as { id: string; pickup_code: string };
  const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
  const b = (biz?.value as { name?: string; address?: string; location?: string; contact_phone?: string }) || {};
  const when = `${new Date(slot.starts_at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}–${new Date(slot.ends_at).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })}`;
  if (process.env.RESEND_API_KEY && me.email) {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`, to: [me.email], subject: `Pickup confirmed: ${when}`, text: `You're set to pick up "${item.title}" on ${when}.\n\nWhere: ${b.address || b.location || "our warehouse"}${b.contact_phone ? `\nPhone: ${b.contact_phone}` : ""}\nYour pickup code: ${order.pickup_code} (give it to us when the item is in your hands)\n\nNeed to change it? ${site()}/account/orders/${order.id}` }) }).catch(() => {});
  }
  await alertStaff(`Pickup booked: ${when}`, `${me.full_name || me.email}: "${item.title}" (${item.sku}).`, "/app/pickups");
  return NextResponse.json({ ok: true });
}
