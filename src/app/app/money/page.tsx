import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import PayoutButton from "./PayoutButton";

export const metadata = { title: "Money" };

interface SaleRow {
  id: string;
  sale_price: number;
  shipping_charged: number;
  shipping_cost: number;
  platform_fees: number;
  commission_pct: number;
  commission_amount: number;
  consignor_due: number;
  channel: string;
  payment_method: string | null;
  sold_at: string;
  buyer_name: string | null;
  items: { id: string; sku: string; title: string; cost: number | null; tier: string; owner_id: string; profiles: { full_name: string | null; business_name: string | null } | null } | null;
}

export default async function MoneyPage() {
  const profile = (await getProfile())!;
  const staff = profile.role === "admin" || profile.role === "staff";
  const supabase = await createClient();

  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, sale_price, shipping_charged, shipping_cost, platform_fees, commission_pct, commission_amount, consignor_due, channel, payment_method, sold_at, buyer_name, items!inner(id, sku, title, cost, tier, owner_id, profiles!items_owner_id_fkey(full_name, business_name))")
    .order("sold_at", { ascending: false })
    .limit(500);
  const sales = (salesRaw as unknown as SaleRow[]) || [];

  const { data: paidRows } = await supabase.from("payout_sales").select("sale_id");
  const paidSet = new Set((paidRows || []).map((p) => p.sale_id));

  // consignor balances = unpaid consignor_due grouped by owner
  const balances = new Map<string, { name: string; due: number; saleIds: string[] }>();
  for (const s of sales) {
    if (!s.items || s.items.tier === "owned" || paidSet.has(s.id)) continue;
    const key = s.items.owner_id;
    const cur = balances.get(key) || { name: s.items.profiles?.business_name || s.items.profiles?.full_name || "Consignor", due: 0, saleIds: [] };
    cur.due += Number(s.consignor_due);
    cur.saleIds.push(s.id);
    balances.set(key, cur);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth = sales.filter((s) => s.sold_at >= monthStart);
  const gross = (rows: SaleRow[]) => rows.reduce((a, s) => a + Number(s.sale_price), 0);
  const profit = (rows: SaleRow[]) =>
    rows.reduce((a, s) => {
      const mine = s.items?.tier === "owned" ? Number(s.sale_price) - Number(s.items?.cost || 0) : Number(s.commission_amount);
      return a + mine + Number(s.shipping_charged) - Number(s.shipping_cost) - Number(s.platform_fees);
    }, 0);

  const mySales = staff ? sales : sales.filter((s) => s.items?.owner_id === profile.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{staff ? "Money" : "Payouts"}</h1>
        {staff && <a href="/api/export?what=sales" className="btn btn-secondary">⬇ CSV</a>}
      </div>

      {staff && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3"><p className="label">This month sold</p><p className="text-xl font-bold">{money(gross(thisMonth))}</p><p className="text-xs muted">{thisMonth.length} sales</p></div>
          <div className="card p-3"><p className="label">This month your take</p><p className="text-xl font-bold">{money(profit(thisMonth))}</p><p className="text-xs muted">after cost, fees, shipping</p></div>
          <div className="card p-3"><p className="label">All time sold</p><p className="text-xl font-bold">{money(gross(sales))}</p></div>
          <div className="card p-3"><p className="label">Owed to consignors</p><p className="text-xl font-bold">{money([...balances.values()].reduce((a, b) => a + b.due, 0))}</p></div>
        </div>
      )}

      {staff && balances.size > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Consignor balances</h2>
          {[...balances.entries()].map(([ownerId, b]) => (
            <div key={ownerId} className="card p-3 flex items-center justify-between gap-2">
              <div><p className="font-semibold">{b.name}</p><p className="text-sm muted">{b.saleIds.length} unpaid sale{b.saleIds.length === 1 ? "" : "s"}</p></div>
              <div className="text-right"><p className="font-bold">{money(b.due)}</p><PayoutButton consignorId={ownerId} amount={b.due} saleIds={b.saleIds} /></div>
            </div>
          ))}
        </section>
      )}

      {!staff && (
        <div className="card p-3">
          <p className="label">Owed to you (not yet paid)</p>
          <p className="text-2xl font-bold">{money(mySales.filter((s) => !paidSet.has(s.id)).reduce((a, s) => a + Number(s.consignor_due), 0))}</p>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Sales</h2>
        {!mySales.length && <div className="card p-6 text-center muted text-sm">No sales recorded yet.</div>}
        {mySales.map((s) => (
          <Link key={s.id} href={`/app/items/${s.items?.id}`} className="card p-3 flex justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold truncate">{s.items?.title}</p>
              <p className="muted">{new Date(s.sold_at).toLocaleDateString()} • {s.channel} • {s.payment_method}{staff && s.items?.tier !== "owned" ? ` • ${s.items?.profiles?.business_name || s.items?.profiles?.full_name}` : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold">{money(s.sale_price)}</p>
              {s.items?.tier !== "owned" && <p className="muted">{staff ? `you ${money(s.commission_amount)}` : `you get ${money(s.consignor_due)}`}{paidSet.has(s.id) ? " • paid" : ""}</p>}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
