import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { stripe, stripeReady, site } from "@/lib/stripe";

/** Manage/cancel Pro → { url } */
export async function POST() {
  const me = await getProfile();
  if (!me?.stripe_customer_id || !stripeReady()) return NextResponse.json({ error: "No subscription" }, { status: 400 });
  const p = await stripe().billingPortal.sessions.create({ customer: me.stripe_customer_id, return_url: `${site()}${me.role === "buyer" ? "/account" : "/app"}` });
  return NextResponse.json({ url: p.url });
}
