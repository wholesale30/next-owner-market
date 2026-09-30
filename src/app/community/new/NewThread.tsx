"use client";

import Mic from "@/components/Mic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOARDS } from "@/lib/md";

export default function NewThread({ meId, board: initial }: { meId: string; board: string }) {
  const router = useRouter();
  const [f, setF] = useState({ board: initial, title: "", body: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const sb = createClient();
    let photo_url: string | null = null;
    if (photo) {
      const path = `community/${meId}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
      const { error } = await sb.storage.from("item-photos").upload(path, photo, { upsert: false });
      if (error) { setBusy(false); return setErr(error.message); }
      photo_url = sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await sb.from("threads").insert({ board: f.board, title: f.title.trim(), body: f.body.trim(), author_id: meId, photo_url }).select("id").single();
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/community/${data.id}`);
  }
  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <div><label className="label">Where does it go?</label><select className="input" value={f.board} onChange={(e) => setF({ ...f, board: e.target.value })}>{BOARDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}</select></div>
      <div><label className="label">Title</label><input className="input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required placeholder={f.board === "worth" ? "1978 Pioneer SX-780 receiver, works" : "What's on your mind?"} /></div>
      <div><div className="flex items-center justify-between"><label className="label">Say more</label><Mic onText={(t) => setF((x) => ({ ...x, body: (x.body ? x.body + " " : "") + t }))} /></div><textarea className="input" rows={5} maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></div>
      <div><label className="label">Photo (optional)</label><input className="input" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} /></div>
      <p className="text-xs muted">Phone numbers and emails get removed automatically. Keep deals inside the site.</p>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Posting…" : "Post"}</button>
    </form>
  );
}
