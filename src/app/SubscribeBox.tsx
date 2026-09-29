"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Store footer / banner email capture: "Get new arrivals". */
export default function SubscribeBox({ compact = false }: { compact?: boolean }) {
  const [contact, setContact] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await createClient().rpc("subscribe", { p_contact: contact, p_name: null, p_source: "store", p_interest: "new_arrivals" });
    setBusy(false);
    if (error) return setErr("Please enter a valid email or phone.");
    setDone(true);
  }

  if (done) return <div className={`card ${compact ? "p-3" : "p-5"} text-center text-sm`}><p className="font-semibold">You&apos;re on the list.</p><p className="muted">New arrivals and deals, no spam.</p></div>;

  return (
    <form onSubmit={go} className={`card ${compact ? "p-3" : "p-5"} space-y-2 text-center`}>
      {!compact && <h2 className="font-bold text-lg">Get new arrivals first</h2>}
      <p className="muted text-sm">{compact ? "New arrivals & deals:" : "Weekly email or text of what just came in. Unsubscribe any time."}</p>
      <div className="flex gap-2">
        <input className="input" placeholder="Email or phone" value={contact} onChange={(e) => setContact(e.target.value)} required />
        <button className="btn btn-primary" disabled={busy}>{busy ? "…" : "Join"}</button>
      </div>
      {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </form>
  );
}
