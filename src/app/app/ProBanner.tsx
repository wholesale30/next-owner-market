"use client";

import { useState } from "react";

/** Shown to non-Pro sellers. One tap → Stripe subscription checkout. */
export default function ProBanner({ credits, price, features, compact }: { credits: number; price: number; features: string[]; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/stripe/subscribe", { method: "POST" });
    const j = (await r.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!r.ok || !j.url) return setErr(j.error || "Not available yet");
    window.location.assign(j.url);
  }
  if (compact) return (
    <div className="card p-3 text-sm flex items-center justify-between gap-2" style={{ borderColor: "var(--accent)" }}>
      <span>{credits > 0 ? `${credits} free AI listing${credits === 1 ? "" : "s"} left.` : "Free AI listings used up."} Pro is ${price}/mo.</span>
      <button className="btn btn-primary" disabled={busy} onClick={go}>Go Pro</button>
      {err && <span className="muted">{err}</span>}
    </div>
  );
  return (
    <div className="card p-4 space-y-2" style={{ borderColor: "var(--accent)" }}>
      <p className="font-bold text-lg">Next Owner Pro • ${price}/month</p>
      <ul className="text-sm space-y-1">{features.map((f) => <li key={f}>✔ {f}</li>)}</ul>
      <p className="text-xs muted">You have {credits} free AI listing{credits === 1 ? "" : "s"} left. Cancel any time.</p>
      <button className="btn btn-primary w-full" disabled={busy} onClick={go}>{busy ? "One sec…" : "Upgrade to Pro"}</button>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
