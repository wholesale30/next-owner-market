import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import PricesClient, { type PriceRow } from "./PricesClient";
import type { PriceCheck } from "@/lib/pricecheck";

export const metadata = { title: "Price check" };
export const dynamic = "force-dynamic";

/** Owner only (Oct 23, 2026): every item of his with his price next to real-comps list / fast / top / lowest prices. */
export default async function PricesPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("items")
    .select("id, sku, title, price, status, drop_pct, price_check, item_photos(url, sort_order)")
    .eq("owner_id", me.id).in("status", ["draft", "pending_review", "active", "reserved"]).order("created_at", { ascending: false }).limit(1000);
  const rows: PriceRow[] = (data || []).map((i) => ({
    id: i.id as string, sku: i.sku as string, title: (i.title as string) || "Untitled", price: i.price as number | null, status: i.status as string,
    drops: !!i.drop_pct, pc: (i.price_check as PriceCheck | null) || null,
    photo: ((i.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null,
  }));
  return <PricesClient rows={rows} />;
}
