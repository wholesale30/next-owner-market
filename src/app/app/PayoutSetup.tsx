"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Consignor payout onboarding (Stripe Express). */
export default function PayoutSetup({ ready, hasAccount }: { ready: boolean; hasAccount: boolean }) {
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
  if (ready) return <div className="card p-3 text-sm">✅ Payouts are set up. When a buyer picks up or receives your item, your share goes to your bank in about 2 business days.</div>;
  return (
    <div className="card p-4 space-y-2" style={{ borderColor: "var(--accent)" }}>
      <p className="font-bold">Get paid: set up payouts (2 minutes)</p>
      <p className="text-sm muted">Buyers pay by card in the app. The money is held until hand-off, then lands in your bank. You&apos;ll enter your name, address, and bank account with Stripe; we never see them. Until this is done, your items show without a Buy button.</p>
      <button className="btn btn-primary w-full" disabled={busy} onClick={go}>{busy ? "One sec…" : hasAccount ? "Finish payout setup" : "Set up payouts"}</button>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
