"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";

interface Auction { id: string; starting_bid: number; reserve_price: number | null; buy_now_price: number | null; current_bid: number | null; current_bidder_id: string | null; starts_at: string; ends_at: string; status: string; extend_minutes: number }

function useCountdown(endsAt: string) {
  const [left, setLeft] = useState(() => new Date(endsAt).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(endsAt).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (left <= 0) return "Ended";
  const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

export default function AuctionPanel({ auction: initial, sku }: { auction: Auction; sku: string }) {
  const supabase = createClient();
  const [a, setA] = useState(initial);
  const [amount, setAmount] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(a.ends_at);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    const ch = supabase.channel(`auction-${a.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${a.id}` }, (p) => setA(p.new as Auction)).subscribe();
    const t = setInterval(async () => { const { data } = await supabase.from("auctions").select("*").eq("id", a.id).single(); if (data) setA(data); }, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id]);

  const live = a.status === "live" && new Date(a.ends_at) > new Date();
  const cur = a.current_bid ?? null;
  const inc = (cur ?? a.starting_bid) < 25 ? 1 : (cur ?? a.starting_bid) < 100 ? 2.5 : (cur ?? a.starting_bid) < 500 ? 5 : 10;
  const minNext = cur == null ? a.starting_bid : cur + inc;
  const winning = userId && a.current_bidder_id === userId;

  async function bid(v: number) {
    if (!userId) { window.location.href = `/login?next=/item/${sku}`; return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("place_bid", { p_auction_id: a.id, p_amount: v });
    setBusy(false);
    if (error) return setMsg(error.message.replace(/^.*?: /, ""));
    setMsg("Bid placed!");
    setAmount("");
  }

  return (
    <div className="card p-4 space-y-3" style={{ borderColor: live ? "var(--accent)" : "var(--line)" }}>
      <div className="flex justify-between items-baseline">
        <p className="font-bold text-lg">{live ? "🔨 Auction" : a.status === "scheduled" ? "Auction starts soon" : "Auction ended"}</p>
        <p className="text-sm font-mono">{live ? left : a.status === "scheduled" ? `starts ${new Date(a.starts_at).toLocaleString()}` : ""}</p>
      </div>
      <div className="flex justify-between">
        <div><p className="label">{cur == null ? "Starting bid" : "Current bid"}</p><p className="text-2xl font-extrabold">{money(cur ?? a.starting_bid)}</p></div>
        {a.buy_now_price && live && <div className="text-right"><p className="label">Buy it now</p><p className="text-xl font-bold">{money(a.buy_now_price)}</p></div>}
      </div>
      {a.reserve_price && cur != null && cur < a.reserve_price && live && <p className="text-xs muted">Reserve not yet met</p>}
      {winning && live && <p className="text-sm font-semibold" style={{ color: "var(--ok)" }}>You&apos;re the high bidder</p>}
      {!live && a.status === "ended" && (winning ? <p className="font-semibold" style={{ color: "var(--ok)" }}>You won! We&apos;ll contact you to arrange payment and pickup.</p> : <p className="muted text-sm">{cur != null ? `Sold for ${money(cur)}` : "No bids"}</p>)}
      {live && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button className="btn btn-accent flex-1" disabled={busy} onClick={() => bid(minNext)}>Bid {money(minNext)}</button>
            {a.buy_now_price && <button className="btn btn-primary" disabled={busy} onClick={() => confirm(`Buy now for ${money(a.buy_now_price)}?`) && bid(a.buy_now_price!)}>Buy now</button>}
          </div>
          <div className="flex gap-2">
            <input className="input" type="number" inputMode="decimal" placeholder={`Custom bid (min ${money(minNext)})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn btn-secondary" disabled={busy || !amount} onClick={() => bid(Number(amount))}>Bid</button>
          </div>
          <p className="text-xs muted">Bids in the last {a.extend_minutes} minutes extend the auction. Winner pays at pickup or by arrangement.</p>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
