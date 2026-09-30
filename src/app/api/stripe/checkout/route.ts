import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, stripe, stripeReady, site, cents } from "@/lib/stripe";
import { commissionFor, DEFAULT_TIERS } from "@/lib/listing";
import { quoteShipping } from "@/lib/shipping";

/** Buyer: POST { itemId, fulfillment: "pickup" | "ship" } → { url } to Stripe Checkout. Money is held until hand-off. */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Create a free account to buy." }, { status: 401 });
  if (!stripeReady()) return NextResponse.json({ error: "Checkout isn't switched on yet. Message the seller instead." }, { status: 400 });
  const { itemId, fulfillment, offerId, zip, rateId } = (await req.json()) as { itemId: string; fulfillment: "pickup" | "ship"; offerId?: string; zip?: string; rateId?: string };
  const db = admin();
  const [{ data: item }, { data: tiersRow }, { data: bizRow }] = await Promise.all([
    db.from("items").select("*, profiles!items_owner_id_fkey(id, role, stripe_payouts_ready, default_commission_pct, suspended), item_photos(url, is_primary)").eq("id", itemId).single(),
    db.from("settings").select("value").eq("key", "commission_tiers").maybeSingle(),
    db.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  if (!item || item.status !== "active") return NextResponse.json({ error: "That item isn't available." }, { status: 400 });
  if (item.sale_type === "auction") return NextResponse.json({ error: "This item is in auction. Bid instead." }, { status: 400 });
  const seller = item.profiles as unknown as { id: string; role: string; stripe_payouts_ready: boolean; default_commission_pct: number | null; suspended: boolean };
  if (seller.id === me.id) return NextResponse.json({ error: "That's your own item." }, { status: 400 });
  const platformOwned = seller.role === "admin" || seller.role === "staff";
  if (!platformOwned && (!seller.stripe_payouts_ready || seller.suspended)) return NextResponse.json({ error: "This seller hasn't finished payout setup. Message them instead." }, { status: 400 });
  const ship = fulfillment === "ship";
  if (ship && !item.shipping_ok) return NextResponse.json({ error: "This item is local pickup only." }, { status: 400 });
  if (!ship && !item.local_pickup_ok) return NextResponse.json({ error: "This item ships only." }, { status: 400 });

  let amount = Number(item.price);
  if (offerId) {
    const { data: off } = await db.from("offers").select("*").eq("id", offerId).single();
    if (!off || off.buyer_id !== me.id || off.item_id !== item.id || off.status !== "accepted" || new Date(off.expires_at) < new Date()) return NextResponse.json({ error: "That offer isn't valid any more." }, { status: 400 });
    amount = Number(off.amount);
  }
  const tiers = (tiersRow?.value as typeof DEFAULT_TIERS) || DEFAULT_TIERS;
  // commission: platform-owned items keep 100% (0% commission = all to platform anyway); consignment uses tier; self-listed default
  const pct = platformOwned ? 0 : commissionFor(item, seller.default_commission_pct, tiers);
  let shipping = 0, shippingService: string | null = null, shippingRateId: string | null = null, shippingMode = "flat";
  if (ship) {
    const q = await quoteShipping(item.id, zip || me.zip || null, rateId || null);
    if (!q) return NextResponse.json({ error: "This item can't be shipped." }, { status: 400 });
    shipping = q.amount; shippingService = q.service; shippingRateId = q.rateId; shippingMode = q.mode;
  }

  // Big-ticket vehicles: card checkout takes a deposit that holds it; balance is paid at hand-off with a bill of sale.
  const biz = (bizRow?.value as { vehicle_card_max?: number; vehicle_deposit_pct?: number; vehicle_deposit_min?: number; vehicle_deposit_max?: number }) || {};
  let fullPrice: number | null = null;
  let orderPct = pct;
  const { data: isVeh } = item.category_id ? await db.rpc("is_vehicle_category", { p_cat: item.category_id }) : { data: false };
  if (isVeh && amount > Number(biz.vehicle_card_max ?? 5000)) {
    fullPrice = amount;
    const dep = Math.min(Math.max(Math.round(amount * Number(biz.vehicle_deposit_pct ?? 5) / 100), Number(biz.vehicle_deposit_min ?? 100)), Number(biz.vehicle_deposit_max ?? 500));
    // platform fee = commission on the full price, but never more than 80% of the deposit; expressed as a pct of the deposit so the generated columns still work
    orderPct = platformOwned ? 0 : Math.min(80, Math.round((fullPrice * pct / 100) / dep * 10000) / 100);
    amount = dep;
  }

  const { data: order, error } = await db.from("orders").insert({
    item_id: item.id, buyer_id: me.id, seller_id: seller.id, fulfillment: ship ? "ship" : "pickup",
    amount, shipping, commission_pct: orderPct, offer_id: offerId || null, shipping_service: shippingService, shipping_rate_id: shippingRateId, shipping_mode: shippingMode, full_price: fullPrice,
  }).select("*").single();
  if (error || !order) return NextResponse.json({ error: error?.message || "Could not start order" }, { status: 500 });

  const photo = (item.item_photos as { url: string; is_primary: boolean }[] | null)?.find((p) => p.is_primary)?.url || (item.item_photos as { url: string }[] | null)?.[0]?.url;
  const s = stripe();
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer_email: me.email || undefined,
    line_items: [
      { price_data: { currency: "usd", unit_amount: cents(amount), product_data: { name: fullPrice ? `Deposit to hold: ${item.title} (balance $${(fullPrice - amount).toFixed(2)} at pickup)` : item.title, images: photo ? [photo] : undefined, metadata: { sku: item.sku } } }, quantity: 1 },
      ...(shipping > 0 ? [{ price_data: { currency: "usd", unit_amount: cents(shipping), product_data: { name: `Shipping (${shippingService || "ground"})` } }, quantity: 1 }] : []),
    ],
    payment_intent_data: { transfer_group: order.id, metadata: { order_id: order.id, item_id: item.id, sku: item.sku }, description: `${item.sku} ${item.title}`.slice(0, 200) },
    metadata: { order_id: order.id },
    ...(ship ? { shipping_address_collection: { allowed_countries: ["US"] } } : {}),
    success_url: `${site()}/account/orders/${order.id}?paid=1`,
    cancel_url: `${site()}/item/${item.sku}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  await db.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
  return NextResponse.json({ url: session.url });
}
