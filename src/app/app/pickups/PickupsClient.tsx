"use client";

import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Slot { id: string; starts_at: string; ends_at: string; capacity: number }
interface Pickup { id: string; buyer_name: string; buyer_contact: string; status: string; notes: string | null; created_at: string; order_id?: string | null; items: { sku: string; title: string } | null; pickup_slots: { starts_at: string; ends_at: string } | null }

const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function PickupsClient({ slots, pickups }: { slots: Slot[]; pickups: Pickup[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("16:00");
  const [len, setLen] = useState(30);
  const [cap, setCap] = useState(2);
  const [busy, setBusy] = useState(false);

  async function makeSlots(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setBusy(true);
    const rows: { starts_at: string; ends_at: string; capacity: number }[] = [];
    let t = new Date(`${date}T${from}`);
    const end = new Date(`${date}T${to}`);
    while (t < end) {
      const e2 = new Date(t.getTime() + len * 60000);
      rows.push({ starts_at: t.toISOString(), ends_at: e2.toISOString(), capacity: cap });
      t = e2;
    }
    const { error } = await supabase.from("pickup_slots").insert(rows);
    setBusy(false);
    if (error) alert(error.message);
    router.refresh();
  }
  async function setStatus(id: string, status: string) {
    await supabase.from("pickups").update({ status }).eq("id", id);
    router.refresh();
  }
  async function delSlot(id: string) {
    if (!confirm("Remove this slot?")) return;
    await supabase.from("pickup_slots").delete().eq("id", id);
    router.refresh();
  }

  const bySlot = new Map<string, number>();
  for (const p of pickups) if (p.pickup_slots && p.status !== "cancelled") bySlot.set(p.pickup_slots.starts_at, (bySlot.get(p.pickup_slots.starts_at) || 0) + 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Pickups</h1>
        <p className="muted text-sm">Open time windows at the warehouse. Buyers pick a slot from the item page instead of texting &quot;when can I come?&quot;</p>
      </div>

      <form onSubmit={makeSlots} className="card p-3 space-y-2">
        <p className="font-semibold text-sm">Open a day</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3"><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label className="label">From</label><input className="input" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input className="input" type="time" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><label className="label">Slot min</label><input className="input" type="number" value={len} onChange={(e) => setLen(Number(e.target.value))} /></div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><label className="label">People per slot</label><input className="input" type="number" value={cap} onChange={(e) => setCap(Number(e.target.value))} /></div>
          <button className="btn btn-primary" disabled={busy}>Create slots</button>
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Requests</h2>
        {!pickups.length && <p className="muted text-sm">None yet.</p>}
        {pickups.map((p) => (
          <div key={p.id} className="card p-3 text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <p className="font-semibold">{p.buyer_name} <span className="muted font-normal">• {p.buyer_contact}</span></p>
              <span className={`pill ${p.status === "confirmed" ? "pill-active" : p.status === "completed" ? "pill-sold" : ""}`}>{p.status}</span>
            </div>
            <p>{p.items ? `${p.items.title} (${p.items.sku})` : "General pickup"}{p.order_id && <> • <Link href={`/account/orders/${p.order_id}`} className="underline">paid order, enter code there</Link></>}</p>
            <p className="muted">{p.pickup_slots ? fmt(p.pickup_slots.starts_at) : "no slot"}{p.notes ? ` • ${p.notes}` : ""}</p>
            <div className="flex gap-1 flex-wrap">
              {p.status === "requested" && <button className="pill pill-active" onClick={() => setStatus(p.id, "confirmed")}>Confirm</button>}
              {p.status !== "completed" && <button className="pill" onClick={() => setStatus(p.id, "completed")}>Picked up</button>}
              {p.status !== "no_show" && <button className="pill" onClick={() => setStatus(p.id, "no_show")}>No-show</button>}
              <button className="pill" onClick={() => setStatus(p.id, "cancelled")}>Cancel</button>
              {/^[\d\s()+-]{7,}$/.test(p.buyer_contact) ? <a className="pill" href={`sms:${p.buyer_contact.replace(/\s/g, "")}`}>Text</a> : <a className="pill" href={`mailto:${p.buyer_contact}`}>Email</a>}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Open slots</h2>
        {!slots.length && <p className="muted text-sm">No upcoming slots.</p>}
        <div className="grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <div key={s.id} className="card p-2 text-sm flex justify-between items-center">
              <span>{fmt(s.starts_at)} <span className="muted">({bySlot.get(s.starts_at) || 0}/{s.capacity})</span></span>
              <button className="muted" onClick={() => delSlot(s.id)}>×</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
