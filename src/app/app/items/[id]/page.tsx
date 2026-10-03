import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money, commissionFor, DEFAULT_TIERS, facebookCopy, offerUpCopy, ebayCopy, craigslistCopy, etsyCopy, poshmarkCopy, vintedCopy, mercariCopy, depopCopy } from "@/lib/listing";
import { STATUS_LABELS, CONDITION_LABELS, TIER_LABELS, type Item } from "@/lib/types";
import ItemActions from "./ItemActions";
import CopyTabs from "./CopyTabs";
import SellerTools from "./SellerTools";
import { HOWTO } from "@/lib/howto";
import AuctionAdmin from "./AuctionAdmin";

interface AuctionRow { id: string; starting_bid: number; reserve_price: number | null; buy_now_price: number | null; current_bid: number | null; starts_at: string; ends_at: string; status: string }

export default async function ItemPage({ params, searchParams }: PageProps<"/app/items/[id]">) {
  const { id } = await params;
  const sq = (await searchParams) as { welcome?: string; written?: string };
  const welcome = !!sq.welcome;
  const written = !!sq.written && !welcome;
  const supabase = await createClient();
  const profile = (await getProfile())!;
  const staff = profile.role === "admin" || profile.role === "staff";

  const [{ data: item }, { data: settingsRows }, { data: statsRow }] = await Promise.all([
    supabase
      .from("items")
      .select("*, item_photos(*), categories(name, slug), locations(code), auctions(*), profiles!items_owner_id_fkey(full_name, business_name, default_commission_pct, phone, email, role, username, stripe_payouts_ready, suspended)")
      .eq("id", id)
      .single(),
    supabase.from("settings").select("key, value").in("key", ["business", "commission_tiers"]),
    supabase.from("item_stats").select("view_count, save_count, message_count, offer_count").eq("item_id", id).maybeSingle(),
  ]);
  if (!item) notFound();
  const stats = (statsRow as { view_count: number; save_count: number; message_count: number; offer_count: number } | null) || null;
  const x = item as unknown as { drop_pct?: number; drop_every_days?: number; drop_floor?: number; last_drop_at?: string };
  const it = item as unknown as Item & { auctions: AuctionRow[] | AuctionRow | null; profiles: { full_name: string; business_name: string; default_commission_pct: number | null; phone: string; email: string; role?: string; username?: string | null; stripe_payouts_ready?: boolean; suspended?: boolean } | null };
  const business = (settingsRows?.find((s) => s.key === "business")?.value as { name: string; location?: string }) || { name: "Next Owner Market" };
  const tiers = (settingsRows?.find((s) => s.key === "commission_tiers")?.value as typeof DEFAULT_TIERS) || DEFAULT_TIERS;
  const photos = [...(it.item_photos || [])].sort((a, b) => a.sort_order - b.sort_order);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const publicUrl = `${base}/item/${it.sku}`;
  const copyInput = { item: it, businessName: business.name, location: business.location, storefrontUrl: base || undefined };
  const pct = commissionFor(it, it.profiles?.default_commission_pct, tiers);
  const { data: sale } = it.status === "sold" || it.status === "shipped"
    ? await supabase.from("sales").select("*").eq("item_id", it.id).order("sold_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const sp = it.profiles;
  const platformItem = sp?.role === "admin" || sp?.role === "staff";
  const payReady = platformItem || !sp?.suspended;
  const live = it.status === "active" || it.status === "reserved";
  const it2 = it as unknown as { local_pickup_ok?: boolean; shipping_ok?: boolean; sale_type?: string };
  const buyerNotes: { ok: boolean; text: string }[] = [
    live ? { ok: true, text: "Buyers can see this listing in the store and on Google." }
      : it.status === "sold" || it.status === "shipped" ? { ok: false, text: "Sold. Buyers see it marked SOLD, with no Buy button." }
      : it.status === "pending_review" ? { ok: false, text: "Waiting for approval. Buyers can't see it yet; approve it under Review." }
      : { ok: false, text: "Draft. Buyers can't see it until it's listed." },
    it2.sale_type === "auction" ? { ok: true, text: "Auction: buyers see the bid box instead of Buy now." }
      : payReady ? { ok: true, text: "Buy now is ON. Buyers can pay by card, Apple Pay, Cash App, Affirm or Klarna." + (!platformItem && !sp?.stripe_payouts_ready ? " (Seller hasn't set up payouts yet: if it sells, we hold their money and send it when they finish.)" : "") }
      : { ok: false, text: sp?.suspended ? "Buy now is OFF: this seller is paused." : "Buy now is OFF: this seller hasn't finished payout setup. Buyers see a Message button and the shipping estimate instead." },
    { ok: !!(it2.local_pickup_ok || it2.shipping_ok), text: [it2.local_pickup_ok ? "pickup" : null, it2.shipping_ok ? "shipping" : null].filter(Boolean).join(" and ").replace(/^./, (c) => c.toUpperCase()) + (it2.local_pickup_ok || it2.shipping_ok ? " offered." : "Neither pickup nor shipping is turned on; buyers can't check out.") },
  ];

  return (
    <div className="space-y-4 pb-8">
      {welcome && (
        <div className="card p-4 space-y-2" style={{ borderLeft: "4px solid var(--ok)" }}>
          <p className="text-xl font-extrabold">🎉 Your first listing is saved.</p>
          <p className="text-sm">Two quick things and it can sell:</p>
          <ol className="text-sm list-decimal pl-5 space-y-1">
            <li>Check the price and words below. Tap <b>Edit</b> to change anything.</li>
            <li>Tap the green <b>List it in the store</b> button. It&apos;s free, buyers near you can find it, and it shows up on Google.</li>
          </ol>
          <p className="text-sm">Then copy it to Facebook and the other sites with the tabs further down.</p>
        </div>
      )}
      {written && (
        <div className="card p-4 space-y-2" style={{ borderLeft: "4px solid var(--ok)" }}>
          <p className="text-xl font-extrabold">🎉 Your listing is written.</p>
          <ol className="text-sm list-decimal pl-5 space-y-1">
            <li><a href="#copy" className="underline font-semibold">Copy the Facebook post</a> (and the other sites) further down.</li>
            <li>Tap <b>List it in the store</b> to put it on our site too. Free.</li>
            <li>Want to change the words, price or photos? Tap <b>Edit</b>. Each photo has ✨ Touch up.</li>
          </ol>
        </div>
      )}
      {(
        <div className="card p-3 space-y-2" style={{ borderLeft: "4px solid var(--brand)" }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold">What a buyer sees{staff && sp && !platformItem ? ` · seller: ${sp.business_name || sp.full_name}${sp.username ? ` @${sp.username}` : ""}` : ""}</p>
            {live || it.status === "sold" ? <Link href={`/item/${it.sku}`} className="btn btn-primary">👁 Open as a buyer</Link> : null}
          </div>
          <ul className="text-sm space-y-1">{buyerNotes.map((n, i) => <li key={i}>{n.ok ? "✅" : "⚠️"} {n.text}</li>)}</ul>
          {staff && <p className="text-xs muted">The button opens the real public page. Buy now works there for you too (you&apos;re not the seller), so you can check every step a buyer takes. Don&apos;t finish a payment unless you mean to buy it.</p>}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{it.title || "Untitled"}</h1>
          <p className="muted text-sm">{it.sku}{it.locations?.code ? ` • ${it.locations.code}` : ""}{it.categories ? ` • ${it.categories.name}` : ""}</p>
        </div>
        <span className={`pill shrink-0 ${it.status === "active" ? "pill-active" : it.status === "sold" ? "pill-sold" : "pill-draft"}`}>{STATUS_LABELS[it.status]}</span>
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p) => <img key={p.id} src={p.url} alt="" className="h-40 rounded-lg object-cover shrink-0" />)}
        </div>
      )}
      <Link href={`/app/items/${it.id}/edit#photos`} className="btn btn-secondary w-full">📷 Add, change or ✨ touch up photos</Link>

      <div className="card p-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="label">Price</p><p className="text-lg font-bold">{money(it.price)}</p>{it.price_min_suggested && <p className="muted">AI: {money(it.price_min_suggested)}–{money(it.price_max_suggested)}</p>}</div>
        <div><p className="label">Condition</p><p>{it.condition ? CONDITION_LABELS[it.condition] : "—"}</p>{it.condition_notes && <p className="muted">{it.condition_notes}</p>}</div>
        <div><p className="label">Ownership</p><p>{TIER_LABELS[it.tier]}</p>{it.tier !== "owned" && it.profiles && <p className="muted">{it.profiles.business_name || it.profiles.full_name} • {pct}% commission</p>}</div>
        <div><p className="label">Logistics</p><p>{[it.local_pickup_ok && "Pickup", it.shipping_ok && "Ships"].filter(Boolean).join(" • ") || "—"}</p>{staff && it.cost ? <p className="muted">Cost {money(it.cost)}</p> : null}</div>
        {(it.tested || it.serviced) && <div className="col-span-2"><p className="label">Tested / serviced</p><p>{[it.tested && "Tested, works", it.serviced && (it.service_notes || "Serviced")].filter(Boolean).join(". ")}</p></div>}
        {sale && <div className="col-span-2"><p className="label">Sold</p><p>{money(sale.sale_price)} via {sale.channel} to {sale.buyer_name || "—"} on {new Date(sale.sold_at).toLocaleDateString()} • {sale.payment_method || ""}{it.tier !== "owned" ? ` • consignor due ${money(sale.consignor_due)}` : ""}</p></div>}
      </div>

      <ItemActions item={{ id: it.id, sku: it.sku, status: it.status, price: it.price, tier: it.tier }} staff={staff} commissionPct={pct} />
      <SellerTools itemId={it.id} status={it.status} price={it.price} postedTo={(it as unknown as { posted_to?: Record<string, string> }).posted_to || {}} stats={stats} drop={{ pct: x.drop_pct ?? null, days: x.drop_every_days ?? null, floor: x.drop_floor ?? null, last: x.last_drop_at ?? null }} />
      {staff && (it.status === "active" || it.status === "draft" || it.status === "reserved") && (
        <AuctionAdmin itemId={it.id} price={it.price} auction={(Array.isArray(it.auctions) ? it.auctions.filter((a) => a.status !== "cancelled")[0] : it.auctions) || null} />
      )}

      <div className="flex gap-2 no-print">
        <Link href={`/app/items/${it.id}/edit`} className="btn btn-secondary flex-1">Edit</Link>
        <Link href={`/app/items/${it.id}/tag`} className="btn btn-secondary flex-1">🏷️ Print tag</Link>
        {it.status === "active" && <Link href={`/item/${it.sku}`} className="btn btn-secondary flex-1" target="_blank">View in store</Link>}
      </div>

      <section id="copy" className="space-y-3 scroll-mt-4">
        <h2 className="font-semibold">Copy &amp; paste listings</h2>
        <CopyTabs isPro={staff || profile.plan === "pro"} tabs={[
          { key: "facebook", label: "Facebook Marketplace / Group", short: "Facebook", text: facebookCopy(copyInput), howto: HOWTO.facebook },
          { key: "ebay", label: "eBay", short: "eBay", text: ebayCopy(copyInput), howto: HOWTO.ebay },
          { key: "offerup", label: "OfferUp", short: "OfferUp", text: offerUpCopy(copyInput), title: it.title, howto: HOWTO.offerup },
          { key: "craigslist", label: "Craigslist", short: "Craigslist", text: craigslistCopy(copyInput), howto: HOWTO.craigslist },
          { key: "mercari", label: "Mercari", short: "Mercari", text: mercariCopy(copyInput), howto: HOWTO.mercari },
          { key: "poshmark", label: "Poshmark", short: "Poshmark", text: poshmarkCopy(copyInput), howto: HOWTO.poshmark },
          { key: "vinted", label: "Vinted", short: "Vinted", text: vintedCopy(copyInput), howto: HOWTO.vinted },
          { key: "depop", label: "Depop", short: "Depop", text: depopCopy(copyInput), howto: HOWTO.depop },
          { key: "etsy", label: "Etsy (vintage / handmade only)", short: "Etsy", text: etsyCopy(copyInput), howto: HOWTO.etsy },
        ].map((t) => ({ ...t, locked: !(staff || profile.plan === "pro") && t.key !== "facebook" }))} />
        <div className="card p-3 text-sm">
          <p className="label">Storefront link</p>
          <p className="font-mono break-all">{publicUrl}</p>
        </div>
      </section>

      <section className="card p-4 text-sm space-y-1">
        <p className="label">Description</p>
        <p className="whitespace-pre-wrap">{it.description}</p>
        {Object.keys(it.specs || {}).length > 0 && (
          <ul className="mt-2">{Object.entries(it.specs).map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul>
        )}
        {it.tags?.length > 0 && <p className="muted mt-2">{it.tags.join(" · ")}</p>}
      </section>
    </div>
  );
}
