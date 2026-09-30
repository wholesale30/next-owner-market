"use client";

import { useState } from "react";

export default function AskBox({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setA(null);
    const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
    const j = (await r.json()) as { answer?: string; error?: string };
    setBusy(false);
    setA(j.answer || j.error || "Couldn't get an answer just now.");
  }
  return (
    <div className={`card p-3 space-y-2 ${compact ? "" : "p-4"}`}>
      {!compact && <p className="font-bold">Ask anything</p>}
      <form onSubmit={ask} className="flex gap-2">
        <input className="input" placeholder="How do I get paid?" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !q.trim()}>{busy ? "…" : "Ask"}</button>
      </form>
      {a && <p className="text-sm whitespace-pre-line">{a}</p>}
    </div>
  );
}
