"use client";

import { useEffect, useState } from "react";

export default function UsernameField({ value, onChange, current }: { value: string; onChange: (v: string) => void; current?: string }) {
  const [state, setState] = useState<{ ok: boolean; reason: string } | null>(null);
  useEffect(() => {
    const v = value.trim().toLowerCase();
    const t = setTimeout(() => { if (!v || v === current) { setState(null); return; } fetch(`/api/username?u=${encodeURIComponent(v)}`).then((r) => r.json()).then(setState).catch(() => setState(null)); }, v && v !== current ? 350 : 0);
    return () => clearTimeout(t);
  }, [value, current]);
  return (
    <div>
      <label className="label">Username (what everyone sees instead of your name)</label>
      <div className="flex items-center gap-2">
        <span className="muted">@</span>
        <input className="input" autoCapitalize="none" autoCorrect="off" maxLength={20} value={value} onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())} placeholder="vintageaudio804" />
      </div>
      {state && <p className="text-xs mt-1" style={{ color: state.ok ? "var(--ok)" : "var(--danger)" }}>{state.ok ? "✓ Available" : state.reason}</p>}
      {!state && <p className="text-xs muted mt-1">3–20 letters, numbers, or _. Your real name, email, and phone stay private.</p>}
    </div>
  );
}
