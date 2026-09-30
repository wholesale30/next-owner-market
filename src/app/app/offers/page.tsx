import { createClient, getProfile } from "@/lib/supabase/server";
import OffersClient from "./OffersClient";

export const metadata = { title: "Offers" };

export default async function OffersPage() {
  const me = (await getProfile())!;
  const staff = me.role === "admin" || me.role === "staff";
  const supabase = await createClient();
  let q = supabase.from("offers").select("id, buyer_id, amount, counter_amount, fulfillment, status, message, expires_at, created_at, items(id, sku, title, price, item_photos(url, is_primary))").order("created_at", { ascending: false }).limit(200);
  if (!staff) q = q.eq("seller_id", me.id);
  const { data } = await q;
  const ids = Array.from(new Set((data || []).map((o) => o.buyer_id)));
  const { data: buyers } = ids.length ? await supabase.from("seller_public").select("id, display_name, rating_avg, rating_count, city, state").in("id", ids) : { data: [] };
  const merged = (data || []).map((o) => ({ ...o, seller_public: (buyers || []).find((b) => b.id === o.buyer_id) || null }));
  return <OffersClient offers={merged as never} />;
}
