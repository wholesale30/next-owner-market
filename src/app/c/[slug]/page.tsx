import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "../../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import ToolPitch from "@/components/ToolPitch";
import { createClient as createAdminLoc } from "@supabase/supabase-js";
import { OWNER_LOC, withLoc } from "@/lib/item-location";
const adminLoc = () => createAdminLoc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Category landing pages: real text + the items, so "vintage receivers for sale" has a page to rank. */
export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("categories").select("name").eq("slug", slug).maybeSingle();
  if (!c) return {};
  return { title: `${c.name} for sale`, description: `Used and surplus ${c.name.toLowerCase()} from sellers across the country. Pay by card, pick up or ship, money held until you have it. New items daily.` };
}

export default async function CategoryPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: cats }, { data: biz }, { data: { user } }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, parent_id").order("sort_order"),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const c = cats?.find((x) => x.slug === slug);
  if (!c) notFound();
  const kids = (cats || []).filter((x) => x.parent_id === c.id);
  const parent = c.parent_id ? cats?.find((x) => x.id === c.parent_id) : null;
  const ids = [c.id, ...kids.map((k) => k.id)];
  const { data: rawItems } = await adminLoc().from("items").select(`id, sku, title, price, status, shipping_ok, shipping_mode, item_photos(url, is_primary), ${OWNER_LOC}`).in("category_id", ids).in("status", ["active", "reserved"]).order("listed_at", { ascending: false }).limit(60);
  const items = withLoc(rawItems as never[] as { owner?: unknown; id: string; sku: string; title: string; price: number; status: string; shipping_ok: boolean; shipping_mode: string | null; item_photos: unknown }[]);
  const { count: soldCount } = await supabase.from("items").select("id", { count: "exact", head: true }).in("category_id", ids).eq("status", "sold");
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${c.name} for sale`, url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com"}/c/${c.slug}`, hasPart: (items || []).slice(0, 20).map((i) => ({ "@type": "Product", name: i.title, offers: { "@type": "Offer", price: i.price, priceCurrency: "USD" } })) };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <p className="text-sm muted"><Link href="/" className="underline">All items</Link>{parent && <> › <Link href={`/c/${parent.slug}`} className="underline">{parent.name}</Link></>} › {c.name}</p>
        <div>
          <h1 className="text-2xl font-extrabold">{c.name} for sale</h1>
          <p className="muted text-sm">{items?.length || 0} listed now{soldCount ? ` · ${soldCount} sold` : ""}. Used, surplus, and vintage {c.name.toLowerCase()} from real sellers. Pay by card, pick up locally or have it shipped; your money is held until you have the item.</p>
        </div>
        {kids.length > 0 && <div className="flex gap-1 overflow-x-auto pb-1">{kids.map((k) => <Link key={k.id} href={`/c/${k.slug}`} className="pill px-3 py-2 whitespace-nowrap">{k.name}</Link>)}</div>}
        {!items?.length && <div className="card p-6 text-center space-y-2"><p className="font-semibold">Nothing in {c.name} right now.</p><p className="muted text-sm">Tell us what you&apos;re after and we&apos;ll email you when one shows up.</p><Link href="/looking-for" className="btn btn-primary">I&apos;m looking for…</Link></div>}
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items?.map((it) => {
            const ph = (it.item_photos as { url: string; is_primary: boolean }[] | null) || [];
            const photo = ph.find((p) => p.is_primary) || ph[0];
            return (
              <li key={it.id}>
                <Link href={`/item/${it.sku}`} className="card overflow-hidden block h-full">
                  <div className="aspect-square" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />}</div>
                  <div className="p-2 space-y-1">
                    <p className="font-bold">{money(it.price)}{it.status === "reserved" && <span className="pill ml-2">On hold</span>}</p>
                    <p className="text-sm leading-tight line-clamp-2">{it.title}</p>
                    <p className="text-xs muted">{[it.city && it.state ? `📍 ${it.city}, ${it.state}` : null, it.shipping_ok && (it.shipping_mode === "free" ? "🚚 Free shipping" : "🚚 Ships")].filter(Boolean).join(" • ")}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <ToolPitch compact />
        <div className="card p-4 text-sm space-y-1">
          <p className="font-semibold">Selling {c.name.toLowerCase()}?</p>
          <p className="muted">List it free in a minute: photos in, the AI writes the listing, buyers pay by card. <Link href="/worth" className="underline">Check what it&apos;s worth first</Link> or <Link href="/pro" className="underline">start selling</Link>.</p>
        </div>
      </main>
    </div>
  );
}
