import { NextResponse } from "next/server";
import { lookupZip, milesBetween } from "@/lib/geo";
import { admin } from "@/lib/stripe";

/** GET ?zip=23220 → nearby police stations (OpenStreetMap), cached 30 days per ZIP. Free. */
export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get("zip") || "";
  const g = lookupZip(zip);
  if (!g) return NextResponse.json({ spots: [] });
  const db = admin();
  const key = `safe_spots:${g.zip}`;
  const { data: cached } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const c = cached?.value as { at?: string; spots?: unknown[] } | undefined;
  if (c?.at && Date.now() - new Date(c.at).getTime() < 30 * 86400_000) return NextResponse.json({ spots: c.spots, city: g.city });
  const q = `[out:json][timeout:10];(node["amenity"="police"](around:20000,${g.lat},${g.lng});way["amenity"="police"](around:20000,${g.lat},${g.lng}););out center 12;`;
  let spots: { name: string; lat: number; lng: number; miles: number; maps: string }[] = [];
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(12000) });
    const j = (await r.json()) as { elements: { tags?: { name?: string }; lat?: number; lon?: number; center?: { lat: number; lon: number } }[] };
    spots = (j.elements || [])
      .map((e) => { const lat = e.lat ?? e.center?.lat; const lng = e.lon ?? e.center?.lon; return lat && lng ? { name: e.tags?.name || "Police station", lat, lng, miles: Math.round(milesBetween(g.lat, g.lng, lat, lng) * 10) / 10, maps: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` } : null; })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.miles - b.miles)
      .slice(0, 5);
  } catch { /* leave empty */ }
  if (spots.length) await db.from("settings").upsert({ key, value: { at: new Date().toISOString(), spots } });
  return NextResponse.json({ spots, city: g.city });
}
