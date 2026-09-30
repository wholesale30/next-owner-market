"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Slot { id: string; starts_at: string; ends_at: string; capacity: number; taken: number }
const fmt = (s: Slot) => `${new Date(s.starts_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}–${new Date(s.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

/** Warehouse pickup: buyer picks an open slot on a paid order. Auto-confirmed. */
export default function PickupPicker({ orderId, booked }: { orderId: string; booked: { starts_at: string; ends_at: string } | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [change, setChange] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("pickup_slots").select("*").gte("starts_at", new Date().toISOString()).order("starts_at").limit(40);
      const { data: taken } = await supabase.from("pickups").select("slot_id").in("slot_id", (s || []).map((x) => x.id)).in("status", ["requested", "confirmed"]);
      const count = new Map<string, number>();
      for (const t of taken || []) if (t.slot_id) count.set(t.slot_id, (count.get(t.slot_id) || 0) + 1);
      setSlots((s || []).map((x) => ({ ...x, taken: count.get(x.id) || 0 })).filter((x) => x.taken < x.capacity));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
  async function book() {
    setBusy(true); setErr(null);
    const { data: pid, error } = await supabase.rpc("book_pickup", { p_order: orderId, p_slot: slot, p_note: note || null });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    fetch("/api/pickups/booked", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pickupId: pid }) }).catch(() => {});
    setChange(false);
    router.refresh();
  }
  if (booked && !change) {
    return <div className="card p-3 text-sm"><p>📅 <b>Pickup booked:</b> {fmt({ ...booked, id: "", capacity: 0, taken: 0 })}</p><button className="pill mt-1" onClick={() => setChange(true)}>Change time</button></div>;
  }
  return (
    <div className="card p-3 space-y-2 text-sm">
      <p className="font-semibold">📅 Pick a time to come get it</p>
      {slots.length ? (
        <>
          <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Choose a time…</option>{slots.map((s) => <option key={s.id} value={s.id}>{fmt(s)}</option>)}</select>
          <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={busy || !slot} onClick={book}>{busy ? "Booking…" : "Book it"}</button>
          <p className="text-[11px] muted">Booked on the spot; you get a confirmation email with the address and your code.</p>
        </>
      ) : (
        <p className="muted">No open times posted right now. Tap <b>Message the seller</b> below and suggest a couple of times; we&apos;ll reply with what works.</p>
      )}
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
