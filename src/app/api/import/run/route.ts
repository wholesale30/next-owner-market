import { NextResponse } from "next/server";
import sharp from "sharp";
import { admin } from "@/lib/stripe";
import { draftListing } from "@/lib/draft-listing";

export const maxDuration = 300;

/**
 * GET ?key=…&n=4 — the server side of "Bring in my Facebook ads" (Oct 23, 2026), so the owner doesn't have to keep
 * his phone open for 141 ads. Rows wait in fb_import_queue; a once-a-minute database job calls this until it's empty.
 * Per ad: photos come in through our server with a new cover (photo 2 first, old cover last), each slightly cropped
 * and touched up; the AI writes a new title and description from the old ad's facts; his price, condition and town
 * are kept; the old ad's link is saved for the Relist list. The key lives in settings "import:run".
 */
type Ad = { title?: string; price?: string | number; condition?: string; description?: string; photos?: string[] | string; listing_url?: string; location?: string };

const CONDITION: Record<string, string> = { new: "new", "used - like new": "like_new", "like new": "like_new", "used - good": "good", good: "good", "used - fair": "fair", fair: "fair", poor: "for_parts" };
const OK_HOST = /(^|\.)(fbcdn\.net|facebook\.com|fbsbx\.com)$/i;
const reorder = (p: string[]) => (p.length > 1 ? [...p.slice(1, 2), ...p.slice(2), p[0]] : p);

async function freshen(buf: ArrayBuffer): Promise<Buffer> {
  const img = sharp(Buffer.from(buf)).rotate();
  const m = await img.metadata();
  const w = m.width || 720, h = m.height || 960;
  const dx = Math.round(w * 0.04), dy = Math.round(h * 0.04);
  return img
    .extract({ left: dx, top: dy, width: w - dx * 2, height: h - dy * 2 })
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .modulate({ brightness: 1.03, saturation: 1.06 })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 86 })
    .toBuffer();
}

async function importOne(row: { id: number; owner_id: string; data: Ad }, categories: { id: string; name: string }[]) {
  const db = admin();
  const ad = row.data;
  const price = Math.round(Number(String(ad.price ?? "").replace(/[^0-9.]/g, ""))) || null;
  const photosRaw = Array.isArray(ad.photos) ? ad.photos : [];
  const photos = [...new Set(photosRaw.map(String).filter((u) => { try { const x = new URL(u); return x.protocol === "https:" && OK_HOST.test(x.hostname); } catch { return false; } }))];
  const url = String(ad.listing_url || "").trim() || `fb-import-${row.id}`;

  // already brought in (a rerun): just link it
  const { data: dup } = await db.from("items").select("id").eq("fb_old_url", url).maybeSingle();
  if (dup) return { item_id: dup.id as string, note: "already in" };

  const facts = [
    ad.title && `Old ad title: ${ad.title}`,
    ad.condition && `Condition (seller said): ${ad.condition}`,
    ad.description && `Seller's facts from the old ad (rewrite in new words, don't copy): ${ad.description}`,
  ].filter(Boolean).join("\n");
  const { data: item, error } = await db.from("items").insert({
    owner_id: row.owner_id, created_by: row.owner_id, title: "", description: "", status: "draft", tier: "owned",
    condition_notes: facts.slice(0, 4000) || null, fb_old_url: url, fb_location: ad.location || null, price,
  }).select("id").single();
  if (error) throw new Error(error.message);

  const saved: string[] = [];
  for (const [j, src] of reorder(photos).slice(0, 20).entries()) {
    try {
      const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) continue;
      const out = await freshen(await r.arrayBuffer());
      const path = `${row.owner_id}/fb-${item.id}-${j}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await db.storage.from("item-photos").upload(path, out, { contentType: "image/jpeg" });
      if (up.error) continue;
      const pub = db.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
      await db.from("item_photos").insert({ item_id: item.id, storage_path: path, url: pub, sort_order: saved.length, is_primary: saved.length === 0 });
      saved.push(pub);
    } catch { /* skip one bad photo */ }
  }
  if (!saved.length) return { item_id: item.id as string, note: "no photos came through (links expired?); saved as a draft" };

  const keepCond = CONDITION[String(ad.condition || "").toLowerCase()];
  try {
    const a = await draftListing({ photoUrls: saved, hints: facts, categories, ownerId: row.owner_id });
    await db.from("items").update({
      title: a.title, description: a.description, brand: a.brand || null, model: a.model || null,
      category_id: categories.some((c) => c.id === a.category_id) ? a.category_id : null,
      condition: keepCond || a.condition || "good", condition_notes: a.condition_notes || null,
      specs: a.specs || {}, tags: a.tags || [],
      price: price ?? (a.price_min && a.price_max ? Math.round((Number(a.price_min) + Number(a.price_max)) / 2) : null),
      price_min_suggested: a.price_min || null, price_max_suggested: a.price_max || null,
      weight_lbs: a.weight_lbs || null, box: ["small", "medium", "large", "xl", "freight"].includes(a.box) ? a.box : "medium",
      ai_generated: true, ai_raw: a, status: "pending_review",
    }).eq("id", item.id);
    return { item_id: item.id as string, note: `${saved.length} photos • ${a.title}` };
  } catch (e) {
    // keep his own title so the item is still usable; he can tap Write listing later
    await db.from("items").update({ title: String(ad.title || "Facebook item").slice(0, 100), description: String(ad.description || ""), condition: keepCond || "good", status: "pending_review" }).eq("id", item.id);
    return { item_id: item.id as string, note: `${saved.length} photos • AI rewrite failed (${e instanceof Error ? e.message : String(e)}); kept the old wording` };
  }
}

export async function GET(req: Request) {
  const db = admin();
  const sp = new URL(req.url).searchParams;
  const { data: k } = await db.from("settings").select("value").eq("key", "import:run").maybeSingle();
  const want = (k?.value as { key?: string } | null)?.key;
  if (!want || sp.get("key") !== want) return NextResponse.json({ error: "no" }, { status: 403 });
  const n = Math.min(6, Math.max(1, Number(sp.get("n")) || 4));
  const { data: rows, error } = await db.rpc("claim_fb_import", { n });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ done: true });
  const { data: categories } = await db.from("categories").select("id, name");
  const results = await Promise.all((rows as { id: number; owner_id: string; data: Ad; tries: number }[]).map(async (row) => {
    try {
      const r = await importOne(row, categories || []);
      await db.from("fb_import_queue").update({ status: "done", item_id: r.item_id, error: r.note, updated_at: new Date().toISOString() }).eq("id", row.id);
      return { id: row.id, ok: true, note: r.note };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("fb_import_queue").update({ status: row.tries >= 3 ? "failed" : "waiting", error: msg, updated_at: new Date().toISOString() }).eq("id", row.id);
      return { id: row.id, ok: false, note: msg };
    }
  }));
  return NextResponse.json({ results });
}
