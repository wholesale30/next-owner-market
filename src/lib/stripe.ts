import Stripe from "stripe";
import { createClient as createAdmin } from "@supabase/supabase-js";

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not set up yet. Add STRIPE_SECRET_KEY.");
  return new Stripe(key);
}
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;

export function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
export const cents = (n: number | string) => Math.round(Number(n) * 100);

/** Platform settings stored in the settings table (webhook secret, pro price id). Server-only. */
export async function stripeSettings() {
  const { data } = await admin().from("settings").select("value").eq("key", "stripe").maybeSingle();
  return (data?.value as { webhook_secret?: string; pro_price_id?: string; connect_enabled?: boolean }) || {};
}
