import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, stripe, stripeReady, stripeSettings, site } from "@/lib/stripe";

/** Start a Pro subscription → { url } */
export async function POST() {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!stripeReady()) return NextResponse.json({ error: "Pro isn't available yet." }, { status: 400 });
  const { pro_price_id } = await stripeSettings();
  if (!pro_price_id) return NextResponse.json({ error: "Pro isn't set up yet." }, { status: 400 });
  const s = stripe();
  let customer = me.stripe_customer_id as string | null;
  if (!customer) {
    const c = await s.customers.create({ email: me.email || undefined, name: me.full_name || undefined, metadata: { profile_id: me.id } });
    customer = c.id;
    await admin().from("profiles").update({ stripe_customer_id: customer }).eq("id", me.id);
  }
  const back = me.role === "buyer" ? "/account" : "/app";
  const session = await s.checkout.sessions.create({
    mode: "subscription", customer, line_items: [{ price: pro_price_id, quantity: 1 }],
    metadata: { profile_id: me.id }, subscription_data: { metadata: { profile_id: me.id } },
    success_url: `${site()}${back}?pro=1`, cancel_url: `${site()}${back}`,
  });
  return NextResponse.json({ url: session.url });
}
