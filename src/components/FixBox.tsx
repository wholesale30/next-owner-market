"use client";

import { useState } from "react";
import Mic from "@/components/Mic";

/**
 * "Something wrong? Tell it." Sits right under an AI answer. The person types or talks the correction
 * ("it's the 1978 model", "the lid is missing", "it's a Pyrex, not a Corning") and the same photos are re-checked.
 * Free: it's our answer being fixed, not a new lookup.
 */
export default function FixBox({ onFix, examples = "it's the 1978 model · the lid is missing · that's real gold" }: { onFix: (text: string) => Promise<string | null>; examples?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function go() {
    if (!text.trim()) return;
    setBusy(true); setMsg(null);
    const err = await onFix(text.trim());
    setBusy(false);
    if (err) setMsg({ ok: false, t: err });
    else { setMsg({ ok: true, t: "✓ Updated with your correction." }); setText(""); setOpen(false); }
  }
  if (!open) return (
    <div className="space-y-1">
      <button type="button" className="btn w-full" style={{ minHeight: 48, border: "2px dashed var(--brand)" }} onClick={() => { setOpen(true); setMsg(null); }}>✏️ Something wrong? Tell it and it re-checks</button>
      {msg && <p className="text-sm text-center" style={{ color: msg.ok ? "var(--ok)" : "var(--danger)" }}>{msg.t}</p>}
    </div>
  );
  return (
    <div className="card p-3 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
      <p className="font-semibold">What&apos;s wrong or missing?</p>
      <textarea className="input" rows={2} autoFocus style={{ minHeight: 64, fieldSizing: "content" } as React.CSSProperties} placeholder={`Type or tap the mic. For example: ${examples}`} value={text} onChange={(e) => setText(e.target.value)} />
      <Mic onText={(t) => setText((h) => (h ? h.trimEnd() + " " : "") + t)} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1 text-lg" disabled={busy || !text.trim()} onClick={go}>{busy ? "Re-checking…" : "🔄 Update the answer"}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="text-xs muted">Same photos, your correction. Free; it doesn&apos;t use a lookup.</p>
      {msg && !msg.ok && <p className="text-sm" style={{ color: "var(--danger)" }}>{msg.t}</p>}
    </div>
  );
}
