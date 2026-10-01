"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type B = { batch: number; when: string; by: string; main: string; kind: string; owner: string; parts: string; restored: boolean };
type A = { id: string; sku: string; title: string; price: number; listed_at: string | null; updated_at: string; owner: string };
const when = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function TrashClient({ batches, archived }: { batches: B[]; archived: A[] }) {
  const sb = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showRestored, setShowRestored] = useState(false);
  async function restore(b: B) {
    setBusy(`b${b.batch}`); setMsg(null);
    const { data, error } = await sb.rpc("restore_trash", { p_batch: b.batch });
    setBusy(null);
    setMsg(error ? `Couldn't bring it back: ${error.message}` : `Brought back: ${b.main || b.kind} (${data} piece${data === 1 ? "" : "s"}). If it was an item, it's in its old spot with its photos.`);
    router.refresh();
  }
  async function unarchive(a: A) {
    setBusy(a.id); setMsg(null);
    const { error } = await sb.from("items").update({ status: a.listed_at ? "active" : "draft" }).eq("id", a.id);
    setBusy(null);
    setMsg(error ? `Couldn't: ${error.message}` : `${a.title} is back ${a.listed_at ? "live in the store" : "in Drafts"}.`);
    router.refresh();
  }
  const open = batches.filter((b) => !b.restored);
  const done = batches.filter((b) => b.restored);
  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-bold">🗑 Deleted</h1>
        <p className="text-sm muted">Everything anyone deletes anywhere on the site lands here and stays here: items (with their photos), photos removed while editing, blog posts, community posts, pickup times, invites, bins, categories. Tap <b>Bring it back</b> to undo. Nothing here is ever erased.</p>
      </div>
      {msg && <p className="card p-3 text-sm" style={{ borderLeft: "4px solid var(--brand)" }}>{msg}</p>}

      <section className="space-y-2">
        <h2 className="font-bold text-lg">Deleted ({open.length})</h2>
        {open.length === 0 && <p className="muted text-sm">Nothing deleted yet.</p>}
        {open.map((b) => (
          <div key={b.batch} className="card p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{b.kind}: {b.main || "(no title)"}</p>
              <p className="text-xs muted">{when(b.when)} · deleted by {b.by}{b.owner ? ` · belonged to ${b.owner}` : ""} · {b.parts}</p>
            </div>
            <button className="btn btn-primary shrink-0" disabled={busy === `b${b.batch}`} onClick={() => restore(b)}>{busy === `b${b.batch}` ? "…" : "Bring it back"}</button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-lg">Archived items ({archived.length})</h2>
        <p className="text-xs muted">Archived = hidden from lists but kept (sold items and anything someone archived). Bring one back and it returns live if it was listed before, or to Drafts.</p>
        {archived.length === 0 && <p className="muted text-sm">None.</p>}
        {archived.map((a) => (
          <div key={a.id} className="card p-3 flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="font-semibold">{a.title}</p><p className="text-xs muted">{a.sku} · ${a.price}{a.owner ? ` · ${a.owner}` : ""} · archived {when(a.updated_at)}</p></div>
            <button className="btn btn-secondary shrink-0" disabled={busy === a.id} onClick={() => unarchive(a)}>{busy === a.id ? "…" : "Bring it back"}</button>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <button className="underline text-sm" onClick={() => setShowRestored(!showRestored)}>{showRestored ? "Hide" : "Show"} already brought back ({done.length})</button>
          {showRestored && done.map((b) => <p key={b.batch} className="text-xs muted">{when(b.when)} · {b.kind}: {b.main} · restored</p>)}
        </section>
      )}
    </div>
  );
}
