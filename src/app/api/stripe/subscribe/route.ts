import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, stripe, stripeReady, stripeSettings, site } from "@/lib/stripe";

/** Start a Pro subscription → { url } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!stripeReady()) return NextResponse.json({ error: "Pro isn't available yet." }, { status: 400 });
  const { plan, back: backTo } = (await req.json().catch(() => ({}))) as { plan?: string; back?: string };
  const thrift = plan === "thrift", power = plan === "power";
  const kind = thrift ? "thrift" : power ? "power" : "pro";
  const { pro_price_id } = await stripeSettings();
  if (kind === "pro" && !pro_price_id) return NextResponse.json({ error: "Pro isn't set up yet." }, { status: 400 });
  const s = stripe();
  let customer = me.stripe_customer_id as string | null;
  if (!customer) {
    const c = await s.customers.create({ email: me.email || undefined, name: me.full_name || undefined, metadata: { profile_id: me.id } });
    customer = c.id;
    await admin().from("profiles").update({ stripe_customer_id: customer }).eq("id", me.id);
  }
  const back = typeof backTo === "string" && /^\/[a-z0-9/_-]*$/i.test(backTo) ? backTo : me.role === "buyer" ? "/account" : "/app";
  const months = Number(me.pro_credit_months || 0);
  let discounts: { coupon: string }[] | undefined;
  if (months > 0 && kind === "pro") {
    const c = await s.coupons.create({ percent_off: 100, duration: "repeating", duration_in_months: months, name: `Referral credit: ${months} free month${months > 1 ? "s" : ""}`, max_redemptions: 1 });
    discounts = [{ coupon: c.id }];
    await admin().from("profiles").update({ pro_credit_months: 0 }).eq("id", me.id);
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription", customer,
    // Thrift Pro $3.99/month (up to 30 checks a day) and Power Seller $39/month (1,000 AI uses a month). Prices are set here; no dashboard setup needed.
    line_items: thrift ? [{ price_data: { currency: "usd", unit_amount: 399, recurring: { interval: "month" }, product_data: { name: "Thrift Pro: up to 30 checks a day" } }, quantity: 1 }]
      : power ? [{ price_data: { currency: "usd", unit_amount: 3900, recurring: { interval: "month" }, product_data: { name: "Power Seller: 1,000 AI uses a month" } }, quantity: 1 }]
      : [{ price: pro_price_id!, quantity: 1 }],
    ...(discounts ? { discounts } : {}),
    metadata: { profile_id: me.id, plan: kind }, subscription_data: { metadata: { profile_id: me.id, plan: kind } },
    success_url: `${site()}${back}?${kind}=1`, cancel_url: `${site()}${back}`,
  });
  return NextResponse.json({ url: session.url });
}
