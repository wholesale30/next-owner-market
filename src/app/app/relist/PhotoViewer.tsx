"use client";

import { useEffect, useState } from "react";

/** Full-screen photo viewer for the Relist list (Oct 24, 2026): tap a thumbnail, swipe or tap ‹ › through all photos. */
export default function PhotoViewer({ photos, start, title, onClose }: { photos: string[]; start: number; title: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [x0, setX0] = useState<number | null>(null);
  const go = (d: number) => setI((n) => (n + d + photos.length) % photos.length);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!photos.length) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="truncate pr-2">{title}</span>
        <span className="shrink-0">{i + 1} / {photos.length}</span>
        <button type="button" className="ml-3 text-2xl leading-none px-2" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="flex-1 flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); setX0(null); }}>
        <img src={photos[i]} alt={`Photo ${i + 1}`} style={{ maxWidth: "100vw", maxHeight: "calc(100vh - 120px)", objectFit: "contain" }} />
        {photos.length > 1 && <>
          <button type="button" aria-label="Previous" className="absolute left-1 top-1/2 -translate-y-1/2 text-white text-4xl px-3 py-6" onClick={() => go(-1)}>‹</button>
          <button type="button" aria-label="Next" className="absolute right-1 top-1/2 -translate-y-1/2 text-white text-4xl px-3 py-6" onClick={() => go(1)}>›</button>
        </>}
      </div>
      <div className="flex gap-1 overflow-x-auto p-2" onClick={(e) => e.stopPropagation()}>
        {photos.map((u, n) => <img key={u} src={u} alt="" onClick={() => setI(n)} className="w-14 h-14 object-cover rounded shrink-0" style={{ outline: n === i ? "2px solid white" : "none", opacity: n === i ? 1 : 0.6 }} />)}
      </div>
    </div>
  );
}
