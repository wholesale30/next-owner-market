"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";

export default function OfferButton({ itemId, sku, price, canPickup, canShip, signedIn, existing }: { itemId: string; sku: string; price: number; canPickup: boolean; canShip: boolean; signedIn: boolean; existing: { id: string; amount: number; counter_amount: number | null; status: string; expires_at: string } | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"pickup" | "ship">(canPickup ? "pickup" : "ship");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function notify(id: string, event: string) { await fetch("/api/offers/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: id, event }) }).catch(() => {}); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { data: id, error } = await supabase.rpc("make_offer", { p_item: itemId, p_amount: Number(amount), p_fulfillment: mode, p_message: msg || null });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    await notify(id as string, "new");
    router.refresh();
  }
  async function buyerAct(action: "accept_counter" | "withdraw") {
    if (!existing) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("buyer_offer", { p_offer: existing.id, p_action: action });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    if (action === "accept_counter") await notify(existing.id, "counter_accepted");
    router.refresh();
  }
  async function buyAtOffer() {
    if (!existing) return;
    setBusy(true); setErr(null);
    const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, fulfillment: mode, offerId: existing.id }) });
    const j = (await r.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!r.ok || !j.url) return setErr(j.error || "Couldn't start checkout.");
    window.location.assign(j.url);
  }

  if (existing) {
    const live = new Date(existing.expires_at) > new Date();
    return (
      <div className="card p-3 space-y-2 text-sm">
        {existing.status === "pending" && <p>Your offer of <b>{money(existing.amount)}</b> is with the seller. {live ? `Expires ${new Date(existing.expires_at).toLocaleString([], { weekday: "short", hour: "numeric" })}.` : "Expired."}</p>}
        {existing.status === "countered" && live && <p>Seller countered at <b>{money(existing.counter_amount || 0)}</b>.</p>}
        {existing.status === "accepted" && live && <p>✅ Offer accepted at <b>{money(existing.amount)}</b>. Buy it now at that price.</p>}
        <div className="flex gap-2">
          {existing.status === "accepted" && live && <button className="btn btn-primary flex-1" disabled={busy} onClick={buyAtOffer}>🛒 Buy for {money(existing.amount)}</button>}
          {existing.status === "countered" && live && <button className="btn btn-primary flex-1" disabled={busy} onClick={() => buyerAct("accept_counter")}>Accept {money(existing.counter_amount || 0)}</button>}
          {(existing.status === "pending" || existing.status === "countered") && <button className="btn btn-secondary" disabled={busy} onClick={() => buyerAct("withdraw")}>Withdraw</button>}
        </div>
        {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      </div>
    );
  }

  if (!open) return <button className="btn btn-secondary w-full" onClick={() => (signedIn ? setOpen(true) : router.push(`/signup?buyer=1&next=/item/${sku}`))}>💸 Make an offer</button>;
  return (
    <form onSubmit={submit} className="card p-3 space-y-2 text-sm">
      <p className="font-semibold">Your offer (asking {money(price)})</p>
      <div className="flex gap-2">
        <input className="input" type="number" inputMode="decimal" min={Math.ceil(price * 0.5)} max={price - 0.01} step="1" placeholder={`${Math.round(price * 0.8)}`} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        {canPickup && canShip && <select className="input" value={mode} onChange={(e) => setMode(e.target.value as "pickup" | "ship")}><option value="pickup">Pickup</option><option value="ship">Ship</option></select>}
      </div>
      <input className="input" placeholder="Optional note to the seller" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <p className="text-[11px] muted">If accepted, you have 48 hours to pay at that price. Offers under half the asking price aren&apos;t sent.</p>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Sending…" : "Send offer"}</button></div>
    </form>
  );
}
