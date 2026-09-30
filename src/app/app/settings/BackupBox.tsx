"use client";

import { useEffect, useState } from "react";

export default function BackupBox() {
  const [list, setList] = useState<{ name: string; size: number; created_at: string; url?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => fetch("/api/backup").then((r) => r.json()).then((j) => setList(j.backups || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  async function now() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/backup", { method: "POST" });
    const j = (await r.json()) as { file?: string; error?: string; tables?: number };
    setBusy(false);
    setMsg(r.ok ? `Backed up ${j.tables} tables to ${j.file}.` : j.error || "Failed");
    load();
  }
  return (
    <div className="card p-3 text-sm space-y-2">
      <div className="flex items-center justify-between"><p className="font-semibold">Backups</p><button className="btn btn-secondary" disabled={busy} onClick={now}>{busy ? "Working…" : "Back up now"}</button></div>
      <p className="muted text-xs">Every table, every night, kept 30 days in private storage. Download one to keep in OneDrive. Photos and videos are in the item-photos bucket and aren&apos;t included.</p>
      {msg && <p>{msg}</p>}
      {list.map((b) => <p key={b.name}><a className="underline" href={b.url} target="_blank" rel="noreferrer">{b.name}</a> <span className="muted">• {(b.size / 1024).toFixed(0)} KB</span></p>)}
      {!list.length && <p className="muted">No backups yet. Tap Back up now.</p>}
    </div>
  );
}
