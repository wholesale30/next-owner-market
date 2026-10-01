import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";

/** ISO time `ms` ago (helper so pages stay pure). */
export function since(ms: number) { return new Date(Date.now() - ms).toISOString(); }

/** Buy or Pass: free checks per rolling day for signed-in free accounts (Pro and staff: unlimited). */
export const BP_FREE_DAILY = 5;

type Me = { id: string; role: string };

/** "I bought it: list it now." Turns a Buy or Pass check into a draft listing with the photo, price and what you paid. */
export async function listFromScan(me: Me, scanId: string, extraPhotos: string[] = []): Promise<{ item_id?: string; error?: string; status?: number }> {
  const d = admin();
  const { data: s } = await d.from("buy_pass_scans").select("*").eq("id", scanId).maybeSingle();
  if (!s) return { error: "Couldn't find that check.", status: 404 };
  if (s.owner_id && s.owner_id !== me.id) return { error: "That isn't yours.", status: 403 };
  if (s.item_id) return { item_id: s.item_id };
  if (me.role === "buyer") { const supabase = await createClient(); await supabase.rpc("become_seller"); }
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/`;
  const photos = [...new Set([s.photo_url, ...extraPhotos].filter((u): u is string => !!u && u.startsWith(base)))].slice(0, 6);
  const price = Math.round((Number(s.resale_low) + Number(s.resale_high)) / 2);
  const { data: item, error } = await d.from("items").insert({
    owner_id: me.id, created_by: me.id, title: String(s.listing_title || s.what).slice(0, 80), description: "", price,
    price_min_suggested: s.resale_low, price_max_suggested: s.resale_high, cost: s.paid, status: "draft", ai_generated: true,
    local_pickup_ok: true, shipping_ok: true, shipping_mode: "calculated",
  }).select("id").single();
  if (error || !item) return { error: error?.message || "Couldn't make the listing.", status: 500 };
  if (photos.length) await d.from("item_photos").insert(photos.map((url, i) => ({ item_id: item.id, storage_path: url.slice(base.length), url, sort_order: i, is_primary: i === 0 })));
  await d.from("buy_pass_scans").update({ bought: true, item_id: item.id, owner_id: me.id }).eq("id", s.id);
  return { item_id: item.id };
}

/** After signup: a check made while signed out becomes theirs (only unclaimed checks from the last day). */
export async function claimScan(meId: string, scanId: string) {
  await admin().from("buy_pass_scans").update({ owner_id: meId }).eq("id", scanId).is("owner_id", null).gte("created_at", new Date(Date.now() - 86400_000).toISOString());
}
