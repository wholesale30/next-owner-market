import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "../../../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import ToolPitch from "@/components/ToolPitch";

/** Hub pages that build themselves: /valued/about/pioneer-sx-780 → every public valuation matching those words, aggregated. */
export const revalidate = 3600;
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const words = (term: string) => term.split("-").filter((w) => w.length > 1);

export async function generateMetadata({ params }: PageProps<"/valued/about/[term]">): Promise<Metadata> {
  const { term } = await params;
  const name = words(term).join(" ");
  return { title: `What is a ${name} worth? Real valuations`, description: `See what people's ${name} turned out to be worth, from photos valued on Next Owner Market. Value range, where it sells best, and what raises the price. Check yours free.` };
}

export default async function HubPage({ params }: PageProps<"/valued/about/[term]">) {
  const { term } = await params;
  const ws = words(term);
  if (!ws.length) notFound();
  const supabase = await createClient();
  let q = supabase.from("valuations").select("slug, title, era, value_low, value_high, photo_url, best_places, raise_value, created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(100);
  for (const w of ws) q = q.ilike("title", `%${w}%`);
  const [{ data: rows }, { data: biz }, { data: { user } }] = await Promise.all([q, supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  if (!rows?.length) notFound();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const name = ws.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const lows = rows.map((r) => Number(r.value_low)), highs = rows.map((r) => Number(r.value_high));
  const lo = Math.min(...lows), hi = Math.max(...highs), midLo = lows.reduce((a, b) => a + b, 0) / lows.length, midHi = highs.reduce((a, b) => a + b, 0) / highs.length;
  const places = new Map<string, number>(); const tips = new Map<string, number>();
  for (const r of rows) { for (const p of (r.best_places as { place: string }[]) || []) places.set(p.place, (places.get(p.place) || 0) + 1); for (const t of (r.raise_value as string[]) || []) tips.set(t, (tips.get(t) || 0) + 1); }
  const topPlaces = [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topTips = [...tips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name, offers: { "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: lo, highPrice: hi, offerCount: rows.length } };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <p className="text-sm muted"><Link href="/valued" className="underline">What things are worth</Link> › {name}</p>
        <h1 className="text-2xl font-extrabold leading-tight">What is a {name} worth?</h1>
        <div className="card p-4 text-center">
          <p className="text-xs muted uppercase tracking-wide">Typical range, from {rows.length} valuation{rows.length === 1 ? "" : "s"}</p>
          <p className="text-4xl font-extrabold">{money(midLo)} – {money(midHi)}</p>
          <p className="text-xs muted">Lowest seen {money(lo)} · highest {money(hi)} · based on photos people shared, no names</p>
        </div>
        {topPlaces.length > 0 && <div className="card p-4 text-sm"><p className="font-semibold mb-1">Where it sells best</p>{topPlaces.map(([p, n]) => <p key={p}>{p} <span className="muted">({n} of {rows.length})</span></p>)}</div>}
        {topTips.length > 0 && <div className="card p-4 text-sm"><p className="font-semibold mb-1">What raises the price</p><ul className="list-disc pl-5">{topTips.map(([t]) => <li key={t}>{t}</li>)}</ul></div>}
        <h2 className="font-bold text-lg">Each one</h2>
        <ul className="grid grid-cols-2 gap-3">
          {rows.map((v) => <li key={v.slug}><Link href={`/valued/${v.slug}`} className="card overflow-hidden block h-full"><div className="aspect-square flex items-center justify-center text-3xl" style={{ background: "var(--line)" }}>{v.photo_url ? <img src={v.photo_url} alt={v.title} className="w-full h-full object-cover" loading="lazy" /> : "💰"}</div><div className="p-2"><p className="font-bold">{money(v.value_low)}–{money(v.value_high)}</p><p className="text-sm leading-tight line-clamp-2">{v.title}</p></div></Link></li>)}
        </ul>
        <div className="card p-4 text-center space-y-2" style={{ borderColor: "var(--brand)" }}><p className="font-bold">Got a {name}?</p><div className="flex gap-2"><Link href="/worth" className="btn btn-primary flex-1">Value mine</Link><Link href="/pro" className="btn btn-secondary flex-1">Sell it here free</Link></div></div>
        <ToolPitch compact />
      </main>
    </div>
  );
}
