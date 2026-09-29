"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Slot { id: string; starts_at: string; ends_at: string; capacity: number; taken: number }

const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function BuyerPanel({ itemId, sku, title, canPickup }: { itemId: string; sku: string; title: string; canPickup: boolean }) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ slot_id: "", buyer_name: "", buyer_contact: "", notes: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (user) {
        const { data } = await supabase.from("favorites").select("item_id").eq("item_id", itemId).maybeSingle();
        setFav(!!data);
        const { data: prof } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).maybeSingle();
        if (prof) setF((x) => ({ ...x, buyer_name: prof.full_name || "", buyer_contact: prof.phone || prof.email || "" }));
      }
      if (canPickup) {
        const { data: s } = await supabase.from("pickup_slots").select("*").gte("starts_at", new Date().toISOString()).order("starts_at").limit(40);
        const { data: taken } = await supabase.from("pickups").select("slot_id").in("slot_id", (s || []).map((x) => x.id)).neq("status", "cancelled");
        const count = new Map<string, number>();
        for (const t of taken || []) if (t.slot_id) count.set(t.slot_id, (count.get(t.slot_id) || 0) + 1);
        setSlots((s || []).map((x) => ({ ...x, taken: count.get(x.id) || 0 })).filter((x) => x.taken < x.capacity));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function toggleFav() {
    if (!userId) { window.location.href = `/login?next=/item/${sku}`; return; }
    if (fav) await supabase.from("favorites").delete().eq("item_id", itemId).eq("profile_id", userId);
    else await supabase.from("favorites").insert({ item_id: itemId, profile_id: userId });
    setFav(!fav);
  }

  async function requestPickup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("pickups").insert({ item_id: itemId, slot_id: f.slot_id || null, buyer_name: f.buyer_name, buyer_contact: f.buyer_contact, notes: f.notes || null });
    setBusy(false);
    if (error) return alert(error.message);
    setDone(true);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button className="btn btn-secondary flex-1" onClick={toggleFav}>{fav ? "♥ Saved" : "♡ Save"}</button>
        {canPickup && <button className="btn btn-secondary flex-1" onClick={() => setOpen(!open)}>📅 Schedule pickup</button>}
      </div>
      {open && (
        <form onSubmit={requestPickup} className="card p-3 space-y-2 text-sm">
          {done ? (
            <p>Request sent. We&apos;ll confirm by text or email.</p>
          ) : (
            <>
              <p className="font-semibold">Pick a time to come by for &quot;{title}&quot;</p>
              {slots.length ? (
                <select className="input" value={f.slot_id} onChange={(e) => setF({ ...f, slot_id: e.target.value })} required>
                  <option value="">Choose a time…</option>
                  {slots.map((s) => <option key={s.id} value={s.id}>{fmt(s.starts_at)}</option>)}
                </select>
              ) : (
                <p className="muted">No open time slots right now. Send the request anyway and we&apos;ll work out a time.</p>
              )}
              <input className="input" placeholder="Your name" value={f.buyer_name} onChange={(e) => setF({ ...f, buyer_name: e.target.value })} required />
              <input className="input" placeholder="Phone or email" value={f.buyer_contact} onChange={(e) => setF({ ...f, buyer_contact: e.target.value })} required />
              <input className="input" placeholder="Note (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Request pickup"}</button>
            </>
          )}
        </form>
      )}
      {!userId && <p className="text-xs muted text-center"><Link href={`/signup?buyer=1&next=/item/${sku}`} className="underline">Create a free account</Link> to save items and get alerts when what you want shows up.</p>}
    </div>
  );
}
