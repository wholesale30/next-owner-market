import { createClient as createAdmin } from "@supabase/supabase-js";
import { rss } from "@/lib/rss";
export const dynamic = "force-dynamic"; // built fresh on request (cached at the edge), never baked empty at build time
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.from("posts").select("slug, title, excerpt, cover_url, published_at").not("published_at", "is", null).order("published_at", { ascending: false }).limit(50);
  const items = (data || []).map((p) => ({ title: p.title, link: `${site}/blog/${p.slug}`, desc: p.excerpt || "", date: p.published_at!, image: p.cover_url }));
  return new Response(rss("Next Owner Market blog", `${site}/feed/blog.xml`, "Selling tips, what things are worth, what's new.", items), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
