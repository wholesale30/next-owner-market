"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";

interface A { id: string; starting_bid: number; reserve_price: number | null; buy_now_price: number | null; current_bid: number | null; starts_at: string; ends_at: string; status: string }

export default function AuctionAdmin({ itemId, price, auction }: { itemId: string; price: number | null; auction: A | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ starting_bid: price ? String(Math.max(1, Math.round(price * 0.3))) : "5", reserve_price: "", buy_now_price: price ? String(price) : "", days: "5" });

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const now = new Date();
    const { error } = await supabase.from("auctions").insert({
      item_id: itemId, starting_bid: Number(f.starting_bid), reserve_price: f.reserve_price ? Number(f.reserve_price) : null,
      buy_now_price: f.buy_now_price ? Number(f.buy_now_price) : null, starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + Number(f.days) * 86400000).toISOString(), status: "live",
    });
    if (!error) await supabase.from("items").update({ sale_type: "auction", status: "active", listed_at: now.toISOString() }).eq("id", itemId);
    setBusy(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  }
  async function cancel() {
    if (!confirm("Cancel this auction and go back to a fixed price?")) return;
    await supabase.from("auctions").update({ status: "cancelled" }).eq("id", auction!.id);
    await supabase.from("items").update({ sale_type: "fixed" }).eq("id", itemId);
    router.refresh();
  }

  if (auction && auction.status !== "cancelled") {
    return (
      <div className="card p-3 text-sm flex justify-between items-center">
        <div>
          <p className="font-semibold">🔨 Auction {auction.status}</p>
          <p className="muted">{auction.current_bid != null ? `High bid ${money(auction.current_bid)}` : `No bids yet (starts ${money(auction.starting_bid)})`} • ends {new Date(auction.ends_at).toLocaleString()}</p>
        </div>
        {auction.status === "live" && <button className="pill" onClick={cancel}>Cancel</button>}
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button className="btn btn-secondary w-full" onClick={() => setOpen(true)}>🔨 Start an auction</button>
      ) : (
        <form onSubmit={start} className="card p-3 space-y-2 text-sm">
          <p className="font-semibold">Auction settings</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Starting bid $</label><input className="input" type="number" inputMode="decimal" value={f.starting_bid} onChange={(e) => setF({ ...f, starting_bid: e.target.value })} required /></div>
            <div><label className="label">Days</label><select className="input" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })}>{["1", "3", "5", "7", "10"].map((d) => <option key={d}>{d}</option>)}</select></div>
            <div><label className="label">Reserve $ (optional)</label><input className="input" type="number" inputMode="decimal" value={f.reserve_price} onChange={(e) => setF({ ...f, reserve_price: e.target.value })} /></div>
            <div><label className="label">Buy now $ (optional)</label><input className="input" type="number" inputMode="decimal" value={f.buy_now_price} onChange={(e) => setF({ ...f, buy_now_price: e.target.value })} /></div>
          </div>
          <p className="text-xs muted">Bids in the last 2 minutes extend it 2 minutes. Buyers need a free account to bid. You collect payment at pickup for now.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-accent flex-1" disabled={busy}>Start</button>
          </div>
        </form>
      )}
    </div>
  );
}
