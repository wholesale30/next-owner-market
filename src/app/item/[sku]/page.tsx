import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import { CONDITION_LABELS, type Item } from "@/lib/types";
import StoreHeader from "../../StoreHeader";
import PhotoGallery from "./PhotoGallery";
import BuyButton from "./BuyButton";
import WatchButton from "./WatchButton";
import OfferButton from "./OfferButton";
import { stripeReady } from "@/lib/stripe";
import { lookupZip, milesBetween } from "@/lib/geo";
import BuyerPanel from "./BuyerPanel";
import AuctionPanel from "./AuctionPanel";
import MessageForm from "./MessageForm";

export const revalidate = 0;

interface AuctionRow { id: string; starting_bid: number; reserve_price: number | null; buy_now_price: number | null; current_bid: number | null; current_bidder_id: string | null; starts_at: string; ends_at: string; status: string; extend_minutes: number }

async function load(sku: string) {
  const supabase = await createClient();
  await supabase.rpc("close_ended_auctions");
  const [{ data: item }, { data: biz }] = await Promise.all([
    supabase.from("items").select("*, item_photos(*), item_videos(*), categories(name, slug), auctions(*)").eq("sku", sku.toUpperCase()).in("status", ["active", "reserved", "sold"]).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const { data: seller } = item ? await supabase.from("seller_public").select("*").eq("id", item.owner_id).maybeSingle() : { data: null };
  return { item: item as unknown as (Item & { auctions: AuctionRow | AuctionRow[] | null }) | null, seller: seller as { id: string; role: string; display_name: string; stripe_payouts_ready: boolean; suspended: boolean; rating_avg: number | null; rating_count: number; completed_sales: number; city: string | null; state: string | null; lat: number | null; lng: number | null } | null, business: (biz?.value as { name: string; tagline?: string; location?: string; contact_phone?: string; contact_email?: string }) || { name: "Next Owner Market" } };
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
  const { item, seller, business } = await load(sku);
  if (!item) notFound();
  const auction = Array.isArray(item.auctions) ? item.auctions[0] : item.auctions;
  const sellerIsPlatform = seller?.role === "admin" || seller?.role === "staff";
  const pickupLoc = sellerIsPlatform ? business.location || "" : [seller?.city, seller?.state].filter(Boolean).join(", ");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  let miles: number | null = null;
  let buyerZip: string | null = null;
  {
    const { data: me } = user ? await sb.from("profiles").select("zip").eq("id", user.id).maybeSingle() : { data: null };
    buyerZip = me?.zip || null;
    const here = lookupZip(me?.zip);
    const bz = (business as { zip?: string; address?: string });
    const there = sellerIsPlatform ? lookupZip(bz.zip || (bz.address || "").match(/\b(\d{5})\b/)?.[1]) : (seller?.lat != null && seller?.lng != null ? { lat: seller.lat, lng: seller.lng } : null);
    if (here && there) miles = Math.round(milesBetween(here.lat, here.lng, there.lat, there.lng));
  }
  const sellerReady = stripeReady() && !!seller && (sellerIsPlatform || (seller.stripe_payouts_ready && !seller.suspended));
  const veh = item as unknown as { year?: number | null; mileage?: number | null; title_status?: string | null; title_in_hand?: boolean };
  const { data: isVeh } = item.category_id ? await sb.rpc("is_vehicle_category", { p_cat: item.category_id }) : { data: false };
  const bz = business as unknown as { vehicle_card_max?: number; vehicle_deposit_pct?: number; vehicle_deposit_min?: number; vehicle_deposit_max?: number };
  const deposit = isVeh && Number(item.price) > Number(bz.vehicle_card_max ?? 5000) ? Math.min(Math.max(Math.round(Number(item.price) * Number(bz.vehicle_deposit_pct ?? 5) / 100), Number(bz.vehicle_deposit_min ?? 100)), Number(bz.vehicle_deposit_max ?? 500)) : null;
  const { data: myWatch } = user ? await sb.from("favorites").select("item_id").eq("item_id", item.id).eq("profile_id", user.id).maybeSingle() : { data: null };
  const watching = !!myWatch;
  const { data: myOffer } = user ? await sb.from("offers").select("id, amount, counter_amount, status, expires_at").eq("item_id", item.id).eq("buyer_id", user.id).in("status", ["pending", "countered", "accepted"]).order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const photos = [...(item.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
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
      <StoreHeader business={business} signedIn={!!user} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="max-w-3xl mx-auto p-4 space-y-4 pb-28">
        <Link href="/" className="text-sm muted">← All items</Link>
        <PhotoGallery media={[...photos.map((p) => ({ type: "photo" as const, url: p.url })), ...[...(item.item_videos || [])].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ type: "video" as const, url: v.url }))]} alt={item.title} />
        <div>
          <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>
          <div className="flex items-center justify-between gap-2 mt-1"><p className="text-3xl font-extrabold">{money(item.price)}</p>{item.status !== "sold" && <WatchButton itemId={item.id} sku={item.sku} price={item.price} signedIn={!!user} watching={watching} saves={Number((item as unknown as { save_count?: number }).save_count || 0)} />}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {item.status === "sold" && <span className="pill pill-sold">Sold</span>}
            {item.status === "reserved" && <span className="pill">On hold</span>}
            {item.condition && <span className="pill">{CONDITION_LABELS[item.condition]}</span>}
            {item.tested && <span className="pill pill-active">✔ Tested, works</span>}
            {item.serviced && <span className="pill pill-active">✔ Serviced</span>}
            {item.local_pickup_ok && <span className="pill">📍 Pickup{pickupLoc ? ` in ${pickupLoc}` : ""}{miles != null ? ` · ${miles} mi from you` : ""}</span>}
            {item.shipping_ok && <span className="pill">{(item as unknown as { shipping_mode?: string }).shipping_mode === "free" ? "🚚 Free shipping" : "🚚 Ships"}</span>}
            {veh.year && <span className="pill">{veh.year}</span>}
            {veh.mileage != null && <span className="pill">{veh.mileage.toLocaleString()} {/boat|rv|atv|equip/i.test(item.categories?.name || "") ? "hrs" : "mi"}</span>}
            {veh.title_status && <span className="pill">{veh.title_status === "none" ? "No title" : veh.title_status === "bill_of_sale_only" ? "Bill of sale only" : `${veh.title_status[0].toUpperCase()}${veh.title_status.slice(1)} title`}{veh.title_in_hand ? " in hand" : ""}</span>}
          </div>
        </div>

        {auction && item.sale_type === "auction" && <AuctionPanel auction={auction} sku={item.sku} />}
        {item.status === "active" && item.sale_type !== "auction" && (
          <BuyButton itemId={item.id} sku={item.sku} price={Number(item.price)} canPickup={item.local_pickup_ok} canShip={item.shipping_ok} shippingPrice={Number(item.shipping_price || 0)} sellerReady={sellerReady} signedIn={!!user} pickupLoc={pickupLoc} buyerZip={buyerZip} shippingMode={(item as unknown as { shipping_mode?: string }).shipping_mode || "calculated"} deposit={deposit} />
        )}
        {item.status === "active" && item.sale_type !== "auction" && sellerReady && item.owner_id !== user?.id && (
          <OfferButton itemId={item.id} sku={item.sku} price={Number(item.price)} canPickup={item.local_pickup_ok} canShip={item.shipping_ok} signedIn={!!user} existing={myOffer as never} />
        )}
        {seller && !sellerIsPlatform && (
          <p className="text-xs muted">Sold by <Link href={`/seller/${seller.id}`} className="underline">{seller.display_name || "a member"}</Link>{seller.rating_count ? ` • ★ ${seller.rating_avg} (${seller.rating_count})` : " • new seller"}{seller.completed_sales ? ` • ${seller.completed_sales} sales` : ""} • Payment held until hand-off</p>
        )}
        {item.status !== "sold" && <BuyerPanel sku={item.sku} signedIn={!!user} />}

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
            <div className="max-w-3xl mx-auto flex gap-2 items-start">
              <MessageForm itemId={item.id} title={item.title} sku={item.sku} signedIn={!!user} accountEmail={user?.email} />
              {business.contact_phone && <a href={`sms:${business.contact_phone}?&body=${smsBody}`} className="btn btn-secondary" title="Text us">📱</a>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
