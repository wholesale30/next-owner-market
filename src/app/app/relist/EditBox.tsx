"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** ✏️ Edit right on the Relist list / Next post page (owner, Oct 23, 2026): title, price, description, town. */
export type Editable = { title: string; price: number | null; description: string; location: string | null };

export default function EditBox({ id, value, onSaved }: { id: string; value: Editable; onSaved: (v: Editable) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: value.title, price: value.price ? String(Math.round(Number(value.price))) : "", description: value.description, location: value.location || "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    // a price must be one clean number ("4500", "$4,500", "4500.00"); anything else is refused, never guessed
    const raw = v.price.replace(/[$,\s]/g, "");
    if (raw && !/^\d+(\.\d{1,2})?$/.test(raw)) { setMsg(`⚠ "${v.price}" isn't a price. Clear the box and type just the number, like 4500.`); return; }
    setBusy(true);
    const next: Editable = { title: v.title.trim(), price: raw ? Math.round(Number(raw)) || null : null, description: v.description.trim(), location: v.location.trim() || null };
    const { error } = await supabase.from("items").update({ title: next.title, price: next.price, my_price: next.price, description: next.description, fb_location: next.location }).eq("id", id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`✓ Saved${next.price ? `: price $${next.price.toLocaleString()}` : ""}`);
    onSaved(next);
    setTimeout(() => { setMsg(""); setOpen(false); }, 900);
  }

  if (!open) return <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(true)}>✏️ Edit price, title, description, town</button>;
  return (
    <div className="space-y-2 card p-2">
      <label className="block text-sm font-semibold">Price<input className="input" inputMode="numeric" value={v.price} onFocus={(e) => e.target.select()} onChange={(e) => setV({ ...v, price: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Title<input className="input" value={v.title} maxLength={100} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Town (where it is)<input className="input" value={v.location} placeholder="Floyd, Richmond, Cumberland…" onChange={(e) => setV({ ...v, location: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Description<textarea className="input" rows={7} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "💾 Save"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <p className="text-sm text-center">{msg}</p>}
    </div>
  );
}
