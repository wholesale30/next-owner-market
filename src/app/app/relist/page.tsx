import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import RelistClient from "./RelistClient";

export const metadata = { title: "Relist list" };

export default async function RelistPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ data: items }, { count: doneToday }] = await Promise.all([
    supabase.from("items").select("id, sku, title, price, fb_old_url, posted_to, item_photos(url, sort_order)").not("fb_old_url", "is", null).is("fb_relisted_at", null).order("created_at").limit(200),
    supabase.from("items").select("id", { count: "exact", head: true }).gte("fb_relisted_at", startOfDay.toISOString()),
  ]);
  const list = (items || []).map((i) => ({
    id: i.id as string, sku: i.sku as string, title: (i.title as string) || "Untitled", price: i.price as number | null,
    oldUrl: String(i.fb_old_url).startsWith("http") ? (i.fb_old_url as string) : null,
    postedTo: (i.posted_to as Record<string, string>) || {},
    photo: ((i.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null,
  }));
  return <RelistClient items={list} doneToday={doneToday || 0} />;
}
