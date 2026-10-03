import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, stripe, stripeReady, site } from "@/lib/stripe";
import { PACKS } from "@/lib/usage";

/** Buy more AI uses, one time: { pack: 100 | 300, back } -> { url }. They never expire. */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in first", signup: true }, { status: 401 });
  if (!stripeReady()) return NextResponse.json({ error: "Packs aren't available yet." }, { status: 400 });
  const { pack, back: backTo } = (await req.json().catch(() => ({}))) as { pack?: string | number; back?: string };
  const p = PACKS[String(pack)];
  if (!p) return NextResponse.json({ error: "Pick a pack." }, { status: 400 });
  const s = stripe();
  let customer = me.stripe_customer_id as string | null;
  if (!customer) {
    const c = await s.customers.create({ email: me.email || undefined, name: me.full_name || undefined, metadata: { profile_id: me.id } });
    customer = c.id;
    await admin().from("profiles").update({ stripe_customer_id: customer }).eq("id", me.id);
  }
  const back = typeof backTo === "string" && /^\/[a-z0-9/_-]*$/i.test(backTo) ? backTo : "/app";
  const session = await s.checkout.sessions.create({
    mode: "payment", customer,
    line_items: [{ price_data: { currency: "usd", unit_amount: p.cents, product_data: { name: `${p.uses} more AI uses (never expire)` } }, quantity: 1 }],
    metadata: { profile_id: me.id, topup: String(p.uses) },
    success_url: `${site()}${back}?topup=${p.uses}`, cancel_url: `${site()}${back}`,
  });
  return NextResponse.json({ url: session.url });
}
