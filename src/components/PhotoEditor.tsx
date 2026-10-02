"use client";

import { useEffect, useMemo, useState } from "react";
import { fixLight, removeSpecks, rotate, toBlob, toCanvas } from "@/lib/photo-edit";
import { cleanBackground } from "@/lib/photo";

/**
 * Full-screen photo editor. Big thumb buttons, one tap each, Undo any time.
 * Opens on a photo URL or file; Save hands back a JPEG. Nothing is uploaded until Save.
 */
export default function PhotoEditor({ src, bg = "#ffffff", onSave, onClose }: { src: string | Blob; bg?: string; onSave: (blob: Blob) => Promise<void> | void; onClose: () => void }) {
  const [hist, setHist] = useState<Blob[]>([]);
  const [busy, setBusy] = useState<string | null>("Opening…");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cur = hist[hist.length - 1];
  const view = useMemo(() => (cur ? URL.createObjectURL(cur) : null), [cur]);
  useEffect(() => () => { if (view) URL.revokeObjectURL(view); }, [view]);

  useEffect(() => {
    let off = false;
    toCanvas(src).then(toBlob).then((b) => { if (!off) { setHist([b]); setBusy(null); } }).catch(() => { if (!off) { setErr("Couldn't open that photo."); setBusy(null); } });
    return () => { off = true; };
  }, [src]);

  async function run(label: string, f: (b: Blob) => Promise<{ blob: Blob; note?: string }>) {
    if (!cur || busy) return;
    setBusy(label); setErr(null); setNote(null);
    try {
      const r = await f(cur);
      setHist((h) => [...h, r.blob]);
      if (r.note) setNote(r.note);
    } catch { setErr("That didn't work on this photo. Try another tool."); }
    setBusy(null);
  }

  const light = () => run("Fixing the light…", async (b) => ({ blob: await toBlob(fixLight(await toCanvas(b))) }));
  const dust = () => run("Cleaning off dust…", async (b) => {
    const { canvas, specks } = removeSpecks(await toCanvas(b));
    return { blob: await toBlob(canvas), note: specks ? "Specks cleaned. Tap again for a second pass." : "No small specks found. Try Fix the light for a dull, dusty look." };
  });
  const all = () => run("Touching it up…", async (b) => {
    const c = await toCanvas(b); const { specks } = removeSpecks(c); removeSpecks(c); fixLight(c);
    return { blob: await toBlob(c), note: specks ? "Light fixed and dust specks cleaned." : "Light fixed." };
  });
  const back = () => run("Cleaning the background… (first time takes a minute)", async (b) => {
    const r = await cleanBackground(b, bg);
    return { blob: r.blob, note: r.cleaned ? "Background cleaned." : "Couldn't find the item's edges in this one. Kept the photo as it was." };
  });
  const turn = () => run("Turning…", async (b) => ({ blob: await toBlob(rotate(await toCanvas(b))) }));

  async function save() {
    if (!cur) return;
    setBusy("Saving…");
    try { await onSave(cur); } catch { setErr("Couldn't save. Try again."); setBusy(null); }
  }

  const btn = "btn btn-secondary text-base";
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg, #111)" }}>
      <div className="flex items-center justify-between gap-2 p-3 border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy === "Saving…"}>✕ Cancel</button>
        <p className="font-bold">Touch up photo</p>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!cur || !!busy || hist.length < 2}>✓ Save</button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 relative" style={{ background: "#222" }}>
        {view && <img src={view} alt="" className="max-w-full max-h-full object-contain" />}
        {busy && <div className="absolute inset-x-0 bottom-3 text-center"><span className="pill" style={{ background: "rgba(0,0,0,.75)", color: "#fff" }}>{busy}</span></div>}
      </div>
      <div className="p-3 space-y-2 border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        {(note || err) && <p className="text-sm text-center" style={{ color: err ? "var(--danger)" : undefined }}>{err || note}</p>}
        <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 52 }} disabled={!cur || !!busy} onClick={all}>✨ Fix it up (light + dust)</button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btn} style={{ minHeight: 48 }} disabled={!cur || !!busy} onClick={dust}>🧽 Clean off dust</button>
          <button type="button" className={btn} style={{ minHeight: 48 }} disabled={!cur || !!busy} onClick={light}>☀️ Fix the light</button>
          <button type="button" className={btn} style={{ minHeight: 48 }} disabled={!cur || !!busy} onClick={back}>⬜ Clean background</button>
          <button type="button" className={btn} style={{ minHeight: 48 }} disabled={!cur || !!busy} onClick={turn}>↻ Turn</button>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary flex-1" disabled={hist.length < 2 || !!busy} onClick={() => { setHist((h) => h.slice(0, -1)); setNote(null); }}>↩ Undo</button>
          <button type="button" className="btn btn-secondary flex-1" disabled={hist.length < 2 || !!busy} onClick={() => { setHist((h) => h.slice(0, 1)); setNote(null); }}>Start over</button>
        </div>
        <p className="text-xs muted text-center">Removes dust specks and dullness. It doesn&apos;t hide scratches, chips or stains, so buyers get what they see. Wipe it down before it ships.</p>
      </div>
    </div>
  );
}
