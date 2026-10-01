"use client";
import { useState } from "react";
export default function CopyCode({ label, code }: { label: string; code: string }) {
  const [c, setC] = useState(false);
  return <div className="card p-3 space-y-2"><p className="font-semibold text-sm">{label}</p><pre className="text-xs whitespace-pre-wrap break-all p-2 rounded-lg" style={{ background: "var(--line)" }}>{code}</pre><button type="button" className="btn btn-primary w-full" onClick={async () => { await navigator.clipboard.writeText(code); setC(true); setTimeout(() => setC(false), 1500); }}>{c ? "Copied!" : "Copy"}</button></div>;
}
