"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Consignor payout onboarding (Stripe Express). */
export default function PayoutSetup({ ready, hasAccount, address }: { ready: boolean; hasAccount: boolean; address?: { address1: string; address2: string; city: string; state: string; zip: string } }) {
  const [addr, setAddr] = useState(address || { address1: "", address2: "", city: "", state: "", zip: "" });
  const [saved, setSaved] = useState<string | null>(null);
  async function saveAddr() {
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from("profiles").update({ address1: addr.address1 || null, address2: addr.address2 || null, city: addr.city || null, state: addr.state || null, zip: addr.zip || null }).eq("id", user.id);
    if (!error) fetch("/api/geo/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    setSaved(error ? error.message : "Saved.");
  }
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (params.get("stripe") === "return") fetch("/api/stripe/connect").then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function go() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/stripe/connect", { method: "POST" });
    const j = (await r.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!r.ok || !j.url) return setErr(j.error || "Not available yet");
    window.location.assign(j.url);
  }
  const addrForm = (
    <div className="card p-3 space-y-2 text-sm">
      <p className="font-semibold">Ship-from address <span className="muted font-normal">(for printing labels; buyers never see it)</span></p>
      <input className="input" placeholder="Street" value={addr.address1} onChange={(e) => setAddr({ ...addr, address1: e.target.value })} />
      <div className="grid grid-cols-4 gap-2">
        <input className="input col-span-2" placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
        <input className="input" placeholder="ST" maxLength={2} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })} />
        <input className="input" placeholder="ZIP" maxLength={5} value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} />
      </div>
      <div className="flex items-center gap-2"><button className="btn btn-secondary" onClick={saveAddr}>Save address</button>{saved && <span className="muted">{saved}</span>}</div>
    </div>
  );
  if (ready) return <>{<div className="card p-3 text-sm">✅ Payouts are set up. When a buyer picks up or receives your item, your share goes to your bank in about 2 business days.</div>}{addrForm}</>;
  return (
    <div className="card p-4 space-y-2" style={{ borderColor: "var(--accent)" }}>
      <p className="font-bold">Get paid: set up payouts (2 minutes)</p>
      <p className="text-sm muted">Buyers pay by card in the app. The money is held until hand-off, then lands in your bank. You&apos;ll enter your name, address, and bank account with Stripe; we never see them. Until this is done, your items show without a Buy button.</p>
      <button className="btn btn-primary w-full" disabled={busy} onClick={go}>{busy ? "One sec…" : hasAccount ? "Finish payout setup" : "Set up payouts"}</button>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
