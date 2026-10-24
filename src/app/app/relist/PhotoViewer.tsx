"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Full-screen photo viewer for the Relist list (Oct 24, 2026): tap a thumbnail, swipe or tap ‹ › through all photos,
 * and rearrange them: ⭐ Make cover, ◀ Move earlier, Move later ▶. Order saves right away; the first photo is the cover
 * that goes up first on Facebook.
 */
type P = { id: string; url: string };

export default function PhotoViewer({ itemId, photos: initial, start, title, onClose }: { itemId: string; photos: string[]; start: number; title: string; onClose: (photos: string[]) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<P[]>(initial.map((url) => ({ id: "", url })));
  const [i, setI] = useState(start);
  const [x0, setX0] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("item_photos").select("id, url, sort_order").eq("item_id", itemId).order("sort_order").then(({ data }) => {
      if (data?.length) setList(data.map((d) => ({ id: d.id as string, url: d.url as string })));
    });
  }, [supabase, itemId]);

  const n = list.length;
  const go = (d: number) => setI((k) => (k + d + n) % n);
  const close = () => onClose(list.map((p) => p.url));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  async function save(next: P[], focus: number, label: string) {
    if (next.some((p) => !p.id)) { setMsg("Still loading, try again in a second."); return; }
    setBusy(true);
    setList(next); setI(focus);
    const results = await Promise.all(next.map((p, k) => supabase.from("item_photos").update({ sort_order: k, is_primary: k === 0 }).eq("id", p.id)));
    setBusy(false);
    const bad = results.find((r) => r.error);
    setMsg(bad ? `⚠ Couldn't save the order: ${bad.error!.message}` : `✓ ${label}`);
  }
  const move = (from: number, to: number, label: string) => {
    if (to < 0 || to >= n || from === to) return;
    const next = [...list]; const [p] = next.splice(from, 1); next.splice(to, 0, p);
    save(next, to, label);
  };

  if (!n) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }} onClick={close}>
      <div className="flex items-center justify-between p-3 text-white text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="truncate pr-2">{title}</span>
        <span className="shrink-0">{i + 1} / {n}{i === 0 ? " • cover" : ""}</span>
        <button type="button" className="ml-3 text-2xl leading-none px-2" aria-label="Close" onClick={close}>×</button>
      </div>
      <div className="flex-1 flex items-center justify-center relative min-h-0" onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); setX0(null); }}>
        <img src={list[i].url} alt={`Photo ${i + 1}`} style={{ maxWidth: "100vw", maxHeight: "100%", objectFit: "contain" }} />
        {n > 1 && <>
          <button type="button" aria-label="Previous" className="absolute left-1 top-1/2 -translate-y-1/2 text-white text-4xl px-3 py-6" onClick={() => go(-1)}>‹</button>
          <button type="button" aria-label="Next" className="absolute right-1 top-1/2 -translate-y-1/2 text-white text-4xl px-3 py-6" onClick={() => go(1)}>›</button>
        </>}
      </div>
      {n > 1 && (
        <div className="grid grid-cols-3 gap-2 px-3 pt-2" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-secondary" disabled={busy || i === 0} onClick={() => move(i, i - 1, `Moved to spot ${i}`)}>◀ Earlier</button>
          <button type="button" className="btn btn-primary" disabled={busy || i === 0} onClick={() => move(i, 0, "Now the cover photo")}>⭐ Make cover</button>
          <button type="button" className="btn btn-secondary" disabled={busy || i === n - 1} onClick={() => move(i, i + 1, `Moved to spot ${i + 2}`)}>Later ▶</button>
        </div>
      )}
      {msg && <p className="text-center text-sm text-white pt-1" onClick={(e) => e.stopPropagation()}>{msg}</p>}
      <div className="flex gap-1 overflow-x-auto p-2" onClick={(e) => e.stopPropagation()}>
        {list.map((p, k) => (
          <button key={p.url} type="button" className="relative shrink-0" onClick={() => setI(k)}>
            <img src={p.url} alt="" className="w-14 h-14 object-cover rounded" style={{ outline: k === i ? "2px solid white" : "none", opacity: k === i ? 1 : 0.6 }} />
            <span className="absolute top-0 left-0 text-[10px] text-white px-1 rounded" style={{ background: "rgba(0,0,0,0.6)" }}>{k === 0 ? "⭐" : k + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
