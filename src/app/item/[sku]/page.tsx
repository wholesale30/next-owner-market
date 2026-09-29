import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import { CONDITION_LABELS, type Item } from "@/lib/types";
import StoreHeader from "../../StoreHeader";
import PhotoGallery from "./PhotoGallery";
import BuyerPanel from "./BuyerPanel";
import AuctionPanel from "./AuctionPanel";

export const revalidate = 0;

interface AuctionRow { id: string; starting_bid: number; reserve_price: number | null; buy_now_price: number | null; current_bid: number | null; current_bidder_id: string | null; starts_at: string; ends_at: string; status: string; extend_minutes: number }

async function load(sku: string) {
  const supabase = await createClient();
  await supabase.rpc("close_ended_auctions");
  const [{ data: item }, { data: biz }] = await Promise.all([
    supabase.from("items").select("*, item_photos(*), categories(name, slug), auctions(*)").eq("sku", sku.toUpperCase()).in("status", ["active", "reserved", "sold"]).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  return { item: item as unknown as (Item & { auctions: AuctionRow | AuctionRow[] | null }) | null, business: (biz?.value as { name: string; tagline?: string; location?: string; contact_phone?: string; contact_email?: string }) || { name: "Next Owner Market" } };
}

export async function generateMetadata({ params }: PageProps<"/item/[sku]">): Promise<Metadata> {
  const { sku } = await params;
  const { item, business } = await load(sku);
  if (!item) return { title: "Not found" };
  const photo = item.item_photos?.find((p) => p.is_primary) || item.item_photos?.[0];
  return {
    title: item.title,
    description: item.description.slice(0, 160),
    openGraph: { title: `${item.title} – ${money(item.price)}`, description: item.description.slice(0, 200), images: photo ? [photo.url] : [], siteName: business.name },
  };
}

export default async function PublicItemPage({ params }: PageProps<"/item/[sku]">) {
  const { sku } = await params;
  const { item, business } = await load(sku);
  if (!item) notFound();
  const auction = Array.isArray(item.auctions) ? item.auctions[0] : item.auctions;
  const photos = [...(item.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const contactSubject = encodeURIComponent(`Interested in ${item.title} (${item.sku})`);
  const smsBody = encodeURIComponent(`Hi, I'm interested in ${item.title} (${item.sku}). Is it still available?`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: item.description,
    sku: item.sku,
    brand: item.brand ? { "@type": "Brand", name: item.brand } : undefined,
    image: photos.map((p) => p.url),
    offers: { "@type": "Offer", price: item.price, priceCurrency: "USD", availability: item.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut", itemCondition: item.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition" },
  };

  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="max-w-3xl mx-auto p-4 space-y-4 pb-28">
        <Link href="/" className="text-sm muted">← All items</Link>
        <PhotoGallery photos={photos.map((p) => p.url)} alt={item.title} />
        <div>
          <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>
          <p className="text-3xl font-extrabold mt-1">{money(item.price)}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {item.status === "sold" && <span className="pill pill-sold">Sold</span>}
            {item.status === "reserved" && <span className="pill">On hold</span>}
            {item.condition && <span className="pill">{CONDITION_LABELS[item.condition]}</span>}
            {item.tested && <span className="pill pill-active">✔ Tested, works</span>}
            {item.serviced && <span className="pill pill-active">✔ Serviced</span>}
            {item.local_pickup_ok && <span className="pill">Local pickup</span>}
            {item.shipping_ok && <span className="pill">Ships</span>}
          </div>
        </div>

        {auction && item.sale_type === "auction" && <AuctionPanel auction={auction} sku={item.sku} />}
        {item.status !== "sold" && <BuyerPanel itemId={item.id} sku={item.sku} title={item.title} canPickup={item.local_pickup_ok} />}

        <div className="card p-4 space-y-3 text-sm">
          <p className="whitespace-pre-wrap">{item.description}</p>
          {item.serviced && item.service_notes && <p><b>Service done:</b> {item.service_notes}</p>}
          {item.condition_notes && <p><b>Condition notes:</b> {item.condition_notes}</p>}
          {(item.brand || item.model || Object.keys(item.specs || {}).length > 0) && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
              {item.brand && <><dt className="muted">Brand</dt><dd>{item.brand}</dd></>}
              {item.model && <><dt className="muted">Model</dt><dd>{item.model}</dd></>}
              {Object.entries(item.specs || {}).map(([k, v]) => <><dt key={k + "k"} className="muted">{k}</dt><dd key={k + "v"}>{v}</dd></>)}
            </dl>
          )}
          <p className="text-xs muted">Item #{item.sku}{item.categories ? ` • ${item.categories.name}` : ""}</p>
        </div>

        {item.status !== "sold" && (
          <div className="fixed bottom-0 inset-x-0 p-3 border-t" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <div className="max-w-3xl mx-auto flex gap-2">
              {business.contact_phone && <a href={`sms:${business.contact_phone}?&body=${smsBody}`} className="btn btn-primary flex-1">💬 Text about this</a>}
              {business.contact_email && <a href={`mailto:${business.contact_email}?subject=${contactSubject}`} className="btn btn-secondary flex-1">✉️ Email</a>}
              {!business.contact_phone && !business.contact_email && <Link href="/looking-for" className="btn btn-primary flex-1">Ask about this item</Link>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
