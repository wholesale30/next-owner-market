"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LookingForPage() {
  const [f, setF] = useState({ name: "", contact: "", description: "", budget_max: "", will_ship: false, max_distance_miles: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("sourcing_requests").insert({
      requester_id: user?.id || null,
      name: f.name || null,
      contact: f.contact,
      description: f.description,
      budget_max: f.budget_max ? Number(f.budget_max) : null,
      will_ship: f.will_ship,
      max_distance_miles: f.max_distance_miles ? Number(f.max_distance_miles) : null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
  }

  return (
    <main className="flex-1 max-w-lg mx-auto p-4 space-y-4">
      <Link href="/" className="text-sm muted">← Back to store</Link>
      {done ? (
        <div className="card p-6 text-center space-y-2">
          <h1 className="text-xl font-bold">Got it. We&apos;re on the hunt.</h1>
          <p className="muted text-sm">We&apos;ll reach out at {f.contact} as soon as we find a match. Check back too; new items go up every day.</p>
          <Link href="/" className="btn btn-primary">Browse the store</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">What are you looking for?</h1>
            <p className="muted text-sm">We source surplus across the country. Describe it and we&apos;ll find it, then let you know.</p>
          </div>
          <div><label className="label">Describe it</label><textarea className="input" rows={4} required placeholder="e.g. Technics direct-drive turntable, working, with dust cover. Or: bread machine, any brand." value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Your name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label">Top budget $</label><input className="input" type="number" inputMode="decimal" value={f.budget_max} onChange={(e) => setF({ ...f, budget_max: e.target.value })} /></div>
          </div>
          <div><label className="label">Phone or email (how we reach you)</label><input className="input" required value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.will_ship} onChange={(e) => setF({ ...f, will_ship: e.target.checked })} /> OK to ship it to me</label>
            <label className="flex items-center gap-2">Will drive up to <input className="input w-20" type="number" inputMode="numeric" value={f.max_distance_miles} onChange={(e) => setF({ ...f, max_distance_miles: e.target.value })} /> miles</label>
          </div>
          {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send it"}</button>
        </form>
      )}
    </main>
  );
}
