import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, stripe, stripeReady, site } from "@/lib/stripe";

/** Seller: start or continue Stripe payout onboarding. Returns a URL to send them to. */
export async function POST() {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!stripeReady()) return NextResponse.json({ error: "Payouts aren't switched on yet. Check back soon." }, { status: 400 });
  const s = stripe();
  const db = admin();
  let acct = me.stripe_account_id as string | null;
  try {
  if (!acct) {
    const a = await s.accounts.create({
      type: "express",
      email: me.email || undefined,
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      metadata: { profile_id: me.id },
      business_profile: { product_description: "Secondhand and surplus goods sold on Next Owner Market" },
    });
    acct = a.id;
    await db.from("profiles").update({ stripe_account_id: acct }).eq("id", me.id);
  }
  const back = me.role === "buyer" ? "/account" : "/app/money";
  const link = await s.accountLinks.create({ account: acct, type: "account_onboarding", refresh_url: `${site()}${back}?stripe=refresh`, return_url: `${site()}${back}?stripe=return` });
  return NextResponse.json({ url: link.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("settings").upsert({ key: `err:connect:${Date.now()}`, value: { message, user: me.id, email: me.email } }).then(() => {}, () => {});
    const platformIssue = /platform profile|questionnaire|connect/i.test(message);
    // tell staff once per day, with the real reason; tell the seller something calm
    const { data: last } = await db.from("settings").select("value").eq("key", "err:connect:last_alert").maybeSingle();
    const lastAt = (last?.value as { at?: string })?.at;
    if (!lastAt || Date.now() - new Date(lastAt).getTime() > 86400_000) {
      try { const { alertStaff } = await import("@/lib/alert"); await alertStaff("Payout setup is failing for sellers", `${me.email || me.id} tried to set up payouts. Stripe said: ${message}`, "/app/ops"); } catch { /* ok */ }
      await db.from("settings").upsert({ key: "err:connect:last_alert", value: { at: new Date().toISOString(), message } });
    }
    await db.from("profiles").update({ payout_setup_requested_at: new Date().toISOString() }).eq("id", me.id).then(() => {}, () => {});
    return NextResponse.json({ error: platformIssue
      ? "Payouts are opening in the next day or two (our payment partner is finishing our setup). Your listings are fine; we'll email you the moment Set up payouts is ready, and you can keep listing meanwhile."
      : "Couldn't reach our payment partner just now. Try again in a few minutes; if it keeps happening, message us from Help." }, { status: 503 });
  }
}

/** Refresh payout-ready status from Stripe (called when they come back). */
export async function GET() {
  const me = await getProfile();
  if (!me?.stripe_account_id || !stripeReady()) return NextResponse.json({ ready: false });
  const a = await stripe().accounts.retrieve(me.stripe_account_id);
  const ready = !!a.payouts_enabled && !!(a.capabilities?.transfers === "active");
  await admin().from("profiles").update({ stripe_payouts_ready: ready }).eq("id", me.id);
  return NextResponse.json({ ready });
}
