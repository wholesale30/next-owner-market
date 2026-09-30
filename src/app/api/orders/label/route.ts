import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { getRates, buyLabel, shippoReady, type Address } from "@/lib/shippo";

const BOXES: Record<string, { length: number; width: number; height: number }> = { small: { length: 10, width: 8, height: 4 }, medium: { length: 14, width: 12, height: 8 }, large: { length: 20, width: 16, height: 12 }, xl: { length: 24, width: 20, height: 16 } };

/** Seller: GET ?orderId=&box=&weight= → rates; POST { orderId, rateId } → buys the label, stores URL + tracking, deducts cost from payout. */
export async function GET(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!shippoReady()) return NextResponse.json({ error: "Label printing isn't switched on yet. Ship it yourself and add tracking." }, { status: 400 });
  const u = new URL(req.url);
  const orderId = u.searchParams.get("orderId")!; const box = u.searchParams.get("box") || "medium"; const weight = Number(u.searchParams.get("weight") || 0);
  const db = admin();
  const { data: o } = await db.from("orders").select("*, items(title, weight_lbs)").eq("id", orderId).single();
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const staff = me.role === "admin" || me.role === "staff";
  if (o.seller_id !== me.id && !staff) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (o.fulfillment !== "ship" || !o.shipping_address?.address) return NextResponse.json({ error: "This order has no shipping address." }, { status: 400 });
  const from = await shipFrom(o.seller_id);
  if (!from) return NextResponse.json({ error: "Add your ship-from address first (Payouts page → Ship-from address)." }, { status: 400 });
  const a = o.shipping_address as { name?: string; address: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string } };
  const to: Address = { name: a.name || "Buyer", street1: a.address.line1 || "", street2: a.address.line2 || undefined, city: a.address.city || "", state: a.address.state || "", zip: a.address.postal_code || "" };
  const w = weight || Number((o.items as unknown as { weight_lbs: number | null })?.weight_lbs || 0) || 2;
  try {
    const rates = await getRates(from, to, { ...(BOXES[box] || BOXES.medium), weight: w });
    return NextResponse.json({ rates: rates.slice(0, 6).map((r) => ({ id: r.object_id, amount: Number(r.amount), provider: r.provider, service: r.servicelevel.name, days: r.estimated_days })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { orderId, rateId, amount } = (await req.json()) as { orderId: string; rateId: string; amount: number };
  const db = admin();
  const { data: o } = await db.from("orders").select("seller_id, status, label_url").eq("id", orderId).single();
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const staff = me.role === "admin" || me.role === "staff";
  if (o.seller_id !== me.id && !staff) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (o.status !== "paid") return NextResponse.json({ error: `Order is ${o.status}` }, { status: 400 });
  if (o.label_url) return NextResponse.json({ error: "Label already bought." }, { status: 400 });
  try {
    const t = await buyLabel(rateId);
    const cost = typeof t.rate === "object" ? Number(t.rate.amount) : Number(amount || 0);
    const carrier = typeof t.rate === "object" ? `${t.rate.provider} ${t.rate.servicelevel.name}` : "Label";
    await db.from("orders").update({ label_url: t.label_url, label_cost: cost, tracking_carrier: carrier, tracking_number: t.tracking_number, tracking_url: t.tracking_url_provider, shipped_at: new Date().toISOString() }).eq("id", orderId);
    return NextResponse.json({ ok: true, label_url: t.label_url, tracking: t.tracking_number, cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

async function shipFrom(sellerId: string): Promise<Address | null> {
  const db = admin();
  const { data: p } = await db.from("profiles").select("role, full_name, business_name, address1, address2, city, state, zip, phone, email").eq("id", sellerId).single();
  if (!p) return null;
  if (p.role === "admin" || p.role === "staff") {
    const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
    const b = (biz?.value as { name?: string; address?: string; contact_phone?: string; contact_email?: string }) || {};
    const parsed = parseAddress(b.address || "");
    if (!parsed) return null;
    return { name: b.name || "Next Owner Market", ...parsed, phone: b.contact_phone, email: b.contact_email };
  }
  if (!p.address1 || !p.city || !p.state || !p.zip) return null;
  return { name: p.business_name || p.full_name || "Seller", street1: p.address1, street2: p.address2 || undefined, city: p.city, state: p.state, zip: p.zip, phone: p.phone || undefined, email: p.email || undefined };
}
/** "123 Warehouse Rd, Richmond, VA 23220" → parts */
function parseAddress(s: string) {
  const m = s.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})/);
  if (!m) return null;
  return { street1: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] };
}
