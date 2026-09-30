"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/listing";

export default function BuyButton({ itemId, sku, price, canPickup, canShip, shippingPrice, sellerReady, signedIn, pickupLoc }: { itemId: string; sku: string; price: number; canPickup: boolean; canShip: boolean; shippingPrice: number; sellerReady: boolean; signedIn: boolean; pickupLoc?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"pickup" | "ship">(canPickup ? "pickup" : "ship");
  if (!sellerReady) return null;

  async function buy() {
    if (!signedIn) { router.push(`/signup?buyer=1&next=/item/${sku}`); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, fulfillment: mode }) });
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
          <button type="button" className={`pill px-3 py-2 ${mode === "ship" ? "pill-active" : ""}`} onClick={() => setMode("ship")}>Ship • {money(price + shippingPrice)}</button>
        </div>
      )}
      <button type="button" className="btn btn-primary w-full text-lg" disabled={busy} onClick={buy}>{busy ? "One sec…" : `🛒 Buy now • ${money(mode === "ship" ? price + shippingPrice : price)}`}</button>
      {mode === "pickup" && !canShip && pickupLoc && <p className="text-xs">📍 Local pickup only, in <b>{pickupLoc}</b>. Not near you? Message the seller and ask about shipping.</p>}
      <p className="text-[11px] muted">Pay by card, Apple Pay, or Google Pay. Your money is held until you {mode === "ship" ? "receive it" : "pick it up"}; full refund if it doesn&apos;t happen.</p>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
