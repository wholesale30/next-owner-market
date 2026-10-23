import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { priceCheck } from "@/lib/pricecheck";

export const maxDuration = 180;

/** POST { itemId } — owner only. Searches real comps for one item and saves list / fast / top / floor prices on it. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const { itemId } = (await req.json()) as { itemId: string };
  const { data: it } = await supabase.from("items").select("id, title, description, condition, condition_notes, price, item_photos(url, sort_order)").eq("id", itemId).single();
  if (!it) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const photo = ((it.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null;
  try {
    const pc = await priceCheck(new Anthropic(), { title: it.title || "", description: [it.description, it.condition_notes].filter(Boolean).join("\n"), condition: it.condition || "", price: it.price, photo, ownerId: user.id });
    await supabase.from("items").update({ price_check: pc, price_checked_at: pc.checked_at }).eq("id", itemId);
    return NextResponse.json(pc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
