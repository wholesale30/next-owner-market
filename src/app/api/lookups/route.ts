import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { getLookup } from "@/lib/lookups";
import { listFromScan } from "@/lib/thrift";

/**
 * My lookups actions. POST { action, id, ... }
 *  delete / restore        soft delete (recoverable)
 *  photos  { photo_urls }  add, remove or touched-up photos on a saved lookup
 *  listed  { item_id }     a listing was made from it
 *  list    { piece? }      make the listing right from My lookups (What's it worth / Buy or Pass)
 */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in first.", signup: true }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; photo_urls?: string[]; item_id?: string; piece?: number };
  const d = admin();
  const id = String(b.id || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  if (b.action === "restore") {
    await d.from("lookups").update({ deleted_at: null }).eq("id", id).eq("owner_id", me.id);
    return NextResponse.json({ ok: true });
  }
  const lk = await getLookup(id, me.id);
  if (!lk) return NextResponse.json({ error: "Couldn't find that one." }, { status: 404 });

  if (b.action === "delete") {
    await d.from("lookups").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "photos") {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/`;
    const urls = (b.photo_urls || []).filter((u) => typeof u === "string" && u.startsWith(base)).slice(0, 10);
    await d.from("lookups").update({ photo_urls: urls, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "listed") {
    const itemId = b.item_id && /^[0-9a-f-]{36}$/.test(b.item_id) ? b.item_id : null;
    await d.from("lookups").update({ item_id: itemId || lk.item_id, listed_count: Number(lk.listed_count || 0) + 1 }).eq("id", id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "list") {
    if (lk.tool === "buy_or_pass" && lk.ref_id) {
      const r = await listFromScan(me, lk.ref_id, lk.photo_urls || []);
      if (!r.item_id) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
      return NextResponse.json({ item_id: r.item_id });
    }
    if (lk.tool !== "worth") return NextResponse.json({ open: `/pile?open=${id}` });
    // What's it worth: same as "Write my listing" on the result (a single piece of a lot if piece is given)
    type Piece = { keywords?: string[]; name: string; value_low: number; value_high: number; listing_title: string; listing_description: string };
    const res = lk.result as { what: string; condition_guess: string; value_low: number; value_high: number; ship_or_local: string; box: string; weight_lbs: number; listing: { title: string; description: string; condition?: string; keywords?: string[] }; pieces?: Piece[] };
    const piece = typeof b.piece === "number" ? res.pieces?.[b.piece] : undefined;
    if (me.role === "buyer") { const sb = await createClient(); await sb.rpc("become_seller"); }
    const lo = piece ? piece.value_low : res.value_low, hi = piece ? piece.value_high : res.value_high;
    const { data: item, error } = await d.from("items").insert({
      owner_id: me.id, created_by: me.id, title: String(piece ? piece.listing_title || piece.name : res.listing?.title || res.what).slice(0, 80),
      description: piece ? piece.listing_description : res.listing?.description || "", condition_notes: res.listing?.condition || res.condition_guess || null, tags: ((piece ? piece.keywords : res.listing?.keywords) || []).slice(0, 25),
      price: Math.round((Number(lo) + Number(hi)) / 2), price_min_suggested: lo, price_max_suggested: hi, status: "draft", ai_generated: true,
      shipping_ok: res.ship_or_local !== "local" && res.box !== "freight", local_pickup_ok: true, weight_lbs: res.weight_lbs || null,
      box: res.box === "freight" ? "xl" : res.box || "medium", shipping_mode: "calculated",
    }).select("id").single();
    if (error || !item) return NextResponse.json({ error: error?.message || "Couldn't make the listing." }, { status: 500 });
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/`;
    const photos = (lk.photo_urls || []).filter((u: string) => u.startsWith(base));
    if (photos.length) await d.from("item_photos").insert(photos.map((url: string, i: number) => ({ item_id: item.id, storage_path: url.slice(base.length), url, sort_order: i, is_primary: i === 0 })));
    await d.from("lookups").update({ item_id: item.id, listed_count: Number(lk.listed_count || 0) + 1 }).eq("id", id);
    return NextResponse.json({ item_id: item.id });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
