"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** "Message about this item" — works with or without an account. */
export default function MessageForm({ itemId, title, defaults }: { itemId: string; title: string; defaults?: { name?: string; contact?: string } }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: defaults?.name || "", contact: defaults?.contact || "", body: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { data: cid, error } = await createClient().rpc("start_conversation", { p_item_id: itemId, p_name: f.name, p_contact: f.contact, p_body: f.body });
    if (!error && cid) fetch("/api/messages/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: cid }) }).catch(() => {});
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    setDone(true);
  }

  const quick = ["Is this still available?", "What's your best price?", "Can I see more photos?", "Does it work? Been tested?", "When can I pick it up?"];

  if (!open) return <button className="btn btn-primary flex-1" onClick={() => setOpen(true)}>💬 Message about this</button>;

  return (
    <form onSubmit={send} className="card p-3 space-y-2 text-sm w-full">
      {done ? (
        <div className="space-y-1">
          <p className="font-semibold">Sent. We usually reply within a few hours.</p>
          <p className="muted">We&apos;ll answer at {f.contact}. Ask another question any time from this page.</p>
        </div>
      ) : (
        <>
          <p className="font-semibold">Message about &quot;{title}&quot;</p>
          <div className="flex gap-1 flex-wrap">{quick.map((q) => <button key={q} type="button" className="pill" onClick={() => setF({ ...f, body: f.body ? f.body + " " + q : q })}>{q}</button>)}</div>
          <textarea className="input" rows={3} placeholder="Your message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="input" placeholder="Phone or email" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} required />
          </div>
          {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
          </div>
        </>
      )}
    </form>
  );
}
