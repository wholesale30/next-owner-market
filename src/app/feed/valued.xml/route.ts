import { createClient as createAdmin } from "@supabase/supabase-js";
import { rss } from "@/lib/rss";
export const revalidate = 900;
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.from("valuations").select("slug, title, value_low, value_high, why, photo_url, created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(100);
  const items = (data || []).map((v) => ({ title: `${v.title}: worth about $${Math.round(v.value_low)}–$${Math.round(v.value_high)}`, link: `${site}/valued/${v.slug}`, desc: v.why || "", date: v.created_at, image: v.photo_url }));
  return new Response(rss("Next Owner Market: what things are worth", `${site}/feed/valued.xml`, "Real items, valued from photos.", items), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
