"use client";

import { useState } from "react";
import Mic from "@/components/Mic";

/**
 * "✨ Tell it what to change": talk or type, and the AI rewrites the title, description and condition line.
 * Undo puts the old words back. Free.
 */
type Words = { title: string; description: string; condition_notes: string };
export default function RewriteBox({ current, onApply }: { current: Words; onApply: (w: Words) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [prev, setPrev] = useState<Words | null>(null);
  async function go() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/ai-listing/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...current, instruction: text }) });
    const j = (await r.json().catch(() => ({}))) as Partial<Words> & { changed?: string; error?: string };
    setBusy(false);
    if (!r.ok || !j.title) return setMsg({ ok: false, t: j.error || "Couldn't rewrite it. Try again." });
    setPrev(current);
    onApply({ title: j.title, description: j.description || current.description, condition_notes: j.condition_notes ?? current.condition_notes });
    setText("");
    setMsg({ ok: true, t: `✓ ${j.changed || "Updated."} Check it below, then Save.` });
  }
  return (
    <div id="rewrite" className="card p-3 space-y-2 scroll-mt-4" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
      <p className="font-bold">✨ Tell it what to change</p>
      <div className="space-y-1">
        <textarea className="input" rows={2} style={{ minHeight: 64, fieldSizing: "content" } as React.CSSProperties} placeholder="Say it, e.g. take out the part about dust, they're new and unused, never opened" value={text} onChange={(e) => setText(e.target.value)} />
        <Mic onText={(t) => setText((x) => (x ? x.trimEnd() + " " : "") + t)} />
      </div>
      <button type="button" className="btn btn-primary w-full" style={{ minHeight: 48 }} disabled={busy || text.trim().length < 3} onClick={go}>{busy ? "Rewriting…" : "🔄 Rewrite it"}</button>
      {msg && <p className="text-sm text-center" style={{ color: msg.ok ? "var(--ok)" : "var(--danger)" }}>{msg.t}</p>}
      {prev && <button type="button" className="text-sm underline w-full" onClick={() => { onApply(prev); setPrev(null); setMsg({ ok: true, t: "Put the old words back." }); }}>↩ Undo the rewrite</button>}
      <p className="text-xs muted">Free. It changes the title, description and condition line; you check them and tap Save.</p>
    </div>
  );
}
