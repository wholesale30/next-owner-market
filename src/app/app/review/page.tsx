import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import type { Item } from "@/lib/types";

export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const profile = (await getProfile())!;
  if (profile.role !== "admin" && profile.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("id, sku, title, price, tier, created_at, item_photos(url, is_primary, sort_order), profiles!items_owner_id_fkey(full_name, business_name, approved)")
    .eq("status", "pending_review")
    .order("created_at");
  const { data: pendingPeople } = await supabase.from("profiles").select("id, full_name, business_name, email, phone, created_at").eq("role", "consignor").eq("approved", false).order("created_at");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review</h1>
        <p className="muted text-sm">Consignor items waiting for your OK, and new consignors to approve.</p>
      </div>

      {pendingPeople?.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">New consignors ({pendingPeople.length})</h2>
          {pendingPeople.map((p) => (
            <Link key={p.id} href={`/app/people/${p.id}`} className="card p-3 flex justify-between items-center">
              <div><p className="font-semibold">{p.business_name || p.full_name || p.email}</p><p className="text-sm muted">{p.email} {p.phone}</p></div>
              <span className="pill pill-draft">Approve →</span>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Items to review ({items?.length || 0})</h2>
        {!items?.length && <div className="card p-6 text-center muted text-sm">Queue is empty.</div>}
        {(items as unknown as Item[] | null)?.map((it) => {
          const photo = [...(it.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
          return (
            <Link key={it.id} href={`/app/items/${it.id}`} className="card p-3 flex gap-3 items-center">
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{it.title}</p>
                <p className="text-sm muted truncate">{it.profiles?.business_name || it.profiles?.full_name} • {it.sku}</p>
              </div>
              <p className="font-semibold">{money(it.price)}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
