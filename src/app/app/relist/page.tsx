import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import RelistClient, { type RelistSettings } from "./RelistClient";
import type { PriceCheck } from "@/lib/pricecheck";
import { etStartOfDay } from "@/lib/et";

export const metadata = { title: "Relist list" };

export default async function RelistPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app"); // owner only (Oct 23, 2026)
  const supabase = await createClient();
  const startOfDay = etStartOfDay();
  const [{ data: orig }, { data: items }, { count: doneToday }, { data: posted }, { data: s }] = await Promise.all([
    supabase.from("fb_import_queue").select("item_id, data").not("item_id", "is", null).limit(2000),
    supabase.from("items").select("id, sku, title, price, status, description, fb_location, fb_old_url, fb_pick, fb_hold, fb_remove, fb_removed_at, fb_listed_at, price_check, my_price, posted_to, item_photos(url, sort_order)").not("fb_old_url", "is", null).is("fb_relisted_at", null).order("fb_pick", { ascending: true, nullsFirst: false }).order("created_at").limit(500),
    supabase.from("items").select("id", { count: "exact", head: true }).gte("fb_relisted_at", startOfDay.toISOString()),
    supabase.from("items").select("id, sku, title, price, fb_posted_price, fb_relisted_at, item_photos(url, sort_order)").not("fb_relisted_at", "is", null).eq("fb_remove", false).not("status", "in", "(sold,shipped,archived)").order("fb_relisted_at").limit(1000),
    supabase.from("settings").select("value").eq("key", "relist:settings").maybeSingle(),
  ]);
  // his own Facebook price, kept so he can always go back to it
  const mine = new Map((orig || []).map((o) => [o.item_id as string, Math.round(Number(String((o.data as { price?: unknown })?.price ?? "").replace(/[^0-9.]/g, ""))) || null]));
  const list = (items || []).map((i) => ({
    id: i.id as string, sku: i.sku as string, title: (i.title as string) || "Untitled", price: i.price as number | null, status: i.status as string,
    oldUrl: String(i.fb_old_url).startsWith("http") ? (i.fb_old_url as string) : null,
    postedTo: (i.posted_to as Record<string, string>) || {},
    pick: (i.fb_pick as string | null) || null, hold: !!i.fb_hold,
    description: (i.description as string) || "", location: (i.fb_location as string | null) || null,
    removing: !!i.fb_remove && !i.fb_removed_at, removedAt: (i.fb_removed_at as string | null) || null, listedAt: (i.fb_listed_at as string | null) || null, mine: i.my_price != null ? Number(i.my_price) : mine.get(i.id as string) ?? null, pc: (i.price_check as PriceCheck | null) || null,
    photo: ((i.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null,
  }));
  const live = (posted || []).map((p) => ({ id: p.id as string, title: (p.title as string) || "Untitled", price: p.price as number | null, at: p.fb_relisted_at as string, photo: ((p.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null }));
  const changes = (posted || []).filter((p) => p.fb_posted_price != null && p.price != null && Number(p.price) < Number(p.fb_posted_price)).map((p) => ({ id: p.id as string, sku: p.sku as string, title: (p.title as string) || "Untitled", price: Number(p.price), was: Number(p.fb_posted_price) }));
  const settings: RelistSettings = { perDay: 15, drop: false, pct: 10, days: 7, floorPct: 60, gapMin: 5, gapMax: 15, relistAfter: 14, startHour: 7, endHour: 19, order: "old", ...((s?.value as Partial<RelistSettings>) || {}) };
  // who messaged about each item on Facebook-now (for the 💰 Sold buyer pick list)
  const liveIds = live.map((l) => l.id);
  const [{ data: convos }, { data: soldRows }] = await Promise.all([
    liveIds.length ? supabase.from("conversations").select("item_id, buyer_name, buyer_contact").in("item_id", liveIds).limit(2000) : Promise.resolve({ data: [] as { item_id: string; buyer_name: string | null; buyer_contact: string }[] }),
    // sales from the Facebook ads this app brought in (the proof numbers)
    supabase.from("items").select("id, title, fb_relisted_at, fb_listed_at, sold_at, sales(sale_price, buyer_name, sold_at)").not("fb_old_url", "is", null).eq("status", "sold").order("sold_at", { ascending: false }).limit(500),
  ]);
  const buyers: Record<string, { name: string; contact: string }[]> = {};
  for (const c of convos || []) (buyers[c.item_id as string] ||= []).push({ name: (c.buyer_name as string) || "", contact: (c.buyer_contact as string) || "" });
  const sold = (soldRows || []).map((r) => {
    const s = ((r.sales as { sale_price: number; buyer_name: string | null; sold_at: string }[]) || [])[0];
    const from = (r.fb_relisted_at as string | null) || null;
    return { id: r.id as string, title: (r.title as string) || "Untitled", price: s ? Number(s.sale_price) : null, buyer: s?.buyer_name || null, soldAt: (s?.sold_at || r.sold_at) as string, reposted: from, days: from ? Math.max(0, Math.round((new Date((s?.sold_at || r.sold_at) as string).getTime() - new Date(from).getTime()) / 86400000)) : null };
  });
  return <RelistClient items={list} doneToday={doneToday || 0} changes={changes} settings={settings} live={live} buyers={buyers} sold={sold} />;
}
