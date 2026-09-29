"use client";

import { useState } from "react";
import { embedFor } from "@/lib/video";

export type Media = { type: "photo"; url: string } | { type: "video"; url: string };

export default function PhotoGallery({ media, alt }: { media: Media[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!media.length) return <div className="aspect-square rounded-xl" style={{ background: "var(--line)" }} />;
  const cur = media[i];
  const emb = cur.type === "video" ? embedFor(cur.url) || { type: "video" as const, src: cur.url } : null;
  return (
    <div className="space-y-2">
      <div className="aspect-square rounded-xl overflow-hidden" style={{ background: cur.type === "video" ? "#000" : "var(--line)" }}>
        {cur.type === "photo" && <img src={cur.url} alt={alt} className="w-full h-full object-contain" />}
        {emb?.type === "video" && <video src={emb.src} controls playsInline preload="metadata" className="w-full h-full object-contain" />}
        {emb?.type === "iframe" && <iframe src={emb.src} title={`${alt} video`} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
      </div>
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {media.map((m, idx) => (
            <button key={m.url + idx} onClick={() => setI(idx)} className="w-16 h-16 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ outline: idx === i ? "2px solid var(--brand)" : "none", background: m.type === "video" ? "#000" : "var(--line)" }} aria-label={m.type === "video" ? "Play video" : `Photo ${idx + 1}`}>
              {m.type === "photo" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-2xl">▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
