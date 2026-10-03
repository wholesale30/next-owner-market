import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { Item, ItemStatus } from "@/lib/types";
import InventoryList from "./InventoryList";
import SellerStart from "./SellerStart";
import AskBox from "@/app/help/AskBox";
import UsesMeter from "@/components/UsesMeter";
import { allowanceFor } from "@/lib/usage";
import { admin } from "@/lib/stripe";

export const metadata = { title: "Inventory" };

const STATUS_FILTERS: { key: string; label: string; statuses?: ItemStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts", statuses: ["draft", "pending_review"] },
  { key: "active", label: "Listed", statuses: ["active", "reserved"] },
  { key: "sold", label: "Sold", statuses: ["sold", "shipped"] },
];

export default async function InventoryPage({ searchParams }: PageProps<"/app">) {
  const { q, status, bin, seller } = (await searchParams) as { q?: string; status?: string; bin?: string; seller?: string };
  const profile = (await getProfile())!;
  const staff = profile.role === "admin" || profile.role === "staff";
  const supabase = await createClient();

  let query = supabase
    .from("items")
    .select("id, sku, title, price, status, tier, location_id, created_at, listed_at, item_photos(url, is_primary, sort_order), locations(code), owner_id, profiles!items_owner_id_fkey(id, full_name, business_name, username, email)")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(staff ? 1000 : 200);
  if (!staff) query = query.eq("owner_id", profile.id);
  if (staff && seller) query = query.eq("owner_id", seller);
  const filter = STATUS_FILTERS.find((f) => f.key === (status || "active"));
  if (filter?.statuses) query = query.in("status", filter.statuses);
  if (q) query = query.textSearch("search", q, { type: "websearch" });
  if (bin) query = query.eq("location_id", bin);

  const now = new Date().getTime();
  const [{ data: items, error }, { data: locations }] = await Promise.all([query, staff ? supabase.from("locations").select("id, code").order("code") : Promise.resolve({ data: [] })]);

  // Saved lookups waiting to be listed: show them right here, where people look for their stuff
  const { data: waiting, count: waitingN } = await admin().from("lookups").select("id, title, photo_urls, value_low, value_high, tool", { count: "exact" }).eq("owner_id", profile.id).is("deleted_at", null).is("item_id", null).eq("listed_count", 0).order("created_at", { ascending: false }).limit(3);
  let start: React.ReactNode = null;
  if (!staff) {
    const [{ count: total }, { count: live }] = await Promise.all([
      supabase.from("items").select("id", { count: "exact", head: true }).eq("owner_id", profile.id).neq("status", "archived"),
      supabase.from("items").select("id", { count: "exact", head: true }).eq("owner_id", profile.id).in("status", ["active", "reserved", "sold"]),
    ]);
    start = <SellerStart approved={!!profile.approved} payoutsReady={!!profile.stripe_payouts_ready} itemCount={total || 0} liveCount={live || 0} refCode={profile.referral_code} refCount={profile.referral_count || 0} credits={profile.pro_credit_months || 0} isPro={profile.plan === "pro"} hasLocation={!!(profile.zip && profile.state)} />;
  }
  return (
    <div className="space-y-4">
      {start}
      {!staff && <UsesMeter a={allowanceFor(profile)} />}
      {(waitingN || 0) > 0 && (
        <section className="card p-3 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-bold">📂 Saved lookups, not listed yet ({waitingN})</p>
            <Link href="/lookups" className="text-sm underline whitespace-nowrap">See all</Link>
          </div>
          {(waiting || []).map((w) => (
            <Link key={w.id} href={`/${w.tool === "buy_or_pass" ? "buy-or-pass" : w.tool}?open=${w.id}`} className="flex items-center gap-2 text-sm">
              {(w.photo_urls || [])[0] ? <img src={w.photo_urls[0]} alt="" className="w-10 h-10 rounded object-cover shrink-0" /> : null}
              <span className="flex-1 min-w-0 truncate">{w.title}</span>
              <b className="whitespace-nowrap">${Math.round(Number(w.value_low || 0))}–${Math.round(Number(w.value_high || 0))}</b>
            </Link>
          ))}
          <Link href="/lookups" className="btn btn-primary w-full" style={{ minHeight: 48 }}>📝 List them</Link>
        </section>
      )}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{staff ? "Inventory" : "My items"}</h1>
        <div className="flex gap-2">{staff && <Link href="/app/bins" className="btn btn-secondary">Bins</Link>}<Link href="/app/items/new" className="btn btn-primary">+ Add item</Link></div>
      </div>

      <form className="flex gap-2">
        <input className="input" name="q" placeholder="Search your items…" defaultValue={q || ""} />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn btn-secondary">Go</button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        <Link href="/lookups" className="pill px-3 py-2 whitespace-nowrap">📂 Lookups{waitingN ? ` (${waitingN})` : ""}</Link>
        {STATUS_FILTERS.map((f) => (
          <Link key={f.key} href={`/app?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`pill px-3 py-2 whitespace-nowrap ${(status || "active") === f.key ? "pill-active" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error.message}</p>}

      {!items?.length && (
        <div className="card p-8 text-center space-y-2">
          <p className="font-semibold">Nothing here yet.</p>
          <p className="muted text-sm">Tap <b>+ Add item</b>, take a few photos, and the listing writes itself.</p>
        </div>
      )}

      {(() => {
        type Row = Item & { owner_id: string; profiles: { id: string; full_name: string | null; business_name: string | null; username: string | null; email: string | null } | null };
        const rows = (items as unknown as Row[] | null) || [];
        const shape = (it: Row) => {
          const photo = [...(it.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
          return {
            id: it.id, sku: it.sku, title: it.title, price: it.price, status: it.status, tier: it.tier,
            photo: photo?.url || null, location: it.locations?.code || null, owner: null,
            stale: it.status === "active" && !!it.listed_at && now - new Date(it.listed_at).getTime() > 30 * 86400000,
          };
        };
        if (!staff) return <InventoryList staff={false} locations={[]} items={rows.map(shape)} />;
        // Owner view: every seller's items, grouped under that seller.
        const groups = new Map<string, { name: string; rows: Row[] }>();
        for (const it of rows) {
          const p = it.profiles;
          const name = it.owner_id === profile.id ? "Yours (store)" : [p?.business_name || p?.full_name || "Unnamed seller", p?.username ? `@${p.username}` : null].filter(Boolean).join(" · ");
          const g = groups.get(it.owner_id) || { name, rows: [] };
          g.rows.push(it); groups.set(it.owner_id, g);
        }
        const list = [...groups.entries()].sort((a, b) => (a[0] === profile.id ? -1 : b[0] === profile.id ? 1 : b[1].rows.length - a[1].rows.length));
        return (
          <div className="space-y-5">
            <div className="flex gap-1 overflow-x-auto">
              <Link href={`/app?status=${status || "active"}`} className={`pill px-3 py-2 whitespace-nowrap ${!seller ? "pill-active" : ""}`}>All sellers</Link>
              {list.map(([id, g]) => <Link key={id} href={`/app?status=${status || "active"}&seller=${id}`} className={`pill px-3 py-2 whitespace-nowrap ${seller === id ? "pill-active" : ""}`}>{g.name.split(" · ")[0]} ({g.rows.length})</Link>)}
            </div>
            {list.map(([id, g]) => (
              <section key={id} className="space-y-2">
                <h2 className="font-bold text-lg flex items-center justify-between gap-2"><span>{g.name}</span><span className="text-sm muted font-normal">{g.rows.length} item{g.rows.length === 1 ? "" : "s"}</span></h2>
                <InventoryList staff={staff} locations={locations || []} items={g.rows.map(shape)} />
              </section>
            ))}
          </div>
        );
      })()}
      {!staff && <AskBox compact />}
    </div>
  );
}
