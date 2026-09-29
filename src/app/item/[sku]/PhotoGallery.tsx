"use client";

import { useState } from "react";

export default function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!photos.length) return <div className="aspect-square rounded-xl" style={{ background: "var(--line)" }} />;
  return (
    <div className="space-y-2">
      <div className="aspect-square rounded-xl overflow-hidden" style={{ background: "var(--line)" }}>
        <img src={photos[i]} alt={alt} className="w-full h-full object-contain" />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p, idx) => (
            <button key={p} onClick={() => setI(idx)} className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ outline: idx === i ? "2px solid var(--brand)" : "none" }}>
              <img src={p} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
