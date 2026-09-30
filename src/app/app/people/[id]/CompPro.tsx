"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CompPro({ id, comped, until, note }: { id: string; comped: boolean; until: string | null; note: string | null }) {
  const router = useRouter();
  const [months, setMonths] = useState("");
  const [n, setN] = useState(note || "");
  const [busy, setBusy] = useState(false);
  async function give(revoke = false) {
    setBusy(true);
    const { error } = await createClient().rpc("comp_pro", { p_id: id, p_months: months ? Number(months) : null, p_note: n || null, p_revoke: revoke });
    setBusy(false);
    if (error) return alert(error.message);
    router.refresh();
  }
  return (
    <div className="card p-3 space-y-2" style={{ borderColor: "var(--brand)" }}>
      <p className="font-semibold">🎁 Free Pro</p>
      {comped ? (
        <>
          <p className="text-sm">This person has Pro free{until ? ` until ${new Date(until).toLocaleDateString()}` : ", forever"}.{note ? ` (${note})` : ""}</p>
          <button className="btn btn-secondary" disabled={busy} onClick={() => { if (confirm("Take away free Pro?")) give(true); }}>Remove</button>
        </>
      ) : (
        <>
          <p className="text-xs muted">Everything Pro has, no card, no charge. Also makes them an approved seller.</p>
          <div className="flex gap-2">
            <select className="input" value={months} onChange={(e) => setMonths(e.target.value)}><option value="">Forever</option><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">1 year</option></select>
            <input className="input" placeholder="Note (family, friend, tester…)" value={n} onChange={(e) => setN(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => give(false)}>Give free Pro</button>
        </>
      )}
    </div>
  );
}
