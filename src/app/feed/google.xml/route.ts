import { createClient as createAdmin } from "@supabase/supabase-js";
import { nationalShippingEstimate } from "@/lib/shipping";

export const dynamic = "force-dynamic"; // built fresh on request (cached at the edge), never baked empty at build time

/**
 * Google Merchant Center product feed (free listings).
 *
 * Rules (Oct 5, 2026, after a "Misrepresentation" suspension):
 *  - ONLY items Next Owner Market sells itself (admin/staff owned). A standard Merchant Center account may not list
 *    other sellers' items; that needs a Marketplace multi-client account (support.google.com/merchants/answer/6363319).
 *  - ONLY items that can actually be shipped. Pickup-only items were being sent as "$0 shipping", which Google reads
 *    as free delivery anywhere: a false delivery claim.
 *  - Honest condition: Google's "refurbished" means professionally restored, so "like new" is sent as "used".
 *    "For parts" items are left out.
 *  - Shipping shown is the most it can cost anywhere in the US, so the buyer never pays more than Google showed.
 */
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ data: owners }, { data: biz }] = await Promise.all([
    db.from("profiles").select("id").in("role", ["admin", "staff"]),
    db.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const ownIds = (owners || []).map((o) => o.id);
  const { data: items, error: itemsErr } = ownIds.length
    ? await db.from("items").select("sku, title, description, price, condition, brand, model, shipping_ok, shipping_mode, shipping_price, weight_lbs, box, category_id, sale_type, item_photos(url, is_primary), categories(name)")
        .eq("status", "active").eq("shipping_ok", true).in("owner_id", ownIds).not("price", "is", null).neq("condition", "for_parts").order("listed_at", { ascending: false }).limit(5000)
    : { data: [], error: null };
  if (itemsErr) return new Response("feed temporarily unavailable", { status: 503, headers: { "Retry-After": "600" } });
  const b = (biz?.value as { name?: string; location?: string; shipping_markup_pct?: number; shipping_markup_min?: number }) || {};
  const name = b.name || "Next Owner Market";
  const esc = (s: string) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
  const cond = (c: string | null) => (c === "new" ? "new" : "used");
  const shipCost = (i: { shipping_mode: string | null; shipping_price: number | null; weight_lbs: number | null; box: string | null }) =>
    i.shipping_mode === "free" ? 0 : i.shipping_mode === "flat" && Number(i.shipping_price) > 0 ? Number(i.shipping_price) : nationalShippingEstimate(i.weight_lbs, i.box, Number(b.shipping_markup_pct ?? 20), Number(b.shipping_markup_min ?? 1.5));
  const entries = (items || [])
    .filter((i) => (i.item_photos as { url: string }[] | null)?.length && i.box !== "freight" && i.sale_type !== "auction")
    .map((i) => {
      const ph = (i.item_photos as { url: string; is_primary: boolean }[]) || [];
      const photo = ph.find((p) => p.is_primary) || ph[0];
      const cat = (i.categories as unknown as { name: string } | null)?.name || "";
      return `<item>
<g:id>${esc(i.sku)}</g:id>
<g:title>${esc(i.title.slice(0, 150))}</g:title>
<g:description>${esc(i.description.slice(0, 5000))}</g:description>
<g:link>${site}/item/${i.sku}</g:link>
<g:image_link>${esc(photo.url)}</g:image_link>
${ph.filter((p) => p !== photo).slice(0, 9).map((p) => `<g:additional_image_link>${esc(p.url)}</g:additional_image_link>`).join("\n")}
<g:availability>in_stock</g:availability>
<g:price>${Number(i.price).toFixed(2)} USD</g:price>
<g:condition>${cond(i.condition)}</g:condition>
${i.brand ? `<g:brand>${esc(i.brand)}</g:brand>` : "<g:identifier_exists>no</g:identifier_exists>"}
${i.model ? `<g:mpn>${esc(i.model)}</g:mpn>` : ""}
<g:product_type>${esc(cat)}</g:product_type>
<g:shipping_weight>${Number(i.weight_lbs || 2).toFixed(1)} lb</g:shipping_weight>
<g:shipping><g:country>US</g:country><g:service>Ground</g:service><g:price>${shipCost(i).toFixed(2)} USD</g:price><g:min_handling_time>1</g:min_handling_time><g:max_handling_time>3</g:max_handling_time><g:min_transit_time>2</g:min_transit_time><g:max_transit_time>8</g:max_transit_time></g:shipping>
</item>`;
    });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(name)}</title>
<link>${site}</link>
<description>Used, surplus and vintage goods sold by ${esc(name)}${b.location ? `, ${esc(b.location)}` : ""}.</description>
${entries.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
