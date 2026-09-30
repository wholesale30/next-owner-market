"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PhotoPicker, { type Picked } from "@/components/PhotoPicker";
import Mic from "@/components/Mic";

type Item = { name: string; category?: string; condition?: string; low: number; high: number; action: "keep" | "sell" | "donate" | "toss"; reason: string; confidence: string; needs_expert: boolean; listing_title?: string; listing_description?: string; weight_lbs?: number; box?: string; photo_index: number };
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const ACT: Record<string, { label: string; color: string; emoji: string }> = { sell: { label: "Sell", color: "var(--ok)", emoji: "💵" }, keep: { label: "Keep", color: "var(--brand)", emoji: "🏠" }, donate: { label: "Donate", color: "var(--accent)", emoji: "🎁" }, toss: { label: "Toss", color: "var(--muted)", emoji: "🗑" } };

export default function PileClient({ meId, role }: { meId: string | null; role: string | null }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [hints, setHints] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean } | null>(null);
  const [res, setRes] = useState<{ scanId?: string; summary: string; items: Item[]; total_low: number; total_high: number } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  async function run() {
    if (!meId) { router.push("/signup?buyer=1&next=/pile"); return; }
    setBusy("Sorting… this takes about a minute for a big pile"); setErr(null);
    const r = await fetch("/api/pile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos.map((p) => p.url), hints }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setErr({ msg: j.error || "Couldn't sort that.", upgrade: j.upgrade });
    setRes(j); setPicked(new Set(j.items.map((x: Item, i: number) => (x.action === "sell" ? i : -1)).filter((i: number) => i >= 0)));
  }
  function setAction(i: number, action: Item["action"]) { if (!res) return; const items = res.items.map((x, j) => (j === i ? { ...x, action } : x)); setRes({ ...res, items }); const p = new Set(picked); if (action === "sell") p.add(i); else p.delete(i); setPicked(p); }
  async function listPicked() {
    if (!res || !meId) return;
    setBusy("Creating your listings…");
    const sb = createClient();
    if (role === "buyer") await fetch("/api/become-seller", { method: "POST" });
    let n = 0;
    for (const i of picked) {
      const x = res.items[i];
      const { data } = await sb.from("items").insert({ owner_id: meId, created_by: meId, title: (x.listing_title || x.name).slice(0, 80), description: x.listing_description || x.reason, condition_notes: x.condition || null, price: Math.round((x.low + x.high) / 2), price_min_suggested: x.low, price_max_suggested: x.high, status: "draft", ai_generated: true, local_pickup_ok: true, shipping_ok: x.box !== "freight", weight_lbs: x.weight_lbs || null, box: x.box === "freight" ? "xl" : x.box || "medium", shipping_mode: "calculated" }).select("id").single();
      if (data) { const p = photos[x.photo_index] || photos[0]; if (p) await sb.from("item_photos").insert({ item_id: data.id, storage_path: p.path, url: p.url, sort_order: 0, is_primary: true }); n++; }
    }
    setBusy(null);
    router.push(`/app?status=draft&made=${n}`);
  }
  if (!res) return (
    <div className="card p-4 space-y-3">
      <PhotoPicker photos={photos} onChange={setPhotos} max={10} folder="pile" meId={meId} onBusy={setBusy} label="Photograph the pile" />
      <p className="text-xs muted">Wide shot first, then closer shots so labels are readable. Up to 10 photos. Big piles: do them a shelf at a time.</p>
      <div className="space-y-1"><textarea className="input" rows={2} placeholder="Anything we should know? (Dad's tools, all works, some water damage…)" value={hints} onChange={(e) => setHints(e.target.value)} /><Mic onText={(t) => setHints((h) => (h ? h.trimEnd() + " " : "") + t)} /></div>
      <button type="button" className="btn btn-primary w-full text-lg" disabled={!photos.length || !!busy} onClick={run}>{busy || "Sort it"}</button>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err.msg}{err.upgrade && <> <Link href="/pro" className="underline font-semibold">Go Pro</Link></>}</p>}
      {!meId && <p className="text-xs muted text-center">Free. You&apos;ll make a free account first so your results are saved.</p>}
    </div>
  );
  const counts = { sell: 0, keep: 0, donate: 0, toss: 0 } as Record<string, number>;
  res.items.forEach((x) => { counts[x.action] = (counts[x.action] || 0) + 1; });
  return (
    <div className="space-y-3">
      <div className="card p-4 text-center space-y-1">
        <p className="text-xs muted uppercase tracking-wide">Sellable items are worth about</p>
        <p className="text-4xl font-extrabold">{money(res.items.filter((x) => x.action === "sell").reduce((a, x) => a + x.low, 0))} – {money(res.items.filter((x) => x.action === "sell").reduce((a, x) => a + x.high, 0))}</p>
        <p className="text-sm">{res.summary}</p>
        <p className="text-xs muted">{Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${ACT[k].emoji} ${n} ${ACT[k].label.toLowerCase()}`).join(" · ")}</p>
      </div>
      {res.items.map((x, i) => (
        <div key={i} className="card p-3 space-y-1" style={{ borderLeft: `4px solid ${ACT[x.action].color}` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-bold leading-tight">{x.name}</p><p className="text-xs muted">{[x.category, x.condition].filter(Boolean).join(" · ")}</p></div>
            <p className="font-extrabold whitespace-nowrap">{x.action === "toss" ? "—" : `${money(x.low)}–${money(x.high)}`}</p>
          </div>
          <p className="text-sm">{x.reason}{x.needs_expert ? " ⚠ Get an expert look before selling." : ""}</p>
          <div className="flex gap-1 flex-wrap">
            {(["sell", "keep", "donate", "toss"] as const).map((a) => <button key={a} type="button" className={`pill px-3 py-1 ${x.action === a ? "pill-active" : ""}`} onClick={() => setAction(i, a)}>{ACT[a].emoji} {ACT[a].label}</button>)}
          </div>
        </div>
      ))}
      <div className="card p-4 space-y-2 text-center" style={{ borderColor: "var(--brand)" }}>
        <p className="font-bold">List the {picked.size} marked Sell</p>
        <p className="text-sm muted">Each becomes a draft with a photo, title, description and price already written. You check them and tap List. Free.</p>
        <button type="button" className="btn btn-primary w-full text-lg" disabled={!picked.size || !!busy} onClick={listPicked}>{busy || `List ${picked.size} item${picked.size === 1 ? "" : "s"}`}</button>
        <button type="button" className="btn btn-secondary w-full" onClick={() => { setRes(null); setPhotos([]); }}>Sort another pile</button>
      </div>
      <p className="text-xs muted">Estimates from photos, not appraisals. Ranges, because the market moves. Anything marked ⚠ deserves a specialist.</p>
    </div>
  );
}
