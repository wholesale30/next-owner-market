import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import RelistClient, { type RelistSettings } from "./RelistClient";

export const metadata = { title: "Relist list" };

export default async function RelistPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app"); // owner only (Oct 23, 2026)
  const supabase = await createClient();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ data: items }, { count: doneToday }, { data: posted }, { data: s }] = await Promise.all([
    supabase.from("items").select("id, sku, title, price, status, description, fb_location, fb_old_url, fb_pick, fb_hold, fb_remove, fb_removed_at, posted_to, item_photos(url, sort_order)").not("fb_old_url", "is", null).is("fb_relisted_at", null).order("fb_pick", { ascending: true, nullsFirst: false }).order("created_at").limit(500),
    supabase.from("items").select("id", { count: "exact", head: true }).gte("fb_relisted_at", startOfDay.toISOString()),
    supabase.from("items").select("id, sku, title, price, fb_posted_price, fb_relisted_at, item_photos(url, sort_order)").not("fb_relisted_at", "is", null).eq("fb_remove", false).not("status", "in", "(sold,shipped,archived)").order("fb_relisted_at").limit(1000),
    supabase.from("settings").select("value").eq("key", "relist:settings").maybeSingle(),
  ]);
  const list = (items || []).map((i) => ({
    id: i.id as string, sku: i.sku as string, title: (i.title as string) || "Untitled", price: i.price as number | null, status: i.status as string,
    oldUrl: String(i.fb_old_url).startsWith("http") ? (i.fb_old_url as string) : null,
    postedTo: (i.posted_to as Record<string, string>) || {},
    pick: (i.fb_pick as string | null) || null, hold: !!i.fb_hold,
    description: (i.description as string) || "", location: (i.fb_location as string | null) || null,
    removing: !!i.fb_remove && !i.fb_removed_at,
    photo: ((i.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null,
  }));
  const live = (posted || []).map((p) => ({ id: p.id as string, title: (p.title as string) || "Untitled", price: p.price as number | null, at: p.fb_relisted_at as string, photo: ((p.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null }));
  const changes = (posted || []).filter((p) => p.fb_posted_price != null && p.price != null && Number(p.price) < Number(p.fb_posted_price)).map((p) => ({ id: p.id as string, sku: p.sku as string, title: (p.title as string) || "Untitled", price: Number(p.price), was: Number(p.fb_posted_price) }));
  const settings: RelistSettings = { perDay: 15, drop: false, pct: 10, days: 7, floorPct: 60, gapMin: 5, gapMax: 15, relistAfter: 14, ...((s?.value as Partial<RelistSettings>) || {}) };
  return <RelistClient items={list} doneToday={doneToday || 0} changes={changes} settings={settings} live={live} />;
}
