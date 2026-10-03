"use client";

import { useState } from "react";
import Link from "next/link";
import type { Allowance } from "@/lib/usage";

/**
 * "214 of 300 AI uses this month." Shown as progress, not a wall.
 * At 80% it turns gold and offers more, before they hit the end.
 */
export default function UsesMeter({ a, back = "/app" }: { a: Allowance; back?: string }) {
  const [busy, setBusy] = useState(false);
  if (a.kind === "staff" || a.kind === "comped") return null;
  async function topUp() {
    setBusy(true);
    const r = await fetch("/api/stripe/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pack: 100, back }) });
    const j = (await r.json().catch(() => ({}))) as { url?: string };
    if (j.url) window.location.assign(j.url); else setBusy(false);
  }
  if (a.kind === "free") {
    return (
      <div className="card p-3 text-sm flex items-center justify-between gap-2">
        <span>{a.left ? <><b>{a.left}</b> free AI use{a.left === 1 ? "" : "s"} left</> : "Free AI uses used up"}</span>
        <Link href="/pro#plans" className="btn btn-secondary">{a.left ? "Plans" : "Get more"}</Link>
      </div>
    );
  }
  const allow = a.allow || 1;
  const pct = Math.min(100, Math.round((a.used / allow) * 100));
  const near = pct >= 80;
  const label = a.kind === "thrift" ? "checks today" : "AI uses this month";
  return (
    <div className="card p-3 space-y-2 text-sm" style={near ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
      <div className="flex items-baseline justify-between gap-2">
        <span><b>{a.used}</b> of {allow} {label}</span>
        {a.extra > 0 && <span className="muted">+{a.extra} extra</span>}
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--line)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: near ? "var(--accent)" : "var(--ok)" }} />
      </div>
      {near ? (
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={topUp}>{busy ? "One sec…" : "➕ Add 100 more: $6.99 (never expire)"}</button>
      ) : (
        <p className="text-xs muted">{a.kind === "thrift" ? "Resets at midnight." : "Resets on the 1st. Most people use about half."}</p>
      )}
    </div>
  );
}
