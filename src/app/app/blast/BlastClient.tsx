"use client";

import { useState } from "react";
import { money } from "@/lib/listing";

interface It { id: string; sku: string; title: string; price: number; listed_at: string | null; item_photos: { url: string; is_primary: boolean }[] }

export default function BlastClient({ items, subscriberCount, history }: { items: It[]; subscriberCount: number; history: { subject: string; recipients: number; sent: number; created_at: string }[] }) {
  const [sel, setSel] = useState<Set<string>>(() => { const week = Date.now() - 7 * 86400000; return new Set(items.filter((i) => i.listed_at && new Date(i.listed_at).getTime() > week).slice(0, 12).map((i) => i.id)); });
  const [subject, setSubject] = useState("New this week at Next Owner Market");
  const [intro, setIntro] = useState("Fresh out of the warehouse. First come, first served; tap anything to grab it or message us.");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function send(test: boolean) {
    if (!test && !confirm(`Send to ${subscriberCount} people?`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/blast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, intro, itemIds: Array.from(sel), test }) });
    const j = (await r.json()) as { error?: string; sent?: number; recipients?: number };
    setBusy(false);
    setMsg(r.ok ? (test ? "Test sent to your email." : `Sent to ${j.sent} of ${j.recipients}.`) : j.error || "Failed");
  }

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">New arrivals email</h1><p className="muted text-sm">{subscriberCount} people on the list. Pick the items, write two lines, send. Unsubscribe link and your address go on automatically.</p></div>
      <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      <div><label className="label">Intro (2–3 lines)</label><textarea className="input" rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} /></div>
      <div className="flex items-center justify-between"><p className="font-semibold">Items ({sel.size} picked)</p><div className="flex gap-1"><button className="pill" onClick={() => setSel(new Set(items.map((i) => i.id)))}>All</button><button className="pill" onClick={() => setSel(new Set())}>None</button></div></div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const p = it.item_photos.find((x) => x.is_primary)?.url || it.item_photos[0]?.url;
          const on = sel.has(it.id);
          return (
            <button key={it.id} type="button" onClick={() => toggle(it.id)} className="card overflow-hidden text-left" style={{ outline: on ? "3px solid var(--brand)" : "none" }}>
              <div className="aspect-square" style={{ background: "var(--line)" }}>{p && <img src={p} alt="" className="w-full h-full object-cover" />}</div>
              <div className="p-1 text-xs"><b>{money(it.price)}</b><p className="line-clamp-2">{it.title}</p></div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-secondary flex-1" disabled={busy || !sel.size} onClick={() => send(true)}>Send me a test</button>
        <button className="btn btn-primary flex-1" disabled={busy || !sel.size} onClick={() => send(false)}>{busy ? "Sending…" : `Send to ${subscriberCount}`}</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      {history.length > 0 && <div className="text-xs muted space-y-1"><p className="font-semibold">Recent</p>{history.map((h, i) => <p key={i}>{new Date(h.created_at).toLocaleDateString()} • {h.subject} • {h.sent}/{h.recipients}</p>)}</div>}
      <p className="text-[11px] muted">Free tier sends 100 emails a day, 3,000 a month. Past that, Resend is $20/month for 50,000.</p>
    </div>
  );
}
