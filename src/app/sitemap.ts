import type { MetadataRoute } from "next";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { OWNER_LOC, withLoc } from "@/lib/item-location";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: vals } = await db.from("valuations").select("slug, title, created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(20000);
  // hub pages: first two meaningful words of each title, if 2+ valuations share them
  const hubCount = new Map<string, number>();
  for (const v of vals || []) { const ws = String(v.title).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 2); if (ws.length === 2) { const k = ws.join("-"); hubCount.set(k, (hubCount.get(k) || 0) + 1); } }
  const hubs = [...hubCount.entries()].filter(([, n]) => n >= 2).map(([k]) => k);
  const { data: rawCities } = await db.from("items").select(OWNER_LOC).in("status", ["active", "reserved"]);
  const cities = withLoc(rawCities as never[] as { owner?: unknown }[]).filter((c) => c.city && c.state);
  const citySet = new Map<string, number>(); for (const c of cities || []) { const k = `${String(c.city).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${String(c.state).toLowerCase()}`; citySet.set(k, (citySet.get(k) || 0) + 1); }
  const cityPages = [...citySet.entries()].filter(([, n]) => n >= 1).map(([k]) => k);
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
    { url: `${site}/pile`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/start`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/why`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/valued`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    ...(vals || []).map((v) => ({ url: `${site}/valued/${v.slug}`, lastModified: new Date(v.created_at), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...hubs.map((h) => ({ url: `${site}/valued/about/${h}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...cityPages.map((c) => ({ url: `${site}/near/${c}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${site}/embed`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/buy-or-pass`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
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
