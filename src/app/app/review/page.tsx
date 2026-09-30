import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import ReviewClient from "./ReviewClient";

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

      <ReviewClient items={(items || []) as never} />
    </div>
  );
}
