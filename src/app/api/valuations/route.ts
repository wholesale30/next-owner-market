import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { slugify } from "@/lib/md";
import { indexNow } from "@/lib/indexnow";

/** POST: the person opted to share a valuation publicly. Body: { source, title, era, condition, value_low, value_high, retail_new, confidence, why, raise_value, best_places, ship_or_local, watch_out, photo_url?, category? } */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const b = (await req.json()) as Record<string, unknown>;
  const title = String(b.title || "").slice(0, 140).trim();
  if (!title || b.value_low == null || b.value_high == null) return NextResponse.json({ error: "Nothing to share" }, { status: 400 });
  const base = slugify(title) || "item";
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  const db = admin();
  const { data, error } = await db.from("valuations").insert({
    slug, owner_id: user.id, source: ["worth", "pile", "buypass"].includes(String(b.source)) ? b.source : "worth", title, era: b.era ? String(b.era) : null, condition: b.condition ? String(b.condition) : null,
    value_low: Number(b.value_low), value_high: Number(b.value_high), retail_new: b.retail_new != null ? Number(b.retail_new) : null, confidence: b.confidence ? String(b.confidence) : null,
    why: b.why ? String(b.why).slice(0, 2000) : null, raise_value: Array.isArray(b.raise_value) ? (b.raise_value as string[]).slice(0, 6).map(String) : [], best_places: Array.isArray(b.best_places) ? b.best_places : [],
    ship_or_local: b.ship_or_local ? String(b.ship_or_local) : null, watch_out: b.watch_out ? String(b.watch_out) : null, photo_url: b.photo_url ? String(b.photo_url) : null, category: b.category ? String(b.category) : null,
  }).select("slug").single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Couldn't share" }, { status: 500 });
  indexNow([`/valued/${data.slug}`, "/valued"]).catch(() => {});
  return NextResponse.json({ slug: data.slug });
}
