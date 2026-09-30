"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { money } from "@/lib/listing";

export default function BuyButton({ itemId, sku, price, canPickup, canShip, shippingPrice, sellerReady, signedIn, pickupLoc, buyerZip, shippingMode }: { itemId: string; sku: string; price: number; canPickup: boolean; canShip: boolean; shippingPrice: number; sellerReady: boolean; signedIn: boolean; pickupLoc?: string; buyerZip?: string | null; shippingMode?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"pickup" | "ship">(canPickup ? "pickup" : "ship");
  const [zip, setZip] = useState(buyerZip || "");
  const [quote, setQuote] = useState<{ amount: number; service: string; mode: string; rateId?: string | null; options?: { amount: number; service: string; rateId: string; days: number | null }[] } | null>(null);
  const [rateId, setRateId] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  useEffect(() => {
    if (!canShip) return;
    if (shippingMode === "calculated" && zip.length !== 5) return;
    let live = true;
    const t = setTimeout(() => {
      setQuoting(true);
      fetch(`/api/shipping/quote?itemId=${itemId}&zip=${zip}`).then((r) => r.json()).then((j) => { if (live) setQuote(j.error ? null : j); }).catch(() => live && setQuote(null)).finally(() => live && setQuoting(false));
    }, 0);
    return () => { live = false; clearTimeout(t); };
  }, [zip, itemId, canShip, shippingMode]);
  const chosen = quote?.options?.find((o) => o.rateId === rateId) || (quote?.options?.[0] ?? null);
  const shipCost = chosen ? chosen.amount : quote ? quote.amount : shippingPrice;
  if (!sellerReady) return null;

  async function buy() {
    if (!signedIn) { router.push(`/signup?buyer=1&next=/item/${sku}`); return; }
    setBusy(true); setErr(null);
    if (mode === "ship" && shippingMode === "calculated" && zip.length !== 5) { setBusy(false); return setErr("Enter your ZIP for the shipping price."); }
    const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, fulfillment: mode, zip, rateId: chosen?.rateId || null }) });
    const j = (await r.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!r.ok || !j.url) return setErr(j.error || "Couldn't start checkout.");
    window.location.assign(j.url);
  }

  return (
    <div className="card p-3 space-y-2">
      {canPickup && canShip && (
        <div className="flex gap-1">
          <button type="button" className={`pill px-3 py-2 ${mode === "pickup" ? "pill-active" : ""}`} onClick={() => setMode("pickup")}>Pickup{pickupLoc ? ` in ${pickupLoc}` : ""} • {money(price)}</button>
          <button type="button" className={`pill px-3 py-2 ${mode === "ship" ? "pill-active" : ""}`} onClick={() => setMode("ship")}>Ship{quote || shippingMode !== "calculated" ? ` • ${money(price + shipCost)}` : ""}</button>
        </div>
      )}
      {canShip && mode !== "ship" && (zip.length === 5 ? (quote ? <p className="text-sm">🚚 Ships to {zip} from <b>{money(quote.options?.[0]?.amount ?? quote.amount)}</b>{quote.options && quote.options.length > 1 ? ` (${quote.options.length} speeds; pick at checkout)` : ` (${quote.service})`}</p> : quoting ? <p className="text-sm muted">Getting shipping rate…</p> : null) : shippingMode !== "calculated" ? <p className="text-sm">🚚 Ships for <b>{money(shippingPrice)}</b></p> : <div className="flex items-center gap-2 text-sm"><span>🚚 Ships.</span><input className="input w-28" inputMode="numeric" maxLength={5} placeholder="ZIP for rate" value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, "")); setQuote(null); }} /></div>)}
      {mode === "ship" && (
        <div className="flex items-center gap-2 text-sm">
          <input className="input w-28" inputMode="numeric" maxLength={5} placeholder="Your ZIP" value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, "")); setQuote(null); }} />
          <span className="muted">{quoting ? "Getting rates…" : quote ? (quote.options?.length ? "" : `${quote.service}: ${money(quote.amount)}`) : shippingMode === "calculated" ? "Enter ZIP for exact shipping" : `Shipping ${money(shippingPrice)}`}</span>
        </div>
      )}
      {mode === "ship" && quote?.options && quote.options.length > 0 && (
        <div className="space-y-1">
          {quote.options.map((o) => (
            <label key={o.rateId} className="card p-2 flex items-center justify-between text-sm cursor-pointer" style={(chosen?.rateId === o.rateId) ? { borderColor: "var(--brand)" } : undefined}>
              <span className="flex items-center gap-2"><input type="radio" name="rate" checked={chosen?.rateId === o.rateId} onChange={() => setRateId(o.rateId)} />{o.service}{o.days ? ` · ~${o.days} day${o.days === 1 ? "" : "s"}` : ""}</span>
              <b>{money(o.amount)}</b>
            </label>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary w-full text-lg" disabled={busy || (mode === "ship" && quoting)} onClick={buy}>{busy ? "One sec…" : `🛒 Buy now • ${money(mode === "ship" ? price + shipCost : price)}`}</button>
      {mode === "pickup" && !canShip && pickupLoc && <p className="text-xs">📍 Local pickup only, in <b>{pickupLoc}</b>. Not near you? Message the seller and ask about shipping.</p>}
      <p className="text-[11px] muted">Pay by card, Apple Pay, or Google Pay. Your money is held until you {mode === "ship" ? "receive it" : "pick it up"}; full refund if it doesn&apos;t happen. By buying you agree to the <a href="/terms" className="underline">terms</a>.</p>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
