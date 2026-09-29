"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolveButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go(action: "refund" | "release") {
    if (!confirm(action === "refund" ? "Refund the buyer in full?" : "Release the money to the seller?")) return;
    setBusy(true); setErr(null);
    const r = await fetch("/api/orders/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, action, note }) });
    const j = (await r.json()) as { error?: string };
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Failed");
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Note to both parties (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-secondary flex-1" disabled={busy} onClick={() => go("refund")}>Refund buyer</button>
        <button className="btn btn-primary flex-1" disabled={busy} onClick={() => go("release")}>Pay seller</button>
      </div>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
