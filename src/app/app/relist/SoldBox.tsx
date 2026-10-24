"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 💰 Sold, right on the Relist list (owner, Oct 24, 2026): price, who bought it (pick from people who messaged
 * about this item in the app, or type a Facebook name), how they paid. Records a sale (channel Facebook), marks the
 * item sold, and can have Claude in Chrome take the ad off Facebook.
 */
type Buyer = { name: string; contact: string };

export default function SoldBox({ id, price, buyers, onDone }: { id: string; price: number | null; buyers: Buyer[]; onDone: (sold: { price: number; buyer: string }) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ price: price ? String(Math.round(Number(price))) : "", buyer: "", contact: "", pay: "cash", offFb: true });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const raw = v.price.replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) { setMsg(`⚠ "${v.price}" isn't a price. Type just the number.`); return; }
    setBusy(true);
    const p = Math.round(Number(raw));
    const { error } = await supabase.from("sales").insert({ item_id: id, channel: "facebook", sale_price: p, buyer_name: v.buyer.trim() || null, buyer_contact: v.contact.trim() || null, payment_method: v.pay, commission_pct: 0, notes: "Sold from the Relist list" });
    if (error) { setBusy(false); setMsg(`⚠ Couldn't record the sale: ${error.message}`); return; }
    const now = new Date().toISOString();
    const { error: e2 } = await supabase.from("items").update({ status: "sold", sold_at: now, fb_pick: null, ...(v.offFb ? { fb_remove: true, fb_removed_at: null } : {}) }).eq("id", id);
    setBusy(false);
    if (e2) { setMsg(`⚠ Sale saved, but the item couldn't be marked sold: ${e2.message}`); return; }
    onDone({ price: p, buyer: v.buyer.trim() });
  }

  if (!open) return <button type="button" className="pill" onClick={() => setOpen(true)}>💰 Sold</button>;
  return (
    <div className="card p-2 space-y-2 w-full">
      <label className="block text-sm font-semibold">Sold for<input className="input" inputMode="numeric" value={v.price} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, price: e.target.value })} /></label>
      {buyers.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">Who bought it? (people who messaged about it)</p>
          <div className="flex flex-wrap gap-1">
            {buyers.map((b) => (
              <button key={b.name + b.contact} type="button" className={`pill ${v.buyer === b.name ? "font-bold" : ""}`} style={v.buyer === b.name ? { borderColor: "var(--brand)" } : {}} onClick={() => setV({ ...v, buyer: b.name, contact: b.contact })}>{b.name || b.contact}</button>
            ))}
          </div>
        </div>
      )}
      <label className="block text-sm font-semibold">Buyer&apos;s name (Facebook name is fine)<input className="input" value={v.buyer} onChange={(e) => setV({ ...v, buyer: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Phone or email (optional)<input className="input" value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} /></label>
      <div className="grid grid-cols-4 gap-1">
        {["cash", "card", "venmo", "other"].map((m) => <button key={m} type="button" className={`pill ${v.pay === m ? "font-bold" : ""}`} style={v.pay === m ? { borderColor: "var(--brand)" } : {}} onClick={() => setV({ ...v, pay: m })}>{m[0].toUpperCase() + m.slice(1)}</button>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.offFb} onChange={(e) => setV({ ...v, offFb: e.target.checked })} /> Take the ad off Facebook (Claude in Chrome does it next run)</label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "💰 Mark sold"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
