import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import { STATUS_LABELS, type Item, type ItemStatus } from "@/lib/types";

export const metadata = { title: "Inventory" };

const STATUS_FILTERS: { key: string; label: string; statuses?: ItemStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts", statuses: ["draft", "pending_review"] },
  { key: "active", label: "Listed", statuses: ["active", "reserved"] },
  { key: "sold", label: "Sold", statuses: ["sold", "shipped"] },
];

export default async function InventoryPage({ searchParams }: PageProps<"/app">) {
  const { q, status } = (await searchParams) as { q?: string; status?: string };
  const profile = (await getProfile())!;
  const staff = profile.role === "admin" || profile.role === "staff";
  const supabase = await createClient();

  let query = supabase
    .from("items")
    .select("id, sku, title, price, status, tier, location_id, created_at, item_photos(url, is_primary, sort_order), locations(code), profiles!items_owner_id_fkey(full_name, business_name)")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!staff) query = query.eq("owner_id", profile.id);
  const filter = STATUS_FILTERS.find((f) => f.key === status);
  if (filter?.statuses) query = query.in("status", filter.statuses);
  if (q) query = query.textSearch("search", q, { type: "websearch" });

  const { data: items, error } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{staff ? "Inventory" : "My items"}</h1>
        <Link href="/app/items/new" className="btn btn-primary">+ Add item</Link>
      </div>

      <form className="flex gap-2">
        <input className="input" name="q" placeholder="Search title, brand, model, SKU…" defaultValue={q || ""} />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn btn-secondary">Go</button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <Link key={f.key} href={`/app?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`pill px-3 py-2 whitespace-nowrap ${(status || "all") === f.key ? "pill-active" : ""}`}>
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

      <ul className="space-y-2">
        {(items as unknown as Item[] | null)?.map((it) => {
          const photo = it.item_photos?.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
          const pillClass = it.status === "active" ? "pill-active" : it.status === "sold" || it.status === "shipped" ? "pill-sold" : "pill-draft";
          return (
            <li key={it.id}>
              <Link href={`/app/items/${it.id}`} className="card p-3 flex gap-3 items-center">
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>
                  {photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{it.title || <span className="muted">Untitled</span>}</p>
                  <p className="text-sm muted truncate">
                    {it.sku}{it.locations?.code ? ` • ${it.locations.code}` : ""}
                    {staff && it.tier !== "owned" && it.profiles ? ` • ${it.profiles.business_name || it.profiles.full_name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{money(it.price)}</p>
                  <span className={`pill ${pillClass}`}>{STATUS_LABELS[it.status]}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
