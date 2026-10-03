"use client";

import { useState } from "react";

export type FRow = { id: string; kind: string; message: string; page: string | null; email: string | null; photo_url: string | null; status: string; staff_note: string | null; created_at: string; who: string };
const LABEL: Record<string, string> = { new: "📬 New", planned: "🛠 On it", done: "✅ Done", not_now: "⏸ Not now" };

export default function FeedbackAdmin({ rows: start }: { rows: FRow[] }) {
  const [rows, setRows] = useState(start);
  const [tab, setTab] = useState<"open" | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function set(id: string, status: string) {
    const note = notes[id] ?? rows.find((r) => r.id === id)?.staff_note ?? "";
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status, staff_note: note || null } : r)));
    await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, status, note }) });
  }
  const shown = rows.filter((r) => (tab === "all" ? true : r.status === "new" || r.status === "planned"));
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <button type="button" className={`pill px-3 py-2 flex-1 ${tab === "open" ? "pill-active" : ""}`} onClick={() => setTab("open")}>Open ({rows.filter((r) => r.status === "new" || r.status === "planned").length})</button>
        <button type="button" className={`pill px-3 py-2 flex-1 ${tab === "all" ? "pill-active" : ""}`} onClick={() => setTab("all")}>All ({rows.length})</button>
      </div>
      {!shown.length && <p className="text-sm muted text-center">Nothing open. 🎉</p>}
      {shown.map((r) => (
        <div key={r.id} className="card p-3 space-y-2" style={{ borderLeft: `4px solid ${r.kind === "problem" ? "var(--danger)" : "var(--brand)"}` }}>
          <div className="flex justify-between gap-2 text-sm"><b>{r.kind === "problem" ? "🐞 Not working" : "💡 Idea"} · {r.who}</b><span className="muted">{new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
          <p className="whitespace-pre-wrap">{r.message}</p>
          {r.page && <p className="text-xs muted">Page: <a href={r.page} className="underline">{r.page}</a></p>}
          {r.photo_url && <a href={r.photo_url} target="_blank" rel="noreferrer"><img src={r.photo_url} alt="screenshot" className="max-h-48 rounded-lg" /></a>}
          {r.email && <p className="text-xs muted">Email: <a href={`mailto:${r.email}`} className="underline">{r.email}</a></p>}
          <input className="input text-sm" placeholder="Note they'll see (optional), e.g. Fixed, thanks!" value={notes[r.id] ?? r.staff_note ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(LABEL).map(([k, l]) => <button key={k} type="button" className={`pill px-2 py-2 text-xs ${r.status === k ? "pill-active" : ""}`} onClick={() => set(r.id, k)}>{l}</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}
