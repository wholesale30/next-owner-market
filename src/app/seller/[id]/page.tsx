import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import StoreHeader from "../../StoreHeader";

export default async function SellerPage({ params }: PageProps<"/seller/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: seller }, { data: items }, { data: biz }, { data: ratings }] = await Promise.all([
    supabase.from("seller_public").select("*").eq("id", id).maybeSingle(),
    supabase.from("items").select("id, sku, title, price, status, listed_at, item_photos(url, is_primary)").eq("owner_id", id).in("status", ["active", "reserved"]).order("listed_at", { ascending: false }).limit(200),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.from("ratings").select("stars, comment, created_at").eq("ratee_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!seller) notFound();
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const isStore = seller.role === "admin" || seller.role === "staff";
  const name = isStore ? business.name : seller.display_name || "Seller";
  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="muted text-sm">
            {seller.rating_count ? `★ ${seller.rating_avg} (${seller.rating_count} ratings)` : "No ratings yet"}
            {seller.completed_sales ? ` • ${seller.completed_sales} completed sales` : ""} • Member since {new Date(seller.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}
            {!isStore && (seller.stripe_payouts_ready ? " • ✅ Verified seller, card checkout" : " • Not yet set up for checkout")}
          </p>
        </div>
        <h2 className="font-semibold">{items?.length || 0} items for sale</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items?.map((it) => {
            const photo = (it.item_photos as { url: string; is_primary: boolean }[]).find((p) => p.is_primary) || (it.item_photos as { url: string }[])[0];
            return (
              <li key={it.id}>
                <Link href={`/item/${it.sku}`} className="card overflow-hidden block h-full">
                  <div className="aspect-square" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="p-2"><p className="font-bold">{money(it.price)}{it.status === "reserved" && <span className="pill ml-1">on hold</span>}</p><p className="text-sm line-clamp-2">{it.title}</p></div>
                </Link>
              </li>
            );
          })}
        </ul>
        {ratings?.length ? (
          <section className="space-y-2">
            <h2 className="font-semibold">Recent ratings</h2>
            {ratings.map((r, i) => <div key={i} className="card p-2 text-sm">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)} {r.comment && <span className="muted">• {r.comment}</span>}</div>)}
          </section>
        ) : null}
        <Link href="/" className="text-sm muted">← All items</Link>
      </main>
    </div>
  );
}
