import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import RelistClient, { type RelistSettings } from "./RelistClient";

export const metadata = { title: "Relist list" };

export default async function RelistPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ data: items }, { count: doneToday }, { data: posted }, { data: s }] = await Promise.all([
    supabase.from("items").select("id, sku, title, price, status, fb_old_url, posted_to, item_photos(url, sort_order)").not("fb_old_url", "is", null).is("fb_relisted_at", null).order("created_at").limit(300),
    supabase.from("items").select("id", { count: "exact", head: true }).gte("fb_relisted_at", startOfDay.toISOString()),
    supabase.from("items").select("id, sku, title, price, fb_posted_price").not("fb_relisted_at", "is", null).not("fb_posted_price", "is", null).neq("status", "sold").limit(500),
    supabase.from("settings").select("value").eq("key", "relist:settings").maybeSingle(),
  ]);
  const list = (items || []).map((i) => ({
    id: i.id as string, sku: i.sku as string, title: (i.title as string) || "Untitled", price: i.price as number | null, status: i.status as string,
    oldUrl: String(i.fb_old_url).startsWith("http") ? (i.fb_old_url as string) : null,
    postedTo: (i.posted_to as Record<string, string>) || {},
    photo: ((i.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null,
  }));
  const changes = (posted || []).filter((p) => p.price != null && Number(p.price) < Number(p.fb_posted_price)).map((p) => ({ id: p.id as string, sku: p.sku as string, title: (p.title as string) || "Untitled", price: Number(p.price), was: Number(p.fb_posted_price) }));
  const settings: RelistSettings = { perDay: 30, drop: false, pct: 10, days: 7, floorPct: 60, gapMin: 5, gapMax: 20, ...((s?.value as Partial<RelistSettings>) || {}) };
  return <RelistClient items={list} doneToday={doneToday || 0} changes={changes} settings={settings} />;
}
