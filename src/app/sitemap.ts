import type { MetadataRoute } from "next";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ data: items }, { data: cats }, { data: posts }, { data: sellers }] = await Promise.all([
    db.from("items").select("sku, updated_at").in("status", ["active", "reserved"]).order("updated_at", { ascending: false }).limit(5000),
    db.from("categories").select("slug"),
    db.from("posts").select("slug, updated_at").not("published_at", "is", null),
    db.from("profiles").select("id, updated_at").in("role", ["consignor", "admin", "staff"]).eq("approved", true).limit(2000),
  ]);
  const now = new Date();
  return [
    { url: `${site}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${site}/worth`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/pro`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/community`, lastModified: now, changeFrequency: "hourly", priority: 0.6 },
    { url: `${site}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/sell-on`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...["facebook", "offerup", "ebay", "craigslist", "mercari", "poshmark", "vinted", "depop", "etsy"].map((a) => ({ url: `${site}/sell-on/${a}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...(cats || []).map((c) => ({ url: `${site}/c/${c.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...(items || []).map((i) => ({ url: `${site}/item/${i.sku}`, lastModified: new Date(i.updated_at), changeFrequency: "daily" as const, priority: 0.8 })),
    ...(posts || []).map((p) => ({ url: `${site}/blog/${p.slug}`, lastModified: new Date(p.updated_at), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...(sellers || []).map((s) => ({ url: `${site}/seller/${s.id}`, lastModified: new Date(s.updated_at || now), changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
