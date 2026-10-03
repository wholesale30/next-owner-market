"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PhotoPicker, { type Picked } from "@/components/PhotoPicker";
import FixBox from "@/components/FixBox";
import OutOfUses from "@/components/OutOfUses";
import PartsBox, { type PartView } from "@/components/PartsBox";
import Mic from "@/components/Mic";


type Item = { fixup?: string; fixup_low?: number | null; fixup_high?: number | null; fixup_tip?: string | null; missing_parts?: PartView[]; name: string; category?: string; condition?: string; low: number; high: number; action: "keep" | "sell" | "donate" | "toss"; reason: string; confidence: string; needs_expert: boolean; listing_title?: string; listing_description?: string; weight_lbs?: number; box?: string; photo_index: number };
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
  async function fix(correction: string): Promise<string | null> {
    if (!res) return "Nothing to fix yet.";
    const r = await fetch("/api/pile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos.map((p) => p.url), hints, correction, prev_scan_id: res.scanId, previous: res.items.map((x) => ({ name: x.name, low: x.low, high: x.high, action: x.action })) }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) { setErr({ msg: j.error || "You're out of AI uses.", upgrade: true }); return "You're out of AI uses for now. See the box below."; }
    if (!r.ok || !j.items) return j.error || "Couldn't update it. Try again.";
    setRes(j); setPicked(new Set(j.items.map((x: Item, i: number) => (x.action === "sell" ? i : -1)).filter((i: number) => i >= 0))); setHints((h) => (h ? h + ". " : "") + correction);
    return null;
  }
  function setAction(i: number, action: Item["action"]) { if (!res) return; const items = res.items.map((x, j) => (j === i ? { ...x, action } : x)); setRes({ ...res, items }); const p = new Set(picked); if (action === "sell") p.add(i); else p.delete(i); setPicked(p); }
  async function listPicked() {
    if (!res || !meId) return;
    setBusy("Creating your listings…");
    const sb = createClient();
    if (role === "buyer") await fetch("/api/become-seller", { method: "POST" });
    let n = 0, last = "";
    for (const i of picked) {
      const x = res.items[i];
      const { data } = await sb.from("items").insert({ owner_id: meId, created_by: meId, title: (x.listing_title || x.name).slice(0, 80), description: x.listing_description || x.reason, condition_notes: x.condition || null, price: Math.round((x.low + x.high) / 2), price_min_suggested: x.low, price_max_suggested: x.high, status: "draft", ai_generated: true, local_pickup_ok: true, shipping_ok: x.box !== "freight", weight_lbs: x.weight_lbs || null, box: x.box === "freight" ? "xl" : x.box || "medium", shipping_mode: "calculated" }).select("id").single();
      if (data) { const p = photos[x.photo_index] || photos[0]; if (p) await sb.from("item_photos").insert({ item_id: data.id, storage_path: p.path, url: p.url, sort_order: 0, is_primary: true }); n++; last = data.id; }
    }
    setBusy(null);
    router.push(n === 1 && last ? `/app/items/${last}?written=1#copy` : `/app?status=draft&made=${n}`);
  }
  if (!res) return (
    <div className="card p-4 space-y-3">
      <PhotoPicker photos={photos} onChange={setPhotos} max={10} folder="pile" meId={meId} onBusy={setBusy} label="Pick photos" />
      <p className="text-xs muted">Wide shot first, then closer shots so labels are readable. Up to 10 photos. Big piles: do them a shelf at a time.</p>
      <div className="space-y-1"><textarea className="input" rows={2} placeholder="Anything we should know? (Dad's tools, all works, some water damage…)" value={hints} onChange={(e) => setHints(e.target.value)} /><Mic onText={(t) => setHints((h) => (h ? h.trimEnd() + " " : "") + t)} /></div>
      <button type="button" className="btn btn-primary w-full text-lg" disabled={!photos.length || !!busy} onClick={run}>{busy || "Sort it"}</button>
      {err && (err.upgrade ? <OutOfUses message={err.msg} back="/pile" /> : <p className="text-sm" style={{ color: "var(--danger)" }}>{err.msg}</p>)}
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
      <div className="card p-4 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
        <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={!picked.size || !!busy} onClick={listPicked}>{busy || (picked.size ? `📝 Write ${picked.size === 1 ? "the listing" : `${picked.size} listings`}` : "Mark something Sell to list it")}</button>
        <p className="text-xs muted text-center">For everything marked 💰 Sell below: photo, title, description and price written, plus the Facebook post and 8 more sites. Free to list here. Each listing has ✨ Touch up for its photos.</p>
      </div>
      {err?.upgrade && <OutOfUses message={err.msg} back="/pile" />}
      <FixBox onFix={fix} examples="the lamp is brass, not plastic · you missed the drill · the radio doesn't work" />
      <SharePile items={res.items.filter((x) => x.action === "sell")} photos={photos} />
      <button type="button" className="btn btn-secondary w-full text-lg" style={{ minHeight: 52 }} onClick={() => { setRes(null); setPhotos([]); }}>📸 Sort another pile</button>
      {res.items.map((x, i) => (
        <div key={i} className="card p-3 space-y-1" style={{ borderLeft: `4px solid ${ACT[x.action].color}` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-bold leading-tight">{x.name}</p><p className="text-xs muted">{[x.category, x.condition].filter(Boolean).join(" · ")}</p></div>
            <p className="font-extrabold whitespace-nowrap">{x.action === "toss" ? "—" : `${money(x.low)}–${money(x.high)}`}</p>
          </div>
          <p className="text-sm">{x.reason}{x.needs_expert ? " ⚠ Get an expert look before selling." : ""}</p>
          {x.fixup && x.fixup !== "none" && x.fixup_high != null && <p className="text-sm rounded-lg px-2 py-1" style={{ background: "color-mix(in srgb, var(--ok) 12%, var(--surface))" }}>💡 {x.fixup === "clean" ? "🧽 Cleaned up" : x.fixup === "test" ? "🔌 If it works" : "✨ Cleaned and working"}: <b>{money(x.fixup_low ?? x.low)}–{money(x.fixup_high)}</b> <span style={{ color: "var(--ok)" }}>(+{money(Math.max(0, x.fixup_high - x.high))})</span>{x.fixup_tip ? <span className="muted"> · {x.fixup_tip}</span> : null}</p>}
          <PartsBox parts={x.missing_parts} nowLow={x.low} nowHigh={x.high} compact />
          <div className="flex gap-1 flex-wrap">
            {(["sell", "keep", "donate", "toss"] as const).map((a) => <button key={a} type="button" className={`pill px-3 py-1 ${x.action === a ? "pill-active" : ""}`} onClick={() => setAction(i, a)}>{ACT[a].emoji} {ACT[a].label}</button>)}
          </div>
        </div>
      ))}
      <p className="text-xs muted">Estimates from photos, not appraisals. Ranges, because the market moves. Anything marked ⚠ deserves a specialist.</p>
    </div>
  );
}

function SharePile({ items, photos }: { items: Item[]; photos: Picked[] }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [withPhoto, setWithPhoto] = useState(true);
  if (!items.length) return null;
  async function share() {
    setState("busy");
    let ok = 0;
    for (const x of items) {
      const r = await fetch("/api/valuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "pile", title: x.name, condition: x.condition, value_low: x.low, value_high: x.high, confidence: x.confidence, why: x.reason, category: x.category, photo_url: withPhoto ? photos[x.photo_index]?.url || null : null }) });
      if (r.ok) ok++;
    }
    setState(ok ? "done" : "err");
  }
  const box = { background: "color-mix(in srgb, var(--brand) 8%, var(--surface))", borderColor: "var(--brand)", borderWidth: 2 } as const;
  if (state === "done") return <div className="card p-3 text-sm text-center" style={box}><p style={{ color: "var(--ok)" }}>✓ {items.length} new page{items.length === 1 ? "" : "s"} people can find on Google. <Link className="underline" href="/valued">See them</Link></p><button type="button" className="btn btn-primary w-full mt-2" onClick={async () => { const url = `${window.location.origin}/valued`; try { if (navigator.share) await navigator.share({ title: "What's it worth?", text: "Found out what my stuff is worth, free:", url }); else await navigator.clipboard.writeText(url); } catch { /* ok */ } }}>📣 Tell your friends</button></div>;
  return (
    <div className="card p-3 space-y-2" style={box}>
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={state === "busy"} onClick={share}>{state === "busy" ? "Making their pages…" : state === "err" ? "Couldn't share; tap to try again" : `📣 Share these ${items.length} finds`}</button>
      <p className="text-sm text-center">🔒 <b>Private.</b> No name, no email, no address, no location. People only see the items, their photos and what they&apos;re worth.</p>
      <p className="text-xs muted text-center">Each one gets its own page that people searching Google can find. It helps the next person with the same thing.</p>
      <label className="flex items-center justify-center gap-2 text-xs"><input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} /> Include the photos</label>
    </div>
  );
}
