"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { billedLbs, fbRisky, OFFSITE_LINE } from "@/lib/fbship";
export { billedLbs, fbRisky, OFFSITE_LINE };

/** ✏️ Edit right on the Relist list / Next post page (owner, Oct 23, 2026): title, price, description, town, shipping. */
// How it goes out (owner, Oct 26, 2026): he picks per item. none = pickup only; fb = Facebook prepaid label
// (Facebook asks only the weight, charges every buyer one price, and bills the seller if the box is bigger);
// offsite = pickup only on Facebook + "I can ship, buyer pays the real cost, message me" in the description.
export type ShipMode = "none" | "fb" | "offsite";
export type Ship = { ok: boolean; mode?: ShipMode; lbs: number | null; l: number | null; w: number | null; h: number | null; source?: string | null };
export type Editable = { title: string; price: number | null; description: string; location: string | null; ship?: Ship };


/** 📦 shipping in one line for the card */
export function shipLine(s: Ship) {
  const mode = s.mode || "none";
  const size = s.l && s.w && s.h ? ` · box ${s.l}×${s.w}×${s.h} in` : "";
  const facts = `${s.lbs ?? "?"} lb${size}`;
  const warn = s.lbs && fbRisky(s) ? ` ⚠ post office bills it as ${billedLbs(s)} lb` : "";
  if (mode === "fb") return `📦 Facebook shipping · ${facts}${warn}`;
  if (mode === "offsite") return `✉️ Pickup on Facebook, I ship it myself (buyer pays) · ${facts}`;
  return `🚚 Pickup only${s.lbs ? ` · ${facts}${s.lbs <= 70 && !fbRisky(s) ? " · ✓ fits Facebook shipping" : ""}` : ""}`;
}
// nearest of the site's box sizes, so the website's own checkout quotes it right too
const boxFor = (l: number, w: number, h: number) => { const d = [l, w, h].sort((a, b) => b - a); return d[0] <= 10 && d[1] <= 8 && d[2] <= 4 ? "small" : d[0] <= 14 && d[1] <= 12 && d[2] <= 8 ? "medium" : d[0] <= 20 && d[1] <= 16 && d[2] <= 12 ? "large" : "xl"; };
const num = (x: string) => { const n = Number(x.replace(/[^0-9.]/g, "")); return x.trim() && n > 0 ? n : null; };

export default function EditBox({ id, value, onSaved }: { id: string; value: Editable; onSaved: (v: Editable) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: value.title, price: value.price ? String(Math.round(Number(value.price))) : "", description: value.description, location: value.location || "", mode: (value.ship?.mode || "none") as ShipMode, lbs: value.ship?.lbs != null ? String(value.ship.lbs) : "", l: value.ship?.l != null ? String(value.ship.l) : "", w: value.ship?.w != null ? String(value.ship.w) : "", h: value.ship?.h != null ? String(value.ship.h) : "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    // a price must be one clean number ("4500", "$4,500", "4500.00"); anything else is refused, never guessed
    const raw = v.price.replace(/[$,\s]/g, "");
    if (raw && !/^\d+(\.\d{1,2})?$/.test(raw)) { setMsg(`⚠ "${v.price}" isn't a price. Clear the box and type just the number, like 4500.`); return; }
    setBusy(true);
    const ship: Ship = { ok: v.mode !== "none", mode: v.mode, lbs: num(v.lbs), l: num(v.l), w: num(v.w), h: num(v.h), source: value.ship?.source || null };
    if (ship.ok && !ship.lbs) { setBusy(false); setMsg("⚠ Type the packed weight (lb) for shipping, or tap 🚚 Pickup only."); return; }
    const next: Editable = { title: v.title.trim(), price: raw ? Math.round(Number(raw)) || null : null, description: v.description.trim(), location: v.location.trim() || null, ship };
    const { error } = await supabase.from("items").update({ title: next.title, price: next.price, my_price: next.price, description: next.description, fb_location: next.location,
      fb_ship: v.mode, shipping_ok: ship.ok, weight_lbs: ship.lbs, ship_l: ship.l, ship_w: ship.w, ship_h: ship.h, ...(ship.ok && ship.l && ship.w && ship.h ? { box: boxFor(ship.l, ship.w, ship.h) } : {}) }).eq("id", id);
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
        <div className="grid grid-cols-1 gap-1">
          {([["none", "🚚 Pickup only"], ["fb", "📦 Ship through Facebook (prepaid label)"], ["offsite", "✉️ Pickup on Facebook, I ship it myself (buyer pays)"]] as [ShipMode, string][]).map(([m, label]) => (
            <button key={m} type="button" className={`pill text-left ${v.mode === m ? "font-bold" : ""}`} style={v.mode === m ? { borderColor: "var(--brand)" } : {}} onClick={() => setV({ ...v, mode: m })}>{v.mode === m ? "✓ " : ""}{label}</button>
          ))}
        </div>
        {v.mode !== "none" && (
          <div className="grid grid-cols-4 gap-1">
            <label className="text-xs">Lb packed<input className="input" inputMode="decimal" value={v.lbs} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, lbs: e.target.value })} /></label>
            <label className="text-xs">Box L in<input className="input" inputMode="decimal" value={v.l} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, l: e.target.value })} /></label>
            <label className="text-xs">W in<input className="input" inputMode="decimal" value={v.w} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, w: e.target.value })} /></label>
            <label className="text-xs">H in<input className="input" inputMode="decimal" value={v.h} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, h: e.target.value })} /></label>
          </div>
        )}
        {v.mode !== "none" && value.ship?.source && <p className="text-xs muted">Weight from: <a className="underline" href={value.ship.source} target="_blank" rel="noreferrer">spec page</a></p>}
        {v.mode === "fb" && (() => { const t: Ship = { ok: true, lbs: num(v.lbs), l: num(v.l), w: num(v.w), h: num(v.h) }; return t.lbs && fbRisky(t)
          ? <p className="text-xs font-bold" style={{ color: "var(--danger)" }}>⚠ Facebook only asks the weight ({t.lbs} lb) and charges the buyer for that. The post office bills this box as {billedLbs(t)} lb{(t.lbs || 0) > 70 ? " and it&apos;s over the 70 lb limit" : ""}; Facebook&apos;s terms put the difference on you. Safer: ✉️ I ship it myself.</p>
          : t.lbs ? <p className="text-xs">✓ Box is small enough that Facebook&apos;s weight-only label should cover it.</p> : null; })()}
        {v.mode === "offsite" && <p className="text-xs muted">Posts as pickup only on Facebook, with this line added to the description: &quot;{OFFSITE_LINE}&quot; No 10% Facebook fee; you quote the real cost by ZIP and take payment before shipping.</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "💾 Save"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <p className="text-sm text-center">{msg}</p>}
    </div>
  );
}
