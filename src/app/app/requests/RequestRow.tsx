"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface R {
  id: string;
  name: string | null;
  contact: string;
  description: string;
  budget: string;
  will_ship: boolean;
  max_distance_miles: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const STATUSES = ["open", "searching", "matched", "fulfilled", "closed"];

export default function RequestRow({ r }: { r: R }) {
  const router = useRouter();
  const [notes, setNotes] = useState(r.admin_notes || "");
  const [busy, setBusy] = useState(false);
  const isPhone = /^[\d\s()+-]{7,}$/.test(r.contact.trim());

  async function update(patch: Record<string, unknown>) {
    setBusy(true);
    await createClient().from("sourcing_requests").update(patch).eq("id", r.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex justify-between gap-2">
        <p className="font-semibold">{r.name || "Someone"} <span className="muted font-normal text-sm">• {new Date(r.created_at).toLocaleDateString()}</span></p>
        <select className="pill" value={r.status} disabled={busy} onChange={(e) => update({ status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="text-sm whitespace-pre-wrap">{r.description}</p>
      <p className="text-xs muted">Budget {r.budget} • {r.will_ship ? "OK to ship" : "No shipping"}{r.max_distance_miles ? ` • drives ${r.max_distance_miles} mi` : ""}</p>
      <div className="flex gap-2">
        {isPhone ? (
          <a className="pill pill-active" href={`sms:${r.contact.replace(/\s/g, "")}`}>Text {r.contact}</a>
        ) : (
          <a className="pill pill-active" href={`mailto:${r.contact}`}>Email {r.contact}</a>
        )}
      </div>
      <div className="flex gap-1">
        <input className="input" placeholder="Your notes (where you looked, what you found…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn btn-secondary" disabled={busy} onClick={() => update({ admin_notes: notes })}>Save</button>
      </div>
    </div>
  );
}
