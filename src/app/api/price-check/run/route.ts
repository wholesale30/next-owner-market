import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { admin } from "@/lib/stripe";
import { priceCheck } from "@/lib/pricecheck";

export const maxDuration = 300;

/**
 * GET ?key=…&owner=<uuid>&n=4 — price-checks the owner's items that haven't been checked yet, a few per call
 * (Oct 23, 2026). Called once a minute by a database job until none are left. Facebook ads first, skipped ones last.
 * Same key as the Facebook import runner (settings "import:run").
 */
export async function GET(req: Request) {
  const db = admin();
  const sp = new URL(req.url).searchParams;
  const { data: k } = await db.from("settings").select("value").eq("key", "import:run").maybeSingle();
  const want = (k?.value as { key?: string } | null)?.key;
  if (!want || sp.get("key") !== want) return NextResponse.json({ error: "no" }, { status: 403 });
  const owner = sp.get("owner") || "";
  if (!/^[0-9a-f-]{36}$/.test(owner)) return NextResponse.json({ error: "bad owner" }, { status: 400 });
  const n = Math.min(6, Math.max(1, Number(sp.get("n")) || 4));
  // claim: mark as being checked so overlapping calls don't double up (cleared or replaced by the result)
  const staleBefore = new Date(Date.now() - 6 * 60000).toISOString();
  const { data: items } = await db.from("items")
    .select("id, title, description, condition, condition_notes, price, item_photos(url, sort_order)")
    .eq("owner_id", owner).in("status", ["draft", "pending_review", "active", "reserved"]).is("price_check", null)
    .or(`price_checked_at.is.null,price_checked_at.lt.${staleBefore}`)
    .order("fb_hold", { ascending: true }).order("fb_old_url", { ascending: true, nullsFirst: false }).limit(n);
  if (!items?.length) return NextResponse.json({ done: true });
  await db.from("items").update({ price_checked_at: new Date().toISOString() }).in("id", items.map((i) => i.id));
  const client = new Anthropic();
  const results = await Promise.all(items.map(async (it) => {
    const photo = ((it.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null;
    try {
      const pc = await priceCheck(client, { title: it.title || "", description: [it.description, it.condition_notes].filter(Boolean).join("\n"), condition: it.condition || "", price: it.price, photo, ownerId: owner });
      const { error } = await db.from("items").update({ price_check: pc, price_checked_at: pc.checked_at }).eq("id", it.id);
      if (error) throw new Error(error.message);
      return { id: it.id, ok: true, cost: pc.cost };
    } catch (e) {
      return { id: it.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }));
  return NextResponse.json({ results });
}
