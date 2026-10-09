"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Row = { id: string; tool: string; title: string; photo: string | null; low: number; high: number; item_id: string | null; listed: boolean; created_at: string; verdict: string | null; count: number };

const TOOL: Record<string, { label: string; open: string }> = {
  worth: { label: "💰 What's it worth", open: "/worth" },
  buy_or_pass: { label: "🛒 Buy or Pass", open: "/buy-or-pass" },
  pile: { label: "📦 Sort the pile", open: "/pile" },
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const V: Record<string, string> = { buy: "var(--ok)", maybe: "var(--accent)", pass: "var(--danger)" };

export default function LookupsClient({ rows: initial }: { rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [tab, setTab] = useState<"todo" | "listed" | "all">("todo");
  const [busy, setBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<Row | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const shown = useMemo(() => rows.filter((r) => (tab === "all" ? true : tab === "listed" ? r.listed : !r.listed)), [rows, tab]);
  const listable = rows.filter((r) => !r.listed && (r.tool === "worth" || r.tool === "buy_or_pass"));

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/lookups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({}))) as { ok?: boolean; item_id?: string; open?: string; error?: string };
  }
  async function list(row: Row) {
    if (row.tool === "pile") { router.push(`/pile?open=${row.id}`); return; }
    setBusy(row.id); setMsg(null);
    const j = await act({ action: "list", id: row.id });
    setBusy(null);
    if (j.open) { router.push(j.open); return; }
    if (!j.item_id) { setMsg(j.error || "Couldn't make that listing. Try again."); return; }
    router.push(`/app/items/${j.item_id}?written=1&from=lookups#copy`);
  }
  async function listAll() {
    if (!listable.length || !confirm(`Write listings for all ${listable.length}? They'll be drafts you can check before they go live.`)) return;
    let n = 0;
    for (const row of listable) {
      setBusy(`all:${n + 1}/${listable.length}`);
      const j = await act({ action: "list", id: row.id });
      if (j.item_id) { n++; setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, listed: true, item_id: j.item_id! } : r))); }
    }
    setBusy(null);
    setMsg(`🎉 ${n} listing${n === 1 ? "" : "s"} written. They're in your Drafts.`);
  }
  async function del(row: Row) {
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    setUndo(row);
    await act({ action: "delete", id: row.id });
  }
  async function restore() {
    if (!undo) return;
    const row = undo; setUndo(null);
    setRows((rs) => [row, ...rs].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    await act({ action: "restore", id: row.id });
  }

  if (!rows.length && !undo) return (
    <div className="card p-6 text-center space-y-3">
      <p className="text-lg font-semibold">Nothing saved yet.</p>
      <p className="text-sm muted">Every check you do is saved here automatically.</p>
      <Link href="/worth" className="btn btn-primary w-full text-lg" style={{ minHeight: 52 }}>💰 Check what something&apos;s worth</Link>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {([["todo", `To list (${rows.filter((r) => !r.listed).length})`], ["listed", `Listed (${rows.filter((r) => r.listed).length})`], ["all", "All"]] as const).map(([k, l]) => (
          <button key={k} type="button" className={`pill px-3 py-2 flex-1 ${tab === k ? "pill-active" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "todo" && listable.length > 1 && (
        <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 52 }} disabled={!!busy} onClick={listAll}>{busy?.startsWith("all:") ? `Writing ${busy.slice(4)}…` : `📝 List all ${listable.length}`}</button>
      )}
      {msg && <p className="card p-3 text-sm text-center">{msg} {msg.startsWith("🎉") && <Link href="/app?status=draft" className="underline font-semibold">See them</Link>}</p>}
      {undo && <div className="card p-3 text-sm flex items-center justify-between gap-2"><span>Deleted “{undo.title.slice(0, 40)}”.</span><button type="button" className="btn btn-secondary" onClick={restore}>Undo</button></div>}
      {shown.map((r) => (
        <div key={r.id} className="card p-3 space-y-2">
          <div className="flex gap-3">
            {r.photo ? <img src={r.photo} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" /> : <div className="w-16 h-16 rounded-lg shrink-0" style={{ background: "var(--line)" }} />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight line-clamp-2">{r.title}</p>
              <p className="text-sm"><b>{money(r.low)}–{money(r.high)}</b>{r.verdict && <b className="ml-2" style={{ color: V[r.verdict] }}>{r.verdict.toUpperCase()}</b>}{r.count > 1 && <span className="muted"> · {r.count} items</span>}</p>
              <p className="text-xs muted">{TOOL[r.tool]?.label} · {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {r.listed && r.item_id ? (
              <Link href={`/app/items/${r.item_id}`} className="btn btn-secondary flex-1">✓ Listed · see it</Link>
            ) : (
              <button type="button" className="btn btn-primary flex-1" disabled={!!busy} onClick={() => list(r)}>{busy === r.id ? "Writing…" : r.tool === "pile" ? "📝 Open and list" : "📝 List it"}</button>
            )}
            <Link href={`${TOOL[r.tool]?.open || "/worth"}?open=${r.id}`} className="btn btn-secondary">Open</Link>
            <button type="button" className="btn btn-secondary" aria-label="Delete" onClick={() => del(r)}>🗑</button>
          </div>
        </div>
      ))}
      {!shown.length && <p className="text-sm muted text-center">{tab === "todo" ? "Everything here is listed. 🎉" : "Nothing here yet."}</p>}
    </div>
  );
}
