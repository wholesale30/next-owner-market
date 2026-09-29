import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function GET(req: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) return new NextResponse("Forbidden", { status: 403 });
  const what = new URL(req.url).searchParams.get("what") || "sales";
  const supabase = await createClient();

  let rows: Record<string, unknown>[] = [];
  if (what === "sales") {
    const { data } = await supabase.from("sales").select("sold_at, sale_price, shipping_charged, shipping_cost, platform_fees, commission_pct, commission_amount, consignor_due, channel, payment_method, buyer_name, notes, items(sku, title, cost, tier, profiles!items_owner_id_fkey(full_name, business_name))").order("sold_at");
    rows = (data || []).map((s) => {
      const it = s.items as unknown as { sku: string; title: string; cost: number; tier: string; profiles: { full_name: string; business_name: string } | null } | null;
      return {
        date: s.sold_at, sku: it?.sku, title: it?.title, tier: it?.tier, consignor: it?.profiles?.business_name || it?.profiles?.full_name || "",
        sale_price: s.sale_price, cost: it?.cost, shipping_charged: s.shipping_charged, shipping_cost: s.shipping_cost, platform_fees: s.platform_fees,
        commission_pct: s.commission_pct, commission_amount: s.commission_amount, consignor_due: s.consignor_due, channel: s.channel, payment_method: s.payment_method, buyer: s.buyer_name, notes: s.notes,
      };
    });
  } else if (what === "subscribers") {
    const { data } = await supabase.from("subscribers").select("name, email, phone, source, interests, created_at, last_seen_at").eq("unsubscribed", false).order("created_at");
    rows = (data || []).map((r) => ({ ...r, interests: (r.interests || []).join(" ") }));
  } else {
    const { data } = await supabase.from("items").select("sku, title, status, price, cost, quantity, tier, condition, brand, model, created_at, listed_at, sold_at, categories(name), locations(code)").order("created_at");
    rows = (data || []).map((i) => ({ ...i, category: (i.categories as unknown as { name: string } | null)?.name, location: (i.locations as unknown as { code: string } | null)?.code, categories: undefined, locations: undefined }));
  }

  return new NextResponse(csv(rows), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${what}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
