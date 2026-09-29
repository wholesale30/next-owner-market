"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Size = "small" | "medium" | "large";

interface Tag {
  sku: string;
  url: string;
  title: string;
  price: string;
  condition: string;
  location: string;
  category: string;
  description: string;
  brand: string;
  model: string;
  tested: boolean;
  serviced: boolean;
  businessName: string;
}

const SIZES: Record<Size, { w: string; h: string; label: string; qr: number; desc: number }> = {
  small: { w: "2.25in", h: "1.25in", label: "Small 2¼×1¼ (thermal label)", qr: 78, desc: 0 },
  medium: { w: "4in", h: "2in", label: "Medium 4×2 (shipping-label printer)", qr: 120, desc: 140 },
  large: { w: "4in", h: "6in", label: "Large 4×6 (full tag, hang on item)", qr: 170, desc: 600 },
};

export default function TagSheet({ tag, tags, size: initial }: { tag?: Tag; tags?: Tag[]; size: Size }) {
  const all = tags && tags.length ? tags : tag ? [tag] : [];
  const [size, setSize] = useState<Size>(initial);
  const [copies, setCopies] = useState(1);
  const s = SIZES[size];
  const descOf = (t: Tag) => (s.desc ? t.description.slice(0, s.desc) + (t.description.length > s.desc ? "…" : "") : "");

  return (
    <div className="space-y-4">
      <div className="no-print space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Print {all.length > 1 ? `${all.length} tags` : "tag"}</h1>
          <Link href="/app" className="muted text-sm" onClick={(e) => { e.preventDefault(); history.back(); }}>← Back</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(Object.keys(SIZES) as Size[]).map((k) => (
            <button key={k} className={`pill px-3 py-2 whitespace-nowrap ${size === k ? "pill-active" : ""}`} onClick={() => setSize(k)}>{SIZES[k].label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">Copies <input type="number" min={1} max={20} className="input inline-block w-20 ml-2" value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))} /></label>
          <button className="btn btn-primary flex-1" onClick={() => window.print()}>🖨️ Print</button>
        </div>
        <p className="text-xs muted">On a label printer, set paper size to match. On a regular printer, print then cut. Scan the code with any phone camera to open the item.</p>
      </div>

      <div className="print-area flex flex-wrap gap-3">
        {all.flatMap((tag) => Array.from({ length: copies }).map((_, i) => (
          <div key={tag.sku + i} className="tag" style={{ width: s.w, height: s.h }}>
            <div className="tag-inner">
              <div className="tag-qr"><QRCodeSVG value={tag.url} size={s.qr} level="M" includeMargin={false} /></div>
              <div className="tag-text">
                <div className="tag-sku">{tag.sku}</div>
                <div className="tag-title">{tag.title}</div>
                <div className="tag-price">{tag.price}</div>
                <div className="tag-meta">
                  {tag.brand && <span>{tag.brand}{tag.model ? ` ${tag.model}` : ""}</span>}
                  {tag.condition && <span>{tag.condition}</span>}
                  {tag.location && <span>BIN {tag.location}</span>}
                </div>
                {(tag.tested || tag.serviced) && <div className="tag-badge">{[tag.tested && "TESTED", tag.serviced && "SERVICED"].filter(Boolean).join(" • ")}</div>}
                {descOf(tag) && size !== "small" && <div className="tag-desc">{descOf(tag)}</div>}
                <div className="tag-biz">{tag.businessName}</div>
              </div>
            </div>
          </div>
        )))}
      </div>

      <style>{`
        .tag { background: #fff; color: #000; border: 1px dashed #999; box-sizing: border-box; padding: 0.08in; page-break-inside: avoid; overflow: hidden; }
        .tag-inner { display: flex; gap: 0.1in; height: 100%; }
        .tag-qr { flex: none; display: flex; align-items: flex-start; }
        .tag-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-family: Arial, Helvetica, sans-serif; }
        .tag-sku { font-size: 9pt; font-weight: 700; letter-spacing: .04em; }
        .tag-title { font-size: 10pt; font-weight: 700; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .tag-price { font-size: 16pt; font-weight: 800; }
        .tag-meta { font-size: 8pt; display: flex; flex-wrap: wrap; gap: 0 8px; }
        .tag-badge { font-size: 7.5pt; font-weight: 700; border: 1px solid #000; padding: 1px 4px; align-self: flex-start; border-radius: 3px; }
        .tag-desc { font-size: 7.5pt; line-height: 1.25; overflow: hidden; }
        .tag-biz { margin-top: auto; font-size: 7pt; color: #444; }
        .tag[style*="1.25in"] .tag-title { font-size: 8.5pt; -webkit-line-clamp: 2; }
        .tag[style*="1.25in"] .tag-price { font-size: 12pt; }
        .tag[style*="1.25in"] .tag-biz { display: none; }
        .tag[style*="6in"] .tag-inner { flex-direction: column; align-items: center; text-align: center; }
        .tag[style*="6in"] .tag-title { font-size: 14pt; -webkit-line-clamp: 3; }
        .tag[style*="6in"] .tag-price { font-size: 26pt; }
        .tag[style*="6in"] .tag-meta { justify-content: center; font-size: 10pt; }
        .tag[style*="6in"] .tag-desc { font-size: 9.5pt; text-align: left; }
        .tag[style*="6in"] .tag-badge { align-self: center; font-size: 9pt; }
        @media print {
          @page { margin: 0.2in; }
          .print-area { gap: 0; }
          .tag { border: none; }
        }
      `}</style>
    </div>
  );
}
