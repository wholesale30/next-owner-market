import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const profile = (await getProfile())!;
  if (profile.role !== "admin" && profile.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("id, role, full_name, business_name, email, phone, approved, default_commission_pct, default_tier, created_at").order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">People</h1>
        <Link href="/app/settings" className="btn btn-secondary">⚙️ Settings</Link>
      </div>
      <p className="muted text-sm">Consignors, staff, and buyers. Tap to approve, set their commission, or change role.</p>
      {[...(people || [])].sort((a, b) => Number(b.role === "consignor" && !b.approved) - Number(a.role === "consignor" && !a.approved)).map((p) => (
        <Link key={p.id} href={`/app/people/${p.id}`} className="card p-3 flex items-center justify-between gap-2" style={p.role === "consignor" && !p.approved ? { borderColor: "var(--accent)", borderWidth: 2 } : undefined}>
          <div className="min-w-0">
            <p className="font-semibold truncate">{p.business_name || p.full_name || p.email}</p>
            <p className="text-sm muted truncate">{p.email}{p.phone ? ` • ${p.phone}` : ""}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="pill">{p.role}</span>
            {p.role === "consignor" && <p className="text-xs mt-1" style={{ color: p.approved ? "var(--ok)" : "var(--accent)" }}>{p.approved ? "approved" : "pending"}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
