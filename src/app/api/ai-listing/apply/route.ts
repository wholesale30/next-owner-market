import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** POST { itemId } — runs the AI on an existing draft's photos and fills in blank fields. Used by Snap mode. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { itemId } = (await req.json()) as { itemId: string };

  const [{ data: item }, { data: photos }, { data: categories }] = await Promise.all([
    supabase.from("items").select("id, title, description, condition_notes, specs").eq("id", itemId).single(),
    supabase.from("item_photos").select("url").eq("item_id", itemId).order("sort_order"),
    supabase.from("categories").select("id, name"),
  ]);
  if (!item || !photos?.length) return NextResponse.json({ error: "No item or photos" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/ai-listing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
    body: JSON.stringify({ photoUrls: photos.map((p) => p.url), hints: item.condition_notes || "", categories }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json(json, { status: 500 });
  const a = json.draft;
  const mid = a.price_min && a.price_max ? Math.round((Number(a.price_min) + Number(a.price_max)) / 2) : null;
  const { error } = await supabase.from("items").update({
    title: item.title || a.title || "",
    description: item.description || a.description || "",
    brand: a.brand || null, model: a.model || null,
    category_id: categories?.some((c) => c.id === a.category_id) ? a.category_id : null,
    condition: a.condition || "good", condition_notes: a.condition_notes || item.condition_notes || null,
    specs: a.specs || {}, tags: a.tags || [],
    price: mid, price_min_suggested: a.price_min || null, price_max_suggested: a.price_max || null,
    ai_generated: true, ai_raw: a,
    status: a.worth_listing === false ? "draft" : "pending_review",
  }).eq("id", itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, title: a.title, worth_listing: a.worth_listing });
}
