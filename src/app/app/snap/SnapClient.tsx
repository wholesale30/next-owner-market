"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Snap mode: shoot item after item with no typing. Each item = 1–5 photos + "Next item".
 * When you tap Finish, drafts are created and the AI writes every listing in the background.
 * You then approve them from the Review queue.
 */

type Group = { id: string; files: File[]; previews: string[]; note: string };

async function compress(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", quality));
}

export default function SnapClient({ userId, bins }: { userId: string; bins: { id: string; code: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<Group[]>([{ id: crypto.randomUUID(), files: [], previews: [], note: "" }]);
  const [bin, setBin] = useState("");
  const [tier, setTier] = useState<"owned" | "full_service" | "drop_off">("owned");
  const [progress, setProgress] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const cur = groups[groups.length - 1];

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    setGroups((g) => g.map((x, i) => (i === g.length - 1 ? { ...x, files: [...x.files, ...files], previews: [...x.previews, ...files.map((f) => URL.createObjectURL(f))] } : x)));
  }
  function nextItem() {
    if (!cur.files.length) return;
    setGroups((g) => [...g, { id: crypto.randomUUID(), files: [], previews: [], note: "" }]);
  }
  function dropGroup(id: string) {
    setGroups((g) => (g.length === 1 ? [{ id: crypto.randomUUID(), files: [], previews: [], note: "" }] : g.filter((x) => x.id !== id)));
  }

  async function finish() {
    const todo = groups.filter((g) => g.files.length);
    if (!todo.length) return;
    setRunning(true);
    setProgress([]);
    const log = (m: string) => setProgress((p) => [...p, m]);
    for (let i = 0; i < todo.length; i++) {
      const g = todo[i];
      try {
        const { data: item, error } = await supabase.from("items").insert({ owner_id: userId, created_by: userId, title: "", description: "", status: "draft", tier, location_id: bin || null, condition_notes: g.note || null }).select("id, sku").single();
        if (error) throw error;
        for (let j = 0; j < g.files.length; j++) {
          const blob = await compress(g.files[j]);
          const path = `${userId}/${Date.now()}-${item.id}-${j}.jpg`;
          const up = await supabase.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
          if (up.error) throw up.error;
          const { data: pub } = supabase.storage.from("item-photos").getPublicUrl(path);
          await supabase.from("item_photos").insert({ item_id: item.id, storage_path: path, url: pub.publicUrl, sort_order: j, is_primary: j === 0 });
        }
        log(`${i + 1}/${todo.length} ${item.sku}: photos saved, writing listing…`);
        const r = await fetch("/api/ai-listing/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) });
        const j = await r.json();
        log(r.ok ? `   ✓ ${j.title}${j.worth_listing === false ? " (AI says low value, left as draft)" : ""}` : `   ⚠ AI failed: ${j.error}. Saved as draft, edit it by hand.`);
      } catch (e) {
        log(`   ⚠ ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    log("Done. Everything is in Review, ready to approve.");
    setGroups([{ id: crypto.randomUUID(), files: [], previews: [], note: "" }]);
    setRunning(false);
  }

  const shot = groups.filter((g) => g.files.length).length;

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold">Snap mode</h1>
        <p className="muted text-sm">Shoot each item, tap <b>Next item</b>, repeat. Tap <b>Finish</b> and the AI writes every listing while you keep working. Approve them in Review.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={bin} onChange={(e) => setBin(e.target.value)}>
          <option value="">No bin</option>
          {bins.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <select className="input" value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
          <option value="owned">My inventory</option>
          <option value="full_service">Consignment (full)</option>
          <option value="drop_off">Consignment (drop-off)</option>
        </select>
      </div>

      <div className="card p-3 space-y-2">
        <p className="font-semibold">Item {shot + (cur.files.length ? 0 : 1)} {cur.files.length ? `(${cur.files.length} photo${cur.files.length > 1 ? "s" : ""})` : ""}</p>
        <div className="grid grid-cols-4 gap-1">
          {cur.previews.map((p, i) => <img key={i} src={p} alt="" className="aspect-square object-cover rounded" />)}
          <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded border-2 border-dashed flex items-center justify-center text-2xl" style={{ borderColor: "var(--line)" }}>📷</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input className="input" placeholder="Quick note (optional): tested, missing cord…" value={cur.note} onChange={(e) => setGroups((g) => g.map((x, i) => (i === g.length - 1 ? { ...x, note: e.target.value } : x)))} />
      </div>

      {shot > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {groups.filter((g) => g.files.length).map((g, i) => (
            <div key={g.id} className="relative shrink-0">
              <img src={g.previews[0]} alt="" className="w-16 h-16 object-cover rounded-lg" />
              <span className="absolute left-1 top-1 pill">{i + 1}</span>
              <button onClick={() => dropGroup(g.id)} className="absolute -right-1 -top-1 w-5 h-5 rounded-full text-white text-xs" style={{ background: "var(--danger)" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {progress.length > 0 && <pre className="card p-3 text-xs whitespace-pre-wrap">{progress.join("\n")}</pre>}

      <div className="fixed bottom-0 inset-x-0 p-3 border-t" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="max-w-3xl mx-auto flex gap-2">
          <button className="btn btn-secondary flex-1" disabled={running || !cur.files.length} onClick={nextItem}>Next item →</button>
          <button className="btn btn-primary flex-1" disabled={running || !groups.some((g) => g.files.length)} onClick={finish}>{running ? "Working…" : `Finish (${shot + (cur.files.length ? 1 : 0)})`}</button>
        </div>
      </div>
      <Link href="/app" className="text-sm muted">← Inventory</Link>
    </div>
  );
}
