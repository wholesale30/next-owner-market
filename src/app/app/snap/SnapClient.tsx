"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cleanBackground, compressImage, preloadBackgroundModel } from "@/lib/photo";

/**
 * Snap mode. Two ways in:
 *  - Shoot: one item at a time, tap "Next item" between them.
 *  - Dump: pick a whole batch of photos; AI sorts them into items; you fix any mistakes; Finish.
 * Either way, photos get a clean background (optional), then the AI writes every listing.
 */

type Shot = { id: string; file: File; preview: string };
type Group = { id: string; shots: Shot[]; note: string };

const newGroup = (shots: Shot[] = []): Group => ({ id: crypto.randomUUID(), shots, note: "" });

export default function SnapClient({ userId, bins, photoBg }: { userId: string; bins: { id: string; code: string }[]; photoBg: string }) {
  const supabase = useMemo(() => createClient(), []);
  const shootRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const dumpRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<Group[]>([newGroup()]);
  const [bin, setBin] = useState("");
  const [tier, setTier] = useState<"owned" | "full_service" | "drop_off">("owned");
  const [clean, setClean] = useState(true);
  const [progress, setProgress] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [sorting, setSorting] = useState(false);
  const cur = groups[groups.length - 1];

  useEffect(() => { if (clean) preloadBackgroundModel(); }, [clean]);

  const toShots = (list: FileList) => Array.from(list).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));

  // ---- shoot mode ----
  function addToCurrent(list: FileList | null) {
    if (!list?.length) return;
    const shots = toShots(list);
    setGroups((g) => g.map((x, i) => (i === g.length - 1 ? { ...x, shots: [...x.shots, ...shots] } : x)));
  }
  function nextItem() {
    if (!cur.shots.length) return;
    setGroups((g) => [...g, newGroup()]);
  }

  // ---- dump mode ----
  async function dump(list: FileList | null) {
    if (!list?.length) return;
    const shots = toShots(list).slice(0, 40);
    if (list.length > 40) alert("Max 40 photos per batch. Taking the first 40; dump the rest after.");
    setSorting(true);
    setProgress([`Uploading ${shots.length} photos for sorting…`]);
    try {
      // small thumbnails are enough for the AI to tell items apart
      const urls: string[] = [];
      for (let i = 0; i < shots.length; i++) {
        const thumb = await compressImage(shots[i].file, 640, 0.7);
        const path = `${userId}/sort/${Date.now()}-${i}.jpg`;
        const up = await supabase.storage.from("item-photos").upload(path, thumb, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        urls.push(supabase.storage.from("item-photos").getPublicUrl(path).data.publicUrl);
      }
      setProgress((p) => [...p, "Sorting into items…"]);
      const r = await fetch("/api/ai-listing/group", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: urls }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const made: Group[] = (j.groups as number[][]).map((idxs) => newGroup(idxs.map((i) => shots[i])));
      setGroups((g) => [...g.filter((x) => x.shots.length), ...made, newGroup()]);
      setProgress([`Sorted into ${made.length} items. Check the groups below, then tap Finish.`]);
      // thumbnails are temporary
      supabase.storage.from("item-photos").remove(urls.map((u) => u.split("/item-photos/")[1])).then(() => {});
    } catch (e) {
      setProgress([`Sorting failed (${e instanceof Error ? e.message : String(e)}). Added them as one item each; merge with the ⇐ button.`]);
      setGroups((g) => [...g.filter((x) => x.shots.length), ...shots.map((s) => newGroup([s])), newGroup()]);
    } finally {
      setSorting(false);
    }
  }

  // ---- group editing ----
  function dropGroup(id: string) {
    setGroups((g) => { const r = g.filter((x) => x.id !== id); return r.length && !r[r.length - 1].shots.length ? r : [...r, newGroup()]; });
  }
  function mergeIntoPrevious(idx: number) {
    setGroups((g) => {
      if (idx === 0) return g;
      const copy = [...g];
      copy[idx - 1] = { ...copy[idx - 1], shots: [...copy[idx - 1].shots, ...copy[idx].shots] };
      copy.splice(idx, 1);
      return copy;
    });
  }
  function splitShot(gIdx: number, sIdx: number) {
    // everything from this shot onward becomes a new item
    setGroups((g) => {
      const copy = [...g];
      const grp = copy[gIdx];
      if (sIdx === 0) return g;
      const moved = grp.shots.slice(sIdx);
      copy[gIdx] = { ...grp, shots: grp.shots.slice(0, sIdx) };
      copy.splice(gIdx + 1, 0, newGroup(moved));
      return copy;
    });
  }
  function removeShot(gIdx: number, sIdx: number) {
    setGroups((g) => g.map((x, i) => (i === gIdx ? { ...x, shots: x.shots.filter((_, j) => j !== sIdx) } : x)).filter((x, i, arr) => x.shots.length || i === arr.length - 1));
  }

  // ---- finish ----
  async function finish() {
    const todo = groups.filter((g) => g.shots.length);
    if (!todo.length) return;
    setRunning(true);
    setProgress([]);
    const log = (m: string) => setProgress((p) => [...p, m]);
    for (let i = 0; i < todo.length; i++) {
      const g = todo[i];
      try {
        const { data: item, error } = await supabase.from("items").insert({ owner_id: userId, created_by: userId, title: "", description: "", status: "draft", tier, location_id: bin || null, condition_notes: g.note || null }).select("id, sku").single();
        if (error) throw error;
        let cleanedCount = 0;
        for (let j = 0; j < g.shots.length; j++) {
          const res = clean ? await cleanBackground(g.shots[j].file, photoBg) : { blob: await compressImage(g.shots[j].file), cleaned: false };
          if (res.cleaned) cleanedCount++;
          const path = `${userId}/${Date.now()}-${item.id}-${j}.jpg`;
          const up = await supabase.storage.from("item-photos").upload(path, res.blob, { contentType: "image/jpeg" });
          if (up.error) throw up.error;
          const { data: pub } = supabase.storage.from("item-photos").getPublicUrl(path);
          await supabase.from("item_photos").insert({ item_id: item.id, storage_path: path, url: pub.publicUrl, sort_order: j, is_primary: j === 0 });
        }
        log(`${i + 1}/${todo.length} ${item.sku}: ${g.shots.length} photos saved${clean ? ` (${cleanedCount} cleaned)` : ""}, writing listing…`);
        const r = await fetch("/api/ai-listing/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) });
        const j = await r.json();
        log(r.ok ? `   ✓ ${j.title}${j.worth_listing === false ? " (AI says low value, left as draft)" : ""}` : `   ⚠ AI failed: ${j.error}. Saved as draft, edit it by hand.`);
      } catch (e) {
        log(`   ⚠ ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    log("Done. Everything is in Review, ready to approve.");
    setGroups([newGroup()]);
    setRunning(false);
  }

  const filled = groups.filter((g) => g.shots.length);
  const busy = running || sorting;

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold">Snap mode</h1>
        <p className="muted text-sm"><b>Shoot</b> one item at a time and tap Next, or <b>Dump</b> a whole batch and let the AI sort it into items. Then Finish: backgrounds get cleaned and every listing gets written.</p>
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
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> Clean backgrounds (cuts the item out onto a plain background; first use downloads ~40MB once)</label>

      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => uploadRef.current?.click()}>🖼 Upload photos from gallery</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => shootRef.current?.click()}>📷 Take a photo</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dumpRef.current?.click()}>{sorting ? "Sorting…" : "🗂 Dump a batch (AI sorts)"}</button>
      </div>
      <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addToCurrent(e.target.files); e.target.value = ""; }} />
      <input ref={shootRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addToCurrent(e.target.files); e.target.value = ""; }} />
      <input ref={dumpRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { dump(e.target.files); e.target.value = ""; }} />

      {cur.shots.length > 0 && (
        <div className="card p-3 space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-semibold">Current item ({cur.shots.length} photo{cur.shots.length > 1 ? "s" : ""})</p>
          <div className="grid grid-cols-4 gap-1">{cur.shots.map((s) => <img key={s.id} src={s.preview} alt="" className="aspect-square object-cover rounded" />)}</div>
          <input className="input" placeholder="Quick note (optional): tested, missing cord…" value={cur.note} onChange={(e) => setGroups((g) => g.map((x, i) => (i === g.length - 1 ? { ...x, note: e.target.value } : x)))} />
          <button type="button" className="btn btn-secondary w-full" onClick={nextItem}>Next item →</button>
        </div>
      )}

      {filled.filter((g) => g.id !== cur.id).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm muted">{filled.filter((g) => g.id !== cur.id).length} item{filled.length > 2 ? "s" : ""} ready. Tap a photo to split the item there; ⇐ merges into the one above.</p>
          {groups.map((g, gi) => g.shots.length && g.id !== cur.id ? (
            <div key={g.id} className="card p-2 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Item {filled.indexOf(g) + 1} <span className="muted font-normal">• {g.shots.length} photo{g.shots.length > 1 ? "s" : ""}</span></span>
                <div className="flex gap-1">
                  {gi > 0 && groups[gi - 1].shots.length > 0 && <button className="pill" onClick={() => mergeIntoPrevious(gi)}>⇐ merge up</button>}
                  <button className="pill" onClick={() => dropGroup(g.id)}>×</button>
                </div>
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {g.shots.map((s, si) => (
                  <div key={s.id} className="relative shrink-0">
                    <button type="button" onClick={() => si > 0 && confirm("Start a new item from this photo onward?") && splitShot(gi, si)} title={si > 0 ? "Split here" : ""}>
                      <img src={s.preview} alt="" className="w-16 h-16 object-cover rounded" />
                    </button>
                    <button type="button" onClick={() => removeShot(gi, si)} className="absolute -right-1 -top-1 w-5 h-5 rounded-full text-white text-xs" style={{ background: "var(--danger)" }}>×</button>
                  </div>
                ))}
              </div>
              <input className="input" placeholder="Note (optional)" value={g.note} onChange={(e) => setGroups((arr) => arr.map((x) => (x.id === g.id ? { ...x, note: e.target.value } : x)))} />
            </div>
          ) : null)}
        </div>
      )}

      {progress.length > 0 && <pre className="card p-3 text-xs whitespace-pre-wrap">{progress.join("\n")}</pre>}

      <div className="fixed bottom-0 inset-x-0 p-3 border-t" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="max-w-3xl mx-auto flex gap-2">
          <Link href="/app" className="btn btn-secondary">← Inventory</Link>
          <button className="btn btn-primary flex-1" disabled={busy || !filled.length} onClick={finish}>{running ? "Working…" : `Finish (${filled.length} item${filled.length === 1 ? "" : "s"})`}</button>
        </div>
      </div>
    </div>
  );
}
