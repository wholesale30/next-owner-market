"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StripeSetup({ ready, configured, connect }: { ready: boolean; configured: boolean; connect: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/stripe/setup", { method: "POST" });
    const j = (await r.json()) as { error?: string; connect_enabled?: boolean };
    setBusy(false);
    setMsg(r.ok ? (j.connect_enabled ? "Stripe is fully set up." : "Card checkout works. To let other sellers get paid, open Stripe → Connect → Get started, then tap this again.") : j.error || "Failed");
    router.refresh();
  }
  return (
    <div className="card p-3 text-sm space-y-2">
      <p className="font-semibold">Payments (admin)</p>
      {!ready && <p className="muted">Stripe key not added yet. Once it is, tap Set up.</p>}
      {ready && <p className="muted">Key: ✅ • Webhook & Pro price: {configured ? "✅" : "not yet"} • Sellers can get paid (Connect): {connect ? "✅" : "not yet"}</p>}
      <button className="btn btn-secondary" disabled={!ready || busy} onClick={go}>{busy ? "Setting up…" : configured ? "Re-check Stripe" : "Set up Stripe"}</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
