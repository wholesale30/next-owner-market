import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money, commissionFor, DEFAULT_TIERS, facebookCopy, offerUpCopy, ebayCopy, craigslistCopy } from "@/lib/listing";
import { STATUS_LABELS, CONDITION_LABELS, TIER_LABELS, type Item } from "@/lib/types";
import ItemActions from "./ItemActions";
import CopyBlock from "./CopyBlock";
import AuctionAdmin from "./AuctionAdmin";

interface AuctionRow { id: string; starting_bid: number; reserve_price: number | null; buy_now_price: number | null; current_bid: number | null; starts_at: string; ends_at: string; status: string }

export default async function ItemPage({ params }: PageProps<"/app/items/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = (await getProfile())!;
  const staff = profile.role === "admin" || profile.role === "staff";

  const [{ data: item }, { data: settingsRows }] = await Promise.all([
    supabase
      .from("items")
      .select("*, item_photos(*), categories(name, slug), locations(code), auctions(*), profiles!items_owner_id_fkey(full_name, business_name, default_commission_pct, phone, email)")
      .eq("id", id)
      .single(),
    supabase.from("settings").select("key, value").in("key", ["business", "commission_tiers"]),
  ]);
  if (!item) notFound();
  const it = item as unknown as Item & { auctions: AuctionRow[] | AuctionRow | null; profiles: { full_name: string; business_name: string; default_commission_pct: number | null; phone: string; email: string } | null };
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

  return (
    <div className="space-y-4 pb-8">
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

      <div className="card p-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="label">Price</p><p className="text-lg font-bold">{money(it.price)}</p>{it.price_min_suggested && <p className="muted">AI: {money(it.price_min_suggested)}–{money(it.price_max_suggested)}</p>}</div>
        <div><p className="label">Condition</p><p>{it.condition ? CONDITION_LABELS[it.condition] : "—"}</p>{it.condition_notes && <p className="muted">{it.condition_notes}</p>}</div>
        <div><p className="label">Ownership</p><p>{TIER_LABELS[it.tier]}</p>{it.tier !== "owned" && it.profiles && <p className="muted">{it.profiles.business_name || it.profiles.full_name} • {pct}% commission</p>}</div>
        <div><p className="label">Logistics</p><p>{[it.local_pickup_ok && "Pickup", it.shipping_ok && "Ships"].filter(Boolean).join(" • ") || "—"}</p>{staff && it.cost ? <p className="muted">Cost {money(it.cost)}</p> : null}</div>
        {(it.tested || it.serviced) && <div className="col-span-2"><p className="label">Tested / serviced</p><p>{[it.tested && "Tested, works", it.serviced && (it.service_notes || "Serviced")].filter(Boolean).join(". ")}</p></div>}
        {sale && <div className="col-span-2"><p className="label">Sold</p><p>{money(sale.sale_price)} via {sale.channel} to {sale.buyer_name || "—"} on {new Date(sale.sold_at).toLocaleDateString()} • {sale.payment_method || ""}{it.tier !== "owned" ? ` • consignor due ${money(sale.consignor_due)}` : ""}</p></div>}
      </div>

      <ItemActions item={{ id: it.id, sku: it.sku, status: it.status, price: it.price, tier: it.tier }} staff={staff} commissionPct={pct} />
      {staff && (it.status === "active" || it.status === "draft" || it.status === "reserved") && (
        <AuctionAdmin itemId={it.id} price={it.price} auction={(Array.isArray(it.auctions) ? it.auctions.filter((a) => a.status !== "cancelled")[0] : it.auctions) || null} />
      )}

      <div className="flex gap-2 no-print">
        <Link href={`/app/items/${it.id}/edit`} className="btn btn-secondary flex-1">Edit</Link>
        <Link href={`/app/items/${it.id}/tag`} className="btn btn-secondary flex-1">🏷️ Print tag</Link>
        {it.status === "active" && <Link href={`/item/${it.sku}`} className="btn btn-secondary flex-1" target="_blank">View in store</Link>}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Copy &amp; paste listings</h2>
        <p className="text-sm muted">Tap copy, open the app, paste. Save the photos above to your phone first (press and hold).</p>
        <CopyBlock label="Facebook Marketplace / Group" text={facebookCopy(copyInput)} />
        <CopyBlock label="OfferUp" text={offerUpCopy(copyInput)} title={it.title} />
        <CopyBlock label="eBay" text={ebayCopy(copyInput)} />
        <CopyBlock label="Craigslist" text={craigslistCopy(copyInput)} />
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
