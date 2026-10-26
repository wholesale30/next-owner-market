"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Mic from "@/components/Mic";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/photo";

/** Start a deep lookup: photos (gallery first, camera second) + what he knows, then one big button. */
export default function NewDeep({ meId }: { meId: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr(""); setBusy("Uploading…");
    const sb = createClient();
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      try {
        const blob = await compressImage(f);
        const path = `deep/${meId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await sb.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const url = sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
        setPhotos((p) => [...p, url]);
      } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); }
    }
    setBusy(null);
  }

  async function run() {
    setErr(""); setBusy("Researching: prices, manuals, how to test it… (1 to 3 minutes)");
    const r = await fetch("/api/deep", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos, notes }) });
    const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!r.ok || !j.id) { setBusy(null); setErr(j.error || "Couldn't finish the report. Try again."); return; }
    router.push(`/app/deep/${j.id}`);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((u, i) => (
          <button key={u} type="button" className="relative aspect-square" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
            <img src={u} alt="" className="w-full h-full object-cover rounded-xl" />
            <span className="absolute top-1 right-1 text-xs font-bold rounded-full px-2" style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}>✕</span>
          </button>
        ))}
        {photos.length < 6 && (
          <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm cursor-pointer" style={{ borderColor: "var(--brand)" }}>
            <span className="text-3xl">🖼</span><span className="font-semibold">{photos.length ? "Add more" : "Pick photos"}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        {photos.length < 6 && (
          <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm cursor-pointer" style={{ borderColor: "var(--brand)" }}>
            <span className="text-3xl">📸</span><span className="font-semibold">Take a photo</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <p className="text-xs muted">The whole item, then close-ups of the label, model and serial plate, and any damage. Up to 6.</p>
      <div className="space-y-1">
        <textarea className="input" rows={3} placeholder="What you know: model, where it came from, does it power on, what's missing, what you want to find out…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Mic onText={(t) => setNotes((h) => (h ? h.trimEnd() + " " : "") + t)} />
      </div>
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={!!busy || (!photos.length && !notes.trim())} onClick={run}>{busy || "🔬 Run the deep check"}</button>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
