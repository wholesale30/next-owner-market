"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** ✏️ Edit right on the Relist list / Next post page (owner, Oct 23, 2026): title, price, description, town. */
export type Ship = { ok: boolean; lbs: number | null; l: number | null; w: number | null; h: number | null; source?: string | null };
export type Editable = { title: string; price: number | null; description: string; location: string | null; ship?: Ship };

/** 📦 shipping in one line for the card (owner, Oct 25, 2026). Facebook ships packages up to 70 lb. */
export function shipLine(s: Ship) {
  if (!s.ok) return "🚚 Pickup only";
  const size = s.l && s.w && s.h ? ` · box ${s.l}×${s.w}×${s.h} in` : "";
  return `📦 Ships · ${s.lbs ?? "?"} lb packed${size}${s.lbs && s.lbs > 70 ? " ⚠ over Facebook's 70 lb limit" : ""}`;
}
// nearest of the site's box sizes, so the website's own checkout quotes it right too
const boxFor = (l: number, w: number, h: number) => { const d = [l, w, h].sort((a, b) => b - a); return d[0] <= 10 && d[1] <= 8 && d[2] <= 4 ? "small" : d[0] <= 14 && d[1] <= 12 && d[2] <= 8 ? "medium" : d[0] <= 20 && d[1] <= 16 && d[2] <= 12 ? "large" : "xl"; };
const num = (x: string) => { const n = Number(x.replace(/[^0-9.]/g, "")); return x.trim() && n > 0 ? n : null; };

export default function EditBox({ id, value, onSaved }: { id: string; value: Editable; onSaved: (v: Editable) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: value.title, price: value.price ? String(Math.round(Number(value.price))) : "", description: value.description, location: value.location || "", shipOk: !!value.ship?.ok, lbs: value.ship?.lbs != null ? String(value.ship.lbs) : "", l: value.ship?.l != null ? String(value.ship.l) : "", w: value.ship?.w != null ? String(value.ship.w) : "", h: value.ship?.h != null ? String(value.ship.h) : "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    // a price must be one clean number ("4500", "$4,500", "4500.00"); anything else is refused, never guessed
    const raw = v.price.replace(/[$,\s]/g, "");
    if (raw && !/^\d+(\.\d{1,2})?$/.test(raw)) { setMsg(`⚠ "${v.price}" isn't a price. Clear the box and type just the number, like 4500.`); return; }
    setBusy(true);
    const ship: Ship = { ok: v.shipOk, lbs: num(v.lbs), l: num(v.l), w: num(v.w), h: num(v.h), source: value.ship?.source || null };
    if (ship.ok && !ship.lbs) { setMsg("⚠ Type the packed weight (lb) for shipping, or tap 🚚 Pickup only."); return; }
    const next: Editable = { title: v.title.trim(), price: raw ? Math.round(Number(raw)) || null : null, description: v.description.trim(), location: v.location.trim() || null, ship };
    const { error } = await supabase.from("items").update({ title: next.title, price: next.price, my_price: next.price, description: next.description, fb_location: next.location,
      shipping_ok: ship.ok, weight_lbs: ship.lbs, ship_l: ship.l, ship_w: ship.w, ship_h: ship.h, ...(ship.ok && ship.l && ship.w && ship.h ? { box: boxFor(ship.l, ship.w, ship.h) } : {}) }).eq("id", id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`✓ Saved${next.price ? `: price $${next.price.toLocaleString()}` : ""}`);
    onSaved(next);
    setTimeout(() => { setMsg(""); setOpen(false); }, 900);
  }

  if (!open) return <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(true)}>✏️ Edit price, title, description, town, shipping</button>;
  return (
    <div className="space-y-2 card p-2">
      <label className="block text-sm font-semibold">Price<input className="input" inputMode="numeric" value={v.price} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, price: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Title<input className="input" value={v.title} maxLength={100} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Town (where it is)<input className="input" value={v.location} placeholder="Floyd, Richmond, Cumberland…" onChange={(e) => setV({ ...v, location: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Description<textarea className="input" rows={7} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Shipping</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`pill ${v.shipOk ? "font-bold" : ""}`} onClick={() => setV({ ...v, shipOk: true })}>{v.shipOk ? "✓ " : ""}📦 Ships</button>
          <button type="button" className={`pill ${!v.shipOk ? "font-bold" : ""}`} onClick={() => setV({ ...v, shipOk: false })}>{!v.shipOk ? "✓ " : ""}🚚 Pickup only</button>
        </div>
        {v.shipOk && (
          <div className="grid grid-cols-4 gap-1">
            <label className="text-xs">Lb packed<input className="input" inputMode="decimal" value={v.lbs} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, lbs: e.target.value })} /></label>
            <label className="text-xs">Box L in<input className="input" inputMode="decimal" value={v.l} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, l: e.target.value })} /></label>
            <label className="text-xs">W in<input className="input" inputMode="decimal" value={v.w} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, w: e.target.value })} /></label>
            <label className="text-xs">H in<input className="input" inputMode="decimal" value={v.h} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, h: e.target.value })} /></label>
          </div>
        )}
        {v.shipOk && value.ship?.source && <p className="text-xs muted">Weight from: <a className="underline" href={value.ship.source} target="_blank" rel="noreferrer">spec page</a></p>}
        {v.shipOk && num(v.lbs) && num(v.lbs)! > 70 && <p className="text-xs">⚠ Over 70 lb: Facebook won&apos;t ship it. Pickup only is safer.</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "💾 Save"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <p className="text-sm text-center">{msg}</p>}
    </div>
  );
}
