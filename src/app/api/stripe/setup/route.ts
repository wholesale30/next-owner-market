import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, stripe, stripeReady, site, cents } from "@/lib/stripe";

/** Admin: one-tap Stripe setup. Creates the webhook endpoint and the Pro subscription price, stores them in settings. Safe to re-run. */
export async function POST() {
  const me = await getProfile();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!stripeReady()) return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set yet." }, { status: 400 });
  const s = stripe();
  const db = admin();
  const { data: cur } = await db.from("settings").select("value").eq("key", "stripe").maybeSingle();
  const st = (cur?.value as Record<string, unknown>) || {};
  const { data: plans } = await db.from("settings").select("value").eq("key", "plans").maybeSingle();
  const proMonthly = Number((plans?.value as { pro_monthly?: number })?.pro_monthly || 15);

  // webhook
  const url = `${site()}/api/stripe/webhook`;
  const existing = (await s.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === url);
  if (!existing || !st.webhook_secret) {
    if (existing) await s.webhookEndpoints.del(existing.id);
    const w = await s.webhookEndpoints.create({
      url,
      enabled_events: ["checkout.session.completed", "account.updated", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "charge.refunded", "charge.dispute.created"],
    });
    st.webhook_secret = w.secret;
  }

  // pro price
  if (!st.pro_price_id) {
    const product = await s.products.create({ name: "Next Owner Market Pro", description: "Unlimited AI listings, cross-posting, batch Snap, video, unlimited live listings." });
    const price = await s.prices.create({ product: product.id, unit_amount: cents(proMonthly), currency: "usd", recurring: { interval: "month" } });
    st.pro_price_id = price.id;
  }

  // payment methods: turn on Cash App Pay + Link (+ keep cards) on the default configuration
  try {
    const cfgs = await s.paymentMethodConfigurations.list({ limit: 10 });
    const def = cfgs.data.find((c) => c.is_default) || cfgs.data[0];
    if (def) {
      await s.paymentMethodConfigurations.update(def.id, {
        card: { display_preference: { preference: "on" } },
        cashapp: { display_preference: { preference: "on" } },
        link: { display_preference: { preference: "on" } },
        affirm: { display_preference: { preference: "on" } },
        klarna: { display_preference: { preference: "on" } },
      });
      st.payment_methods = "card, cashapp, link, affirm, klarna, apple/google pay";
    }
  } catch (e) { st.payment_methods_error = e instanceof Error ? e.message : String(e); }

  // connect check
  try {
    await s.accounts.list({ limit: 1 });
    st.connect_enabled = true;
  } catch {
    st.connect_enabled = false;
  }

  await db.from("settings").upsert({ key: "stripe", value: st });
  return NextResponse.json({ ok: true, connect_enabled: st.connect_enabled, webhook: url, pro_price_id: st.pro_price_id });
}
