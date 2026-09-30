import { createClient as createAdmin } from "@supabase/supabase-js";

export const revalidate = 1800;

/** Google Merchant Center product feed (free listings). Add this URL as a scheduled fetch feed in Merchant Center. */
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ data: items }, { data: biz }] = await Promise.all([
    db.from("items").select("sku, title, description, price, condition, brand, model, shipping_ok, shipping_mode, category_id, item_photos(url, is_primary), categories(name)").eq("status", "active").not("price", "is", null).order("listed_at", { ascending: false }).limit(5000),
    db.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const name = (biz?.value as { name?: string })?.name || "Next Owner Market";
  const esc = (s: string) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
  const cond = (c: string | null) => (c === "new" ? "new" : c === "for_parts" ? "used" : c === "like_new" ? "refurbished" : "used");
  const entries = (items || []).filter((i) => (i.item_photos as { url: string }[] | null)?.length).map((i) => {
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
${i.shipping_ok ? (i.shipping_mode === "free" ? `<g:shipping><g:country>US</g:country><g:price>0.00 USD</g:price></g:shipping>` : "") : `<g:shipping><g:country>US</g:country><g:service>Local pickup only</g:service><g:price>0.00 USD</g:price></g:shipping>`}
</item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(name)}</title>
<link>${site}</link>
<description>Used, surplus and vintage goods from sellers across the country.</description>
${entries.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
}
