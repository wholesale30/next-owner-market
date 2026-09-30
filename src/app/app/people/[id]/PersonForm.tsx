"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CompPro from "./CompPro";
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
    city: person.city || "", state: person.state || "", zip: person.zip || "",
    suspended: !!person.suspended, plan: person.plan || "free", ai_credits: String(person.ai_credits ?? 3),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc("staff_update_profile", { p_id: person.id, p_patch: {
      role: p.role, approved: p.approved, default_tier: p.default_tier,
      default_commission_pct: p.default_commission_pct || "", business_name: p.business_name || "", phone: p.phone || "", notes: p.notes || "",
      city: p.city || "", state: p.state || "", zip: p.zip || "", suspended: p.suspended, plan: p.plan, ai_credits: Number(p.ai_credits || 0),
    } });
    if (!error) fetch("/api/geo/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: person.id }) }).catch(() => {});
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

      <CompPro id={person.id} comped={!!(person as unknown as { comped?: boolean }).comped} until={(person as unknown as { comped_until?: string | null }).comped_until ?? null} note={(person as unknown as { comped_note?: string | null }).comped_note ?? null} />
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
          <div><label className="label">Plan</label><select className="input" value={p.plan} onChange={(e) => setP({ ...p, plan: e.target.value as "free" | "pro" })}><option value="free">Free</option><option value="pro">Pro (comped)</option></select></div>
          <div><label className="label">AI credits</label><input className="input" type="number" value={p.ai_credits} onChange={(e) => setP({ ...p, ai_credits: e.target.value })} /></div>
          <div><label className="label">Suspended</label><select className="input" value={p.suspended ? "yes" : "no"} onChange={(e) => setP({ ...p, suspended: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes (cannot list or sell)</option></select></div>
          <div>
            <label className="label">Default consignment tier</label>
            <select className="input" value={p.default_tier} onChange={(e) => setP({ ...p, default_tier: e.target.value as Tier })}>
              {(["full_service", "drop_off", "self_listed"] as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
            </select>
          </div>
          <div><label className="label">Commission % (blank = tier default)</label><input className="input" type="number" inputMode="decimal" value={p.default_commission_pct} onChange={(e) => setP({ ...p, default_commission_pct: e.target.value })} /></div>
          <div><label className="label">Business name</label><input className="input" value={p.business_name} onChange={(e) => setP({ ...p, business_name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2"><div className="col-span-2"><label className="label">City</label><input className="input" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} /></div><div><label className="label">State</label><input className="input" maxLength={2} value={p.state} onChange={(e) => setP({ ...p, state: e.target.value.toUpperCase() })} /></div></div>
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
