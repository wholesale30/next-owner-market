import { createClient as createAdmin } from "@supabase/supabase-js";
import { shareCard } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Item for sale on Next Owner Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: it } = await db.from("items").select("title, price, city, state, shipping_ok, item_photos(url, is_primary)").eq("sku", sku.toUpperCase()).maybeSingle();
  const ph = (it?.item_photos as { url: string; is_primary: boolean }[] | undefined) || [];
  const photo = ph.find((p) => p.is_primary)?.url || ph[0]?.url || null;
  return shareCard({ title: it?.title || "Item", big: it?.price != null ? `$${Math.round(Number(it.price)).toLocaleString()}` : "", sub: [it?.city && it?.state ? `📍 ${it.city}, ${it.state}` : null, it?.shipping_ok ? "🚚 Ships" : "Local pickup"].filter(Boolean).join(" · "), photo });
}
