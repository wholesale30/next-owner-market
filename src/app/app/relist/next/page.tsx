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
  const [{ data: rows }, { count: doneToday }, { count: waiting }, { data: st }] = await Promise.all([
    supabase.from("items").select("*, item_photos(url, sort_order), categories(name)").not("fb_old_url", "is", null).is("fb_relisted_at", null).eq("fb_hold", false).neq("status", "draft").order("fb_pick", { ascending: true, nullsFirst: false }).order("created_at").limit(1),
    supabase.from("items").select("id", { count: "exact", head: true }).gte("fb_relisted_at", startOfDay.toISOString()),
    supabase.from("items").select("id", { count: "exact", head: true }).not("fb_old_url", "is", null).is("fb_relisted_at", null).eq("fb_hold", false).neq("status", "draft"),
    supabase.from("settings").select("key, value").in("key", ["relist:settings", "relist:next_at", "business"]),
  ]);
  const get = (k: string) => st?.find((s) => s.key === k)?.value as Record<string, unknown> | undefined;
  const cfg = { perDay: 15, gapMin: 15, gapMax: 40, ...(get("relist:settings") || {}) } as { perDay: number; gapMin: number; gapMax: number };
  const nextAt = (get("relist:next_at")?.at as string) || null;
  const business = (get("business") as { name: string; location?: string }) || { name: "Next Owner Market" };
  const it = rows?.[0] as (Item & { item_photos: { url: string; sort_order: number }[]; categories: { name: string } | null; fb_old_url: string }) | undefined;
  const done = doneToday || 0;

  let state: "empty" | "day_done" | "wait" | "go" = "go";
  if (!it) state = "empty";
  else if (done >= cfg.perDay) state = "day_done";
  else if (nextAt && new Date(nextAt).getTime() > new Date().getTime()) state = "wait";

  const listing = it && state === "go" ? (() => {
    const input = { item: { ...it, title: cleanAiTells(it.title), description: cleanAiTells(it.description) }, businessName: business.name, location: business.location };
    const full = facebookCopy(input);
    return {
      id: it.id, title: input.item.title, price: it.price, category: it.categories?.name || "Miscellaneous",
      location: (it as unknown as { fb_location?: string | null }).fb_location || null,
      condition: FB_CONDITION[it.condition || "good"] || "Used - Good",
      description: full.slice(full.indexOf("\n\n") + 2),
      rawDescription: it.description || "",
      photos: [...(it.item_photos || [])].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.url),
      oldUrl: String(it.fb_old_url).startsWith("http") ? it.fb_old_url : null,
      postedTo: ((it as unknown as { posted_to?: Record<string, string> }).posted_to) || {}, status: it.status,
    };
  })() : null;

  return <NextClient state={state} nextAt={nextAt} done={done} perDay={cfg.perDay} waiting={waiting || 0} gap={[cfg.gapMin, cfg.gapMax]} listing={listing} />;
}
