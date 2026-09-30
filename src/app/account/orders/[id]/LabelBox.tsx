"use client";

import { useState } from "react";
import { money } from "@/lib/listing";

export default function LabelBox({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [box, setBox] = useState("medium");
  const [weight, setWeight] = useState("");
  const [rates, setRates] = useState<{ id: string; amount: number; provider: string; service: string; days: number | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function fetchRates() {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/orders/label?orderId=${orderId}&box=${box}&weight=${weight || 0}`);
    const j = (await r.json()) as { rates?: typeof rates; error?: string };
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Couldn't get rates");
    setRates(j.rates || []);
  }
  async function buy(rateId: string, amount: number) {
    if (!confirm(`Buy this label for ${money(amount)}? It comes out of your payout.`)) return;
    setBusy(true); setErr(null);
    const r = await fetch("/api/orders/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, rateId, amount }) });
    const j = (await r.json()) as { error?: string };
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Couldn't buy label");
    onDone();
  }
  return (
    <div className="card p-3 space-y-2">
      <p className="font-semibold">Buy a shipping label here (cheapest rates, prints 4×6)</p>
      <div className="flex gap-2">
        <select className="input" value={box} onChange={(e) => setBox(e.target.value)}><option value="small">Small box (10×8×4)</option><option value="medium">Medium (14×12×8)</option><option value="large">Large (20×16×12)</option><option value="xl">XL (24×20×16)</option></select>
        <input className="input w-28" type="number" inputMode="decimal" placeholder="Weight lb" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <button className="btn btn-secondary" disabled={busy} onClick={fetchRates}>Get rates</button>
      </div>
      {rates && rates.map((r) => (
        <button key={r.id} className="card p-2 w-full flex justify-between text-left" disabled={busy} onClick={() => buy(r.id, r.amount)}>
          <span>{r.provider} {r.service}{r.days ? ` • ~${r.days} days` : ""}</span><b>{money(r.amount)}</b>
        </button>
      ))}
      {rates && !rates.length && <p className="muted">No rates came back; check the weight and try again.</p>}
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <p className="text-[11px] muted">Or ship it yourself and type the tracking number below.</p>
    </div>
  );
}
