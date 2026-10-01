import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "../../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import ToolPitch from "@/components/ToolPitch";

/** City pages that build themselves from where items actually are: /near/richmond-va */
export const revalidate = 1800;
function parse(slug: string) { const m = /^(.+)-([a-z]{2})$/.exec(slug); if (!m) return null; return { city: m[1].split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), state: m[2].toUpperCase() }; }

export async function generateMetadata({ params }: PageProps<"/near/[slug]">): Promise<Metadata> {
  const { slug } = await params; const p = parse(slug); if (!p) return {};
  return { title: `Used stuff for sale near ${p.city}, ${p.state}: tools, audio, furniture, more`, description: `Local pickup and shipped items from sellers around ${p.city}, ${p.state}. Pay by card, money held until you have it. Sell yours free.` };
}

export default async function NearPage({ params }: PageProps<"/near/[slug]">) {
  const { slug } = await params; const p = parse(slug); if (!p) notFound();
  const supabase = await createClient();
  const [{ data: items }, { data: biz }, { data: { user } }] = await Promise.all([
    supabase.from("items").select("id, sku, title, price, status, city, state, shipping_ok, shipping_mode, item_photos(url, is_primary), categories(name)").ilike("city", p.city).eq("state", p.state).in("status", ["active", "reserved"]).order("listed_at", { ascending: false }).limit(60),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser(),
  ]);
  if (!items?.length) notFound();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const cats = new Map<string, number>(); for (const i of items) { const c = (i.categories as unknown as { name: string } | null)?.name; if (c) cats.set(c, (cats.get(c) || 0) + 1); }
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-extrabold">Used stuff for sale near {p.city}, {p.state}</h1>
        <p className="muted text-sm">{items.length} items from sellers in and around {p.city}. Pick up locally or have it shipped. Pay by card; your money is held until you have the item. {[...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${c} (${n})`).join(" · ")}</p>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => { const ph = (it.item_photos as { url: string; is_primary: boolean }[]) || []; const photo = ph.find((x) => x.is_primary) || ph[0]; return (
            <li key={it.id}><Link href={`/item/${it.sku}`} className="card overflow-hidden block h-full"><div className="aspect-square" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />}</div><div className="p-2 space-y-1"><p className="font-bold">{money(it.price)}</p><p className="text-sm leading-tight line-clamp-2">{it.title}</p><p className="text-xs muted">📍 {it.city}, {it.state}{it.shipping_ok ? " • 🚚 Ships" : ""}</p></div></Link></li>); })}
        </ul>
        <div className="card p-4 text-sm"><p className="font-semibold">Selling in {p.city}?</p><p className="muted">List free. Photos in, the AI writes it, local buyers pick up or we ship it. <Link href="/start" className="underline">Start with one box</Link>.</p></div>
        <ToolPitch compact />
      </main>
    </div>
  );
}
