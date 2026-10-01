import { createClient as createAdmin } from "@supabase/supabase-js";
import { rss } from "@/lib/rss";
import { OWNER_LOC, withLoc } from "@/lib/item-location";
export const dynamic = "force-dynamic"; // built fresh on request (cached at the edge), never baked empty at build time
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: raw, error: rawErr } = await db.from("items").select(`sku, title, price, description, listed_at, item_photos(url, is_primary), ${OWNER_LOC}`).eq("status", "active").order("listed_at", { ascending: false }).limit(100);
  if (rawErr) return new Response("feed temporarily unavailable", { status: 503, headers: { "Retry-After": "600" } });
  const data = withLoc(raw as never[] as { owner?: unknown; sku: string; title: string; price: number; description: string | null; listed_at: string | null; item_photos: unknown }[]);
  const items = data.map((i) => { const ph = (i.item_photos as { url: string; is_primary: boolean }[]) || []; return { title: `${i.title} — $${Math.round(Number(i.price))}`, link: `${site}/item/${i.sku}`, desc: `${i.description?.slice(0, 300) || ""}${i.city ? ` (${i.city}, ${i.state})` : ""}`, date: i.listed_at || new Date().toISOString(), image: (ph.find((p) => p.is_primary) || ph[0])?.url }; });
  return new Response(rss("Next Owner Market: new items", `${site}/feed/items.xml`, "Newest items for sale.", items), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
