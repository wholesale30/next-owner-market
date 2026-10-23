"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** ✏️ Edit right on the Relist list / Next post page (owner, Oct 23, 2026): title, price, description, town. */
export type Editable = { title: string; price: number | null; description: string; location: string | null };

export default function EditBox({ id, value, onSaved }: { id: string; value: Editable; onSaved: (v: Editable) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: value.title, price: value.price ? String(value.price) : "", description: value.description, location: value.location || "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const next: Editable = { title: v.title.trim(), price: v.price ? Math.round(Number(v.price.replace(/[^0-9.]/g, ""))) || null : null, description: v.description.trim(), location: v.location.trim() || null };
    const { error } = await supabase.from("items").update({ title: next.title, price: next.price, description: next.description, fb_location: next.location }).eq("id", id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg("✓ Saved");
    onSaved(next);
    setTimeout(() => { setMsg(""); setOpen(false); }, 900);
  }

  if (!open) return <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(true)}>✏️ Edit price, title, description, town</button>;
  return (
    <div className="space-y-2 card p-2">
      <label className="block text-sm font-semibold">Price<input className="input" inputMode="numeric" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></label>
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
