"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Shown when someone runs out of AI uses. One obvious next step: add 100 more (one tap to checkout).
 * Bigger options sit in one quiet line underneath.
 */
export default function OutOfUses({ message, back, thrift }: { message: string; back: string; thrift?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(url: string, body: Record<string, unknown>, label: string) {
    setBusy(label); setErr(null);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, back }) });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string; signup?: boolean };
    if (j.signup) { window.location.assign(`/signup?buyer=1&next=${encodeURIComponent(back)}`); return; }
    if (!r.ok || !j.url) { setBusy(null); return setErr(j.error || "That isn't available right now."); }
    window.location.assign(j.url);
  }
  return (
    <div className="card p-4 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
      <p className="font-semibold">{message}</p>
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 52 }} disabled={!!busy} onClick={() => go("/api/stripe/topup", { pack: 100 }, "100")}>{busy === "100" ? "One sec…" : "➕ Add 100 AI uses: $6.99"}</button>
      <p className="text-xs muted text-center">They never expire. One payment, nothing monthly.</p>
      {thrift && <button type="button" className="btn btn-secondary w-full" disabled={!!busy} onClick={() => go("/api/stripe/subscribe", { plan: "thrift" }, "thrift")}>{busy === "thrift" ? "One sec…" : "Thrift Pro: 30 checks a day, $3.99/month"}</button>}
      <p className="text-xs text-center">
        <button type="button" className="underline" disabled={!!busy} onClick={() => go("/api/stripe/topup", { pack: 300 }, "300")}>300 for $14.99</button>
        {" · "}<Link href="/pro#plans" className="underline">See plans</Link>
      </p>
      {err && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
