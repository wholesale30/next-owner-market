"use client";

import { useState } from "react";

/** One tap to checkout for a plan or a pack. Signed out: make a free account first, then come back here. */
export default function PlanButton({ plan, pack, label, primary }: { plan?: "pro" | "power" | "thrift"; pack?: 100 | 300; label: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    const r = await fetch(pack ? "/api/stripe/topup" : "/api/stripe/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pack ? { pack, back: "/pro" } : { plan, back: "/app" }) });
    if (r.status === 401) { window.location.assign("/signup?next=/pro%23plans"); return; }
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!j.url) { setBusy(false); return setErr(j.error || "Not available right now."); }
    window.location.assign(j.url);
  }
  return (
    <>
      <button type="button" className={`btn ${primary ? "btn-primary" : "btn-secondary"} w-full`} style={{ minHeight: 48 }} disabled={busy} onClick={go}>{busy ? "One sec…" : label}</button>
      {err && <p className="text-xs text-center" style={{ color: "var(--danger)" }}>{err}</p>}
    </>
  );
}
