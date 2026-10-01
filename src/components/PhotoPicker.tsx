"use client";

import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/photo";

export type Picked = { url: string; path: string };

/** Gallery-first photo picker that uploads to storage and returns public URLs. */
export default function PhotoPicker({ photos, onChange, max = 6, folder, meId, onBusy, label = "Pick photos" }: { photos: Picked[]; onChange: (p: Picked[]) => void; max?: number; folder: string; meId: string | null; onBusy?: (b: string | null) => void; label?: string }) {
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    // Signed out: never a dead button. Send them to the free account page and right back here.
    if (!meId) { window.location.href = `/signup?buyer=1&next=${encodeURIComponent(window.location.pathname)}`; return; }
    onBusy?.("Uploading…");
    const sb = createClient();
    const next = [...photos];
    for (const f of Array.from(files).slice(0, max - photos.length)) {
      try {
        const blob = await compressImage(f);
        const path = `${folder}/${meId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await sb.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        next.push({ url: sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl, path });
        onChange([...next]);
      } catch { /* skip */ }
    }
    onBusy?.(null);
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((p, i) => <div key={p.path} className="relative"><img src={p.url} alt="" className="aspect-square object-cover rounded-xl w-full" /><button type="button" aria-label="Remove" className="absolute top-1 right-1 pill" onClick={() => onChange(photos.filter((_, j) => j !== i))}>×</button></div>)}
      {photos.length < max && (
        <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm cursor-pointer text-center" style={{ borderColor: "var(--brand)" }}>
          <span className="text-3xl">🖼</span><span className="font-semibold">{photos.length ? "Add more" : label}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      {photos.length < max && (
        <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm cursor-pointer text-center" style={{ borderColor: "var(--brand)" }}>
          <span className="text-3xl">📸</span><span className="font-semibold">Take a photo</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
