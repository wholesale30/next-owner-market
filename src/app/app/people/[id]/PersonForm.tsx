"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";
import { STATUS_LABELS, TIER_LABELS, type Profile, type ItemStatus, type Tier } from "@/lib/types";

interface Props {
  person: Profile & { notes: string | null };
  items: { id: string; sku: string; title: string; status: ItemStatus; price: number | null }[];
  isAdmin: boolean;
}

export default function PersonForm({ person, items, isAdmin }: Props) {
  const router = useRouter();
  const [p, setP] = useState({
    role: person.role,
    approved: person.approved,
    default_tier: person.default_tier || "drop_off",
    default_commission_pct: person.default_commission_pct != null ? String(person.default_commission_pct) : "",
    business_name: person.business_name || "",
    phone: person.phone || "",
    notes: person.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from("profiles").update({
      role: p.role,
      approved: p.approved,
      default_tier: p.default_tier,
      default_commission_pct: p.default_commission_pct ? Number(p.default_commission_pct) : null,
      business_name: p.business_name || null,
      phone: p.phone || null,
      notes: p.notes || null,
    }).eq("id", person.id);
    setBusy(false);
    setMsg(error ? error.message : "Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Link href="/app/people" className="text-sm muted">← People</Link>
      <div>
        <h1 className="text-2xl font-bold">{person.business_name || person.full_name || person.email}</h1>
        <p className="muted text-sm">{person.email} {person.phone}</p>
        <p className="text-xs muted mt-1">Referral code: <span className="font-mono">{person.referral_code}</span></p>
      </div>

      <div className="card p-4 space-y-3">
        {p.role === "consignor" && !p.approved && (
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => { setP({ ...p, approved: true }); setTimeout(save, 0); }}>✅ Approve this consignor</button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Role</label>
            <select className="input" value={p.role} disabled={!isAdmin} onChange={(e) => setP({ ...p, role: e.target.value as Profile["role"] })}>
              {["buyer", "consignor", "staff", "admin"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Approved</label>
            <select className="input" value={p.approved ? "yes" : "no"} onChange={(e) => setP({ ...p, approved: e.target.value === "yes" })}>
              <option value="yes">Yes</option><option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="label">Default consignment tier</label>
            <select className="input" value={p.default_tier} onChange={(e) => setP({ ...p, default_tier: e.target.value as Tier })}>
              {(["full_service", "drop_off", "self_listed"] as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
            </select>
          </div>
          <div><label className="label">Commission % (blank = tier default)</label><input className="input" type="number" inputMode="decimal" value={p.default_commission_pct} onChange={(e) => setP({ ...p, default_commission_pct: e.target.value })} /></div>
          <div><label className="label">Business name</label><input className="input" value={p.business_name} onChange={(e) => setP({ ...p, business_name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
        </div>
        <div><label className="label">Private notes</label><textarea className="input" rows={2} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} /></div>
        {msg && <p className="text-sm">{msg}</p>}
        <button className="btn btn-primary w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Their items ({items.length})</h2>
        {items.map((it) => (
          <Link key={it.id} href={`/app/items/${it.id}`} className="card p-3 flex justify-between text-sm">
            <span className="truncate">{it.title || it.sku}</span>
            <span className="shrink-0">{money(it.price)} • {STATUS_LABELS[it.status]}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
