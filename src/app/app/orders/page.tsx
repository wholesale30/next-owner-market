import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/app/orders">) {
  const me = (await getProfile())!;
  const { show } = (await searchParams) as { show?: string };
  const staff = me.role === "admin" || me.role === "staff";
  const supabase = await createClient();
  let q = supabase.from("orders").select("id, status, total, seller_due, fulfillment, created_at, tracking_number, items(sku, title), profiles!orders_buyer_id_fkey(full_name, username)").neq("status", "pending_payment").order("created_at", { ascending: false }).limit(200);
  if (!staff) q = q.eq("seller_id", me.id);
  if (show !== "all") q = q.in("status", ["paid", "disputed"]);
  const { data: orders } = await q;
  const label: Record<string, string> = { paid: "Paid • hand off", released: "Complete", refunded: "Refunded", disputed: "⚠ Problem", cancelled: "Cancelled" };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Orders</h1><p className="muted text-sm">Paid in the store. Enter the buyer&apos;s code at hand-off to get paid.</p></div>
        <div className="flex gap-1">
          <Link href="/app/orders" className={`pill px-3 py-2 ${show !== "all" ? "pill-active" : ""}`}>Open</Link>
          <Link href="/app/orders?show=all" className={`pill px-3 py-2 ${show === "all" ? "pill-active" : ""}`}>All</Link>
          {staff && <Link href="/app/disputes" className="pill px-3 py-2">Problems</Link>}
        </div>
      </div>
      {!orders?.length && <div className="card p-6 text-center muted text-sm">No orders yet. When someone taps Buy on your item, it shows up here.</div>}
      {orders?.map((o) => {
        const it = o.items as unknown as { sku: string; title: string } | null;
        const b = o.profiles as unknown as { full_name: string | null; username: string | null } | null;
        return (
          <Link key={o.id} href={`/account/orders/${o.id}`} className="card p-3 flex justify-between gap-2 text-sm" style={o.status === "disputed" ? { borderColor: "var(--danger)" } : o.status === "paid" ? { borderColor: "var(--accent)" } : undefined}>
            <div className="min-w-0"><p className="font-semibold truncate">{it?.title}</p><p className="muted">{staff ? b?.full_name || b?.username || "Buyer" : "@" + (b?.username || "buyer")} • {o.fulfillment === "ship" ? (o.tracking_number ? "shipped" : "needs shipping") : "pickup"} • {new Date(o.created_at).toLocaleDateString()}</p></div>
            <div className="text-right shrink-0"><p className="font-bold">{money(o.total)}</p><p className="text-xs">{label[o.status] || o.status}</p></div>
          </Link>
        );
      })}
    </div>
  );
}
