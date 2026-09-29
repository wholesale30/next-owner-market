import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import ResolveButtons from "./ResolveButtons";

export const metadata = { title: "Problems" };

export default async function DisputesPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const { data: rows } = await supabase.from("disputes").select("id, status, reason, resolution_note, created_at, orders(id, status, total, fulfillment, items(sku, title), profiles!orders_buyer_id_fkey(full_name, email, phone)), profiles!disputes_opened_by_fkey(full_name, role)").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="space-y-3">
      <div><h1 className="text-2xl font-bold">Problems</h1><p className="muted text-sm">Money is frozen until you decide. Refund the buyer, or release to the seller.</p></div>
      {!rows?.length && <div className="card p-6 text-center muted text-sm">No problems reported.</div>}
      {rows?.map((d) => {
        const o = d.orders as unknown as { id: string; status: string; total: number; fulfillment: string; items: { sku: string; title: string } | null; profiles: { full_name: string | null; email: string | null; phone: string | null } | null } | null;
        const by = d.profiles as unknown as { full_name: string | null; role: string } | null;
        return (
          <div key={d.id} className="card p-3 space-y-2 text-sm" style={d.status === "open" ? { borderColor: "var(--danger)" } : undefined}>
            <div className="flex justify-between gap-2"><Link href={`/account/orders/${o?.id}`} className="font-semibold underline truncate">{o?.items?.title}</Link><span className="shrink-0">{money(o?.total || 0)} • {d.status.replace("_", " ")}</span></div>
            <p className="muted">Opened by {by?.full_name || "?"} ({by?.role}) • buyer {o?.profiles?.full_name} {o?.profiles?.phone || o?.profiles?.email} • {new Date(d.created_at).toLocaleString()}</p>
            <p className="whitespace-pre-wrap">{d.reason}</p>
            {d.resolution_note && <p className="muted">Decision: {d.resolution_note}</p>}
            {d.status === "open" && o && <ResolveButtons orderId={o.id} />}
          </div>
        );
      })}
    </div>
  );
}
