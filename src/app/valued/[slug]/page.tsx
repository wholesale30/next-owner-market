import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "../../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import ToolPitch from "@/components/ToolPitch";

export const revalidate = 3600;
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export async function generateMetadata({ params }: PageProps<"/valued/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase.from("valuations").select("title, value_low, value_high, era, why, photo_url").eq("slug", slug).maybeSingle();
  if (!v) return {};
  return { title: `${v.title}: worth about ${money(v.value_low)}–${money(v.value_high)}`, description: `${v.era ? v.era + ". " : ""}${(v.why || "").slice(0, 150)} Check what yours is worth in 30 seconds, free.` }; // preview picture: the branded card in opengraph-image.tsx (photo + value + our name)
}

export default async function ValuedPage({ params }: PageProps<"/valued/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: v }, { data: biz }, { data: { user } }] = await Promise.all([supabase.from("valuations").select("*").eq("slug", slug).maybeSingle(), supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  if (!v) notFound();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const { data: similar } = await supabase.from("valuations").select("slug, title, value_low, value_high").eq("is_public", true).neq("slug", slug).ilike("title", `%${v.title.split(" ").filter((w: string) => w.length > 3)[0] || v.title}%`).limit(6);
  const places = (v.best_places as { place: string; why: string }[]) || [];
  // shared from a live listing: send shoppers straight to it
  const { data: forSale } = v.item_id ? await supabase.from("items").select("sku, price, status").eq("id", v.item_id).in("status", ["active", "reserved"]).maybeSingle() : { data: null };
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: v.title, description: v.why || undefined, image: v.photo_url || undefined, offers: { "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: v.value_low, highPrice: v.value_high, offerCount: 1 } };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <p className="text-sm muted"><Link href="/valued" className="underline">What things are worth</Link> › {v.category || "Item"}</p>
        <h1 className="text-2xl font-extrabold leading-tight">{v.title}</h1>
        {v.photo_url && <img src={v.photo_url} alt={v.title} className="w-full rounded-2xl max-h-96 object-contain" style={{ background: "var(--line)" }} />}
        {forSale && (
          <Link href={`/item/${forSale.sku}`} className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }}>🛒 For sale now: {money(Number(forSale.price || 0))} · See it</Link>
        )}
        <div className="card p-4 text-center">
          <p className="text-xs muted uppercase tracking-wide">Worth about</p>
          <p className="text-4xl font-extrabold">{money(v.value_low)} – {money(v.value_high)}</p>
          <p className="text-xs muted">{v.era ? `${v.era} · ` : ""}{v.condition ? `${v.condition} · ` : ""}{v.retail_new ? `new: ${money(v.retail_new)} · ` : ""}confidence {v.confidence || "medium"} · valued {new Date(v.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}</p>
        </div>
        {v.why && <div className="card p-4 text-sm"><p className="font-semibold mb-1">Why</p><p>{v.why}</p>{v.watch_out && <p className="mt-2 p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>⚠ {v.watch_out}</p>}</div>}
        {places.length > 0 && <div className="card p-4 text-sm"><p className="font-semibold mb-1">Where it sells best</p>{places.map((p, i) => <p key={i}><b>{i + 1}. {p.place}</b> <span className="muted">— {p.why}</span></p>)}</div>}
        {(v.raise_value as string[])?.length > 0 && <div className="card p-4 text-sm"><p className="font-semibold mb-1">Get more for it</p><ul className="list-disc pl-5">{(v.raise_value as string[]).map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
        <div className="card p-4 text-center space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-bold">Got one like it?</p>
          <div className="flex gap-2"><Link href={v.source === "buypass" ? "/thrift" : "/worth"} className="btn btn-primary flex-1">{v.source === "buypass" ? "Check my find free" : "Value mine"}</Link><Link href="/pro" className="btn btn-secondary flex-1">Sell it here free</Link></div>
        </div>
        <p className="text-sm"><Link href={`/valued/about/${v.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w: string) => w.length > 2).slice(0, 2).join("-")}`} className="underline">All valuations like this one →</Link></p>
        {similar && similar.length > 0 && <div className="text-sm"><p className="font-semibold mb-1">Similar items people valued</p><ul className="space-y-1">{similar.map((s) => <li key={s.slug}><Link href={`/valued/${s.slug}`} className="underline">{s.title}</Link> <span className="muted">· {money(s.value_low)}–{money(s.value_high)}</span></li>)}</ul></div>}
        <ToolPitch compact />
        <p className="text-xs muted">An estimate from photos by Next Owner Market&apos;s valuation tool, shared by the owner. Not an appraisal; markets move. Rare or high-value items deserve a specialist.</p>
      </main>
    </div>
  );
}
