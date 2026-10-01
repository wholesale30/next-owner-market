"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItemStatus, Tier, Channel } from "@/lib/types";

interface Props {
  item: { id: string; sku: string; status: ItemStatus; price: number | null; tier: Tier };
  staff: boolean;
  commissionPct: number;
}

const CHANNELS: { v: Channel; l: string }[] = [
  { v: "facebook", l: "Facebook" },
  { v: "in_person", l: "In person / walk-in" },
  { v: "storefront", l: "Our website" },
  { v: "offerup", l: "OfferUp" },
  { v: "ebay", l: "eBay" },
  { v: "craigslist", l: "Craigslist" },
  { v: "other", l: "Other" },
];

export default function ItemActions({ item, staff, commissionPct }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [selling, setSelling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sale, setSale] = useState({
    sale_price: item.price != null ? String(item.price) : "",
    channel: "facebook" as Channel,
    buyer_name: "",
    buyer_contact: "",
    payment_method: "cash",
    shipping_charged: "",
    platform_fees: "",
    notes: "",
  });

  async function setStatus(status: ItemStatus) {
    setBusy(true);
    setErr(null);
    const patch: Record<string, unknown> = { status };
    if (status === "active") patch.listed_at = new Date().toISOString();
    const { error } = await supabase.from("items").update(patch).eq("id", item.id);
    setBusy(false);
    if (error) return setErr(error.message);
    if (status === "active") { fetch("/api/notify/flush", { method: "POST" }).catch(() => {}); fetch("/api/indexnow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: [`/item/${item.sku}`] }) }).catch(() => {}); }
    router.refresh();
  }

  async function recordSale() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("sales").insert({
      item_id: item.id,
      channel: sale.channel,
      sale_price: Number(sale.sale_price),
      buyer_name: sale.buyer_name || null,
      buyer_contact: sale.buyer_contact || null,
      payment_method: sale.payment_method,
      shipping_charged: Number(sale.shipping_charged) || 0,
      platform_fees: Number(sale.platform_fees) || 0,
      commission_pct: item.tier === "owned" ? 0 : commissionPct,
      notes: sale.notes || null,
    });
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    await supabase.from("items").update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", item.id);
    await supabase.from("listings").update({ removed_at: new Date().toISOString() }).eq("item_id", item.id).is("removed_at", null);
    setBusy(false);
    setSelling(false);
    router.refresh();
  }

  async function deleteItem() {
    if (!confirm("Delete this item? It goes to 🗑 Deleted, where it can be brought back. (Anything that sold is archived instead.)")) return;
    setBusy(true); setErr(null);
    const { data: paths, error } = await supabase.rpc("delete_item", { p_item: item.id });
    if (error) { setBusy(false); return setErr(error.message); }
    void paths; // kept for restore
    router.push("/app");
    router.refresh();
  }
  const deletable = !["sold", "shipped"].includes(item.status);

  if (!staff) {
    return (
      <div className="space-y-2">
        <div className="card p-3 text-sm muted">
          {item.status === "pending_review" && "Waiting for our review. We'll list it once approved."}
          {item.status === "draft" && "Draft. Open Edit and tap Submit for review when it's ready."}
          {item.status === "active" && "Live in the store."}
          {item.status === "sold" && "Sold. Your payout shows under Payouts."}
        </div>
        {deletable && <button className="pill" disabled={busy} onClick={deleteItem}>🗑 Delete this item</button>}
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 no-print">
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="flex flex-wrap gap-2">
        {(item.status === "draft" || item.status === "pending_review") && (
          <button className="btn btn-primary flex-1" disabled={busy} onClick={() => setStatus("active")}>✅ Approve &amp; list</button>
        )}
        {item.status === "active" && (
          <>
            <button className="btn btn-accent flex-1" disabled={busy} onClick={() => setSelling(true)}>💰 Mark sold</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus("reserved")}>Hold</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus("draft")}>Unlist</button>
          </>
        )}
        {item.status === "reserved" && (
          <>
            <button className="btn btn-accent flex-1" disabled={busy} onClick={() => setSelling(true)}>💰 Mark sold</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus("active")}>Release hold</button>
          </>
        )}
        {item.status === "sold" && (
          <>
            <button className="btn btn-secondary flex-1" disabled={busy} onClick={() => setStatus("shipped")}>📦 Mark shipped</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus("active")}>Undo sale (relist)</button>
          </>
        )}
        {item.status !== "archived" && item.status !== "sold" && item.status !== "shipped" && (
          <button className="btn btn-secondary" disabled={busy} onClick={() => { if (confirm("Archive this item? It disappears from lists but keeps its history.")) setStatus("archived"); }}>Archive</button>
        )}
        {deletable && (
          <button className="btn btn-secondary" disabled={busy} onClick={deleteItem}>🗑 Delete</button>
        )}
      </div>

      {selling && (
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold">Record the sale</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Sold for $</label><input className="input" type="number" inputMode="decimal" step="0.01" value={sale.sale_price} onChange={(e) => setSale({ ...sale, sale_price: e.target.value })} /></div>
            <div><label className="label">Where</label>
              <select className="input" value={sale.channel} onChange={(e) => setSale({ ...sale, channel: e.target.value as Channel })}>
                {CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div><label className="label">Paid by</label>
              <select className="input" value={sale.payment_method} onChange={(e) => setSale({ ...sale, payment_method: e.target.value })}>
                {["cash", "zelle", "venmo", "cashapp", "paypal", "card", "check", "platform"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="label">Buyer name</label><input className="input" value={sale.buyer_name} onChange={(e) => setSale({ ...sale, buyer_name: e.target.value })} /></div>
            <div><label className="label">Buyer phone/email</label><input className="input" value={sale.buyer_contact} onChange={(e) => setSale({ ...sale, buyer_contact: e.target.value })} /></div>
            <div><label className="label">Shipping charged $</label><input className="input" type="number" inputMode="decimal" value={sale.shipping_charged} onChange={(e) => setSale({ ...sale, shipping_charged: e.target.value })} /></div>
            <div><label className="label">Platform fees $</label><input className="input" type="number" inputMode="decimal" value={sale.platform_fees} onChange={(e) => setSale({ ...sale, platform_fees: e.target.value })} /></div>
          </div>
          {item.tier !== "owned" && sale.sale_price && (
            <p className="text-sm muted">Commission {commissionPct}% = ${(Number(sale.sale_price) * commissionPct / 100).toFixed(2)} • consignor gets ${(Number(sale.sale_price) * (100 - commissionPct) / 100).toFixed(2)} (on sale price only, not shipping)</p>
          )}
          <input className="input" placeholder="Notes" value={sale.notes} onChange={(e) => setSale({ ...sale, notes: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => setSelling(false)}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={busy || !sale.sale_price} onClick={recordSale}>{busy ? "Saving…" : "Save sale"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
