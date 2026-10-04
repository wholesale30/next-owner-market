import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { slugify } from "@/lib/md";
import { indexNow } from "@/lib/indexnow";

/**
 * "📣 Share this find" on a live listing (Oct 3, 2026): makes a second public page for the item
 * (/valued/<slug>, with a Buy button back to the listing), so search engines see it twice.
 * POST { itemId } -> { slug, item_url }. Sharing again returns the same page.
 */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  if (!itemId || !/^[0-9a-f-]{36}$/.test(itemId)) return NextResponse.json({ error: "Which item?" }, { status: 400 });
  const d = admin();
  const { data: it } = await d.from("items").select("id, sku, title, description, condition, condition_notes, price, price_min_suggested, price_max_suggested, owner_id, status, categories(name), item_photos(url, is_primary, sort_order)").eq("id", itemId).maybeSingle();
  if (!it) return NextResponse.json({ error: "Couldn't find that listing." }, { status: 404 });
  const staff = me.role === "admin" || me.role === "staff";
  if (it.owner_id !== me.id && !staff) return NextResponse.json({ error: "That isn't yours." }, { status: 403 });
  if (!["active", "reserved"].includes(it.status)) return NextResponse.json({ error: "List it in the store first, then share it." }, { status: 400 });
  const item_url = `/item/${it.sku}`;

  const { data: existing } = await d.from("valuations").select("slug").eq("item_id", it.id).maybeSingle();
  if (existing) { indexNow([`/valued/${existing.slug}`, item_url]).catch(() => {}); return NextResponse.json({ slug: existing.slug, item_url }); }

  const photos = [...((it.item_photos as { url: string; is_primary: boolean; sort_order: number }[]) || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const price = Number(it.price || 0);
  const low = Number(it.price_min_suggested || 0) || Math.round(price * 0.8);
  const high = Number(it.price_max_suggested || 0) || price;
  const firstSentences = String(it.description || "").split(/(?<=[.!?])\s+/).slice(0, 3).join(" ").slice(0, 600);
  const slug = `${slugify(it.title) || "item"}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await d.from("valuations").insert({
    slug, owner_id: it.owner_id, source: "worth", title: String(it.title).slice(0, 140), condition: it.condition_notes || it.condition || null,
    value_low: Math.min(low, high) || price, value_high: Math.max(low, high) || price, confidence: "high", why: firstSentences || null,
    photo_url: photos[0]?.url || null, category: (it.categories as unknown as { name?: string } | null)?.name || null, item_id: it.id,
  }).select("slug").single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Couldn't share it." }, { status: 500 });
  indexNow([`/valued/${data.slug}`, item_url, "/valued"]).catch(() => {});
  return NextResponse.json({ slug: data.slug, item_url });
}
