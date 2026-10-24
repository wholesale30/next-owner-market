import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { cleanAiTells, facebookCopy } from "@/lib/listing";
import { type Item } from "@/lib/types";
import NextClient from "./NextClient";

export const metadata = { title: "Next Facebook post" };
export const dynamic = "force-dynamic";

/**
 * One listing at a time, in plain labeled text, for posting to Facebook by hand or by Claude in Chrome (Oct 23, 2026).
 * The page itself paces the posts: after each "Posted it" it picks a random wait (his min–max minutes) and won't show
 * the next listing until then, and it stops at his daily number.
 */
const FB_CONDITION: Record<string, string> = { new: "New", like_new: "Used - Like New", good: "Used - Good", fair: "Used - Fair", for_parts: "Used - Fair (for parts)" };

export default async function NextPostPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app"); // owner only (Oct 23, 2026)
  const supabase = await createClient();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { data: ordRow } = await supabase.from("settings").select("value").eq("key", "relist:settings").maybeSingle();
  const order = ((ordRow?.value as { order?: string } | null)?.order) || "old";
  const [{ data: removeRows }, { data: rows }, { count: doneToday }, { count: waiting }, { data: st }] = await Promise.all([
    supabase.from("items").select("id, title, price, fb_old_url, fb_ad_title, fb_ad_price, item_photos(url, sort_order)").eq("fb_remove", true).is("fb_removed_at", null).order("updated_at").limit(1),
    supabase.from("items").select("*, item_photos(url, sort_order), categories(name)").not("fb_old_url", "is", null).is("fb_relisted_at", null).eq("fb_hold", false).not("fb_pick", "is", null).neq("status", "draft").order("fb_pick", { ascending: true, nullsFirst: false }).order(order === "fb" ? "created_at" : order === "old" ? "fb_listed_at" : "price", { ascending: order !== "high", nullsFirst: false }).order("created_at").limit(1),
    supabase.from("items").select("id", { count: "exact", head: true }).gte("fb_relisted_at", startOfDay.toISOString()),
    supabase.from("items").select("id", { count: "exact", head: true }).not("fb_old_url", "is", null).is("fb_relisted_at", null).eq("fb_hold", false).not("fb_pick", "is", null).neq("status", "draft"),
    supabase.from("settings").select("key, value").in("key", ["relist:settings", "relist:next_at", "business"]),
  ]);
  const get = (k: string) => st?.find((s) => s.key === k)?.value as Record<string, unknown> | undefined;
  const cfg = { perDay: 15, gapMin: 5, gapMax: 15, ...(get("relist:settings") || {}) } as { perDay: number; gapMin: number; gapMax: number };
  const nextAt = (get("relist:next_at")?.at as string) || null;
  const business = (get("business") as { name: string; location?: string }) || { name: "Next Owner Market" };
  const it = rows?.[0] as (Item & { item_photos: { url: string; sort_order: number }[]; categories: { name: string } | null; fb_old_url: string }) | undefined;
  const done = doneToday || 0;

  const rm = removeRows?.[0] as { id: string; title: string; price: number | null; fb_old_url: string | null; fb_ad_title: string | null; fb_ad_price: number | null; item_photos: { url: string; sort_order: number }[] } | undefined;
  let state: "empty" | "day_done" | "wait" | "go" | "remove" = "go";
  if (rm) state = nextAt && new Date(nextAt).getTime() > new Date().getTime() ? "wait" : "remove";
  else if (!it) state = "empty";
  else if (done >= cfg.perDay) state = "day_done";
  else if (nextAt && new Date(nextAt).getTime() > new Date().getTime()) state = "wait";

  const listing = it && state === "go" ? (() => {
    const input = { item: { ...it, title: cleanAiTells(it.title), description: cleanAiTells(it.description) }, businessName: business.name, location: business.location };
    const full = facebookCopy(input);
    return {
      id: it.id, title: input.item.title, price: it.price, category: (it as unknown as { fb_category?: string | null }).fb_category || it.categories?.name || "Miscellaneous",
      location: (it as unknown as { fb_location?: string | null }).fb_location || null,
      condition: FB_CONDITION[it.condition || "good"] || "Used - Good",
      description: full.slice(full.indexOf("\n\n") + 2),
      rawDescription: it.description || "",
      photos: [...(it.item_photos || [])].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.url),
      oldUrl: String(it.fb_old_url).startsWith("http") ? it.fb_old_url : null,
      adTitle: (it as unknown as { fb_ad_title?: string | null }).fb_ad_title || null,
      adPrice: (it as unknown as { fb_ad_price?: number | null }).fb_ad_price != null ? Number((it as unknown as { fb_ad_price: number }).fb_ad_price) : null,
      postedTo: ((it as unknown as { posted_to?: Record<string, string> }).posted_to) || {}, status: it.status,
    };
  })() : null;

  const removal = rm && state === "remove" ? { id: rm.id, title: rm.title || "Untitled", price: rm.price, adTitle: rm.fb_ad_title, adPrice: rm.fb_ad_price != null ? Number(rm.fb_ad_price) : null, oldUrl: String(rm.fb_old_url || "").startsWith("http") ? rm.fb_old_url : null, photo: [...(rm.item_photos || [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null } : null;
  return <NextClient removal={removal} state={state} nextAt={nextAt} done={done} perDay={cfg.perDay} waiting={waiting || 0} gap={[cfg.gapMin, cfg.gapMax]} listing={listing} />;
}
