import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { Item, ItemStatus } from "@/lib/types";
import InventoryList from "./InventoryList";
import SellerStart from "./SellerStart";

export const metadata = { title: "Inventory" };

const STATUS_FILTERS: { key: string; label: string; statuses?: ItemStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts", statuses: ["draft", "pending_review"] },
  { key: "active", label: "Listed", statuses: ["active", "reserved"] },
  { key: "sold", label: "Sold", statuses: ["sold", "shipped"] },
];

export default async function InventoryPage({ searchParams }: PageProps<"/app">) {
  const { q, status, bin } = (await searchParams) as { q?: string; status?: string; bin?: string };
  const profile = (await getProfile())!;
  const staff = profile.role === "admin" || profile.role === "staff";
  const supabase = await createClient();

  let query = supabase
    .from("items")
    .select("id, sku, title, price, status, tier, location_id, created_at, listed_at, item_photos(url, is_primary, sort_order), locations(code), profiles!items_owner_id_fkey(full_name, business_name)")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!staff) query = query.eq("owner_id", profile.id);
  const filter = STATUS_FILTERS.find((f) => f.key === (status || "active"));
  if (filter?.statuses) query = query.in("status", filter.statuses);
  if (q) query = query.textSearch("search", q, { type: "websearch" });
  if (bin) query = query.eq("location_id", bin);

  const now = new Date().getTime();
  const [{ data: items, error }, { data: locations }] = await Promise.all([query, staff ? supabase.from("locations").select("id, code").order("code") : Promise.resolve({ data: [] })]);

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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{staff ? "Inventory" : "My items"}</h1>
        <div className="flex gap-2">{staff && <Link href="/app/bins" className="btn btn-secondary">Bins</Link>}<Link href="/app/items/new" className="btn btn-primary">+ Add item</Link></div>
      </div>

      <form className="flex gap-2">
        <input className="input" name="q" placeholder="Search title, brand, model, SKU…" defaultValue={q || ""} />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn btn-secondary">Go</button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
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

      <InventoryList
        staff={staff}
        locations={locations || []}
        items={((items as unknown as Item[] | null) || []).map((it) => {
          const photo = [...(it.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
          return {
            id: it.id, sku: it.sku, title: it.title, price: it.price, status: it.status, tier: it.tier,
            photo: photo?.url || null, location: it.locations?.code || null,
            owner: staff && it.tier !== "owned" && it.profiles ? it.profiles.business_name || it.profiles.full_name || null : null,
            stale: it.status === "active" && !!it.listed_at && now - new Date(it.listed_at).getTime() > 30 * 86400000,
          };
        })}
      />
    </div>
  );
}
