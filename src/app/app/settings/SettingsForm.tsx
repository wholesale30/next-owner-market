"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsForm({ business, tiers }: { business: Record<string, string>; tiers: Record<string, number> }) {
  const router = useRouter();
  const [b, setB] = useState({ name: "", tagline: "", location: "", contact_phone: "", contact_email: "", alert_to: "", photo_bg: "#ffffff", ...business });
  const [t, setT] = useState({ full_service: 40, full_service_under_50: 50, drop_off: 30, self_listed: 15, ...tiers });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const r1 = await supabase.from("settings").upsert({ key: "business", value: b, updated_at: new Date().toISOString() });
    const r2 = await supabase.from("settings").upsert({ key: "commission_tiers", value: { ...t, owned: 0 }, updated_at: new Date().toISOString() });
    setBusy(false);
    setMsg(r1.error?.message || r2.error?.message || "Saved.");
    router.refresh();
  }

  const num = (k: keyof typeof t) => (
    <div key={k}><label className="label">{k.replace(/_/g, " ")} %</label><input className="input" type="number" inputMode="decimal" value={t[k]} onChange={(e) => setT({ ...t, [k]: Number(e.target.value) })} /></div>
  );

  return (
    <div className="space-y-4">
      <Link href="/app/people" className="text-sm muted">← Back</Link>
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Business</h2>
        <p className="text-xs muted">Shows on the store, listings, and tags. Phone and email power the &quot;Text about this&quot; buttons.</p>
        <div><label className="label">Business name</label><input className="input" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></div>
        <div><label className="label">Tagline</label><input className="input" value={b.tagline} onChange={(e) => setB({ ...b, tagline: e.target.value })} /></div>
        <div><label className="label">Location (city shown to buyers)</label><input className="input" value={b.location} onChange={(e) => setB({ ...b, location: e.target.value })} /></div>
        <div><label className="label">Contact phone (for texts)</label><input className="input" type="tel" value={b.contact_phone} onChange={(e) => setB({ ...b, contact_phone: e.target.value })} /></div>
        <div><label className="label">Contact email</label><input className="input" type="email" value={b.contact_email} onChange={(e) => setB({ ...b, contact_email: e.target.value })} /></div>
        <div><label className="label">Send staff alerts to</label><input className="input" placeholder="you@email.com, 4345551212@vtext.com" value={b.alert_to} onChange={(e) => setB({ ...b, alert_to: e.target.value })} /><p className="text-xs muted">New sellers, paid orders, problem reports. Comma-separate several. A phone&apos;s email-to-text address makes it a text: Verizon number@vtext.com, AT&amp;T number@txt.att.net, T-Mobile number@tmomail.net.</p></div>
        <div>
          <label className="label">Photo background (used when cleaning up photos)</label>
          <div className="flex gap-2 items-center">
            <input type="color" className="w-14 h-12 rounded" value={b.photo_bg || "#ffffff"} onChange={(e) => setB({ ...b, photo_bg: e.target.value })} />
            <input className="input" value={b.photo_bg || "#ffffff"} onChange={(e) => setB({ ...b, photo_bg: e.target.value })} />
            {[["#ffffff", "White"], ["#f4f4f2", "Off-white"], ["#e9ecef", "Light gray"]].map(([c, l]) => <button key={c} type="button" className="pill" onClick={() => setB({ ...b, photo_bg: c })}>{l}</button>)}
          </div>
          <p className="text-xs muted mt-1">Keep it light. Marketplaces and buyers trust a clean, plain background.</p>
        </div>
      </section>
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Commission tiers</h2>
        <p className="text-xs muted">Charged on sale price only, never on shipping. Per-consignor and per-item overrides win over these.</p>
        <div className="grid grid-cols-2 gap-2">
          {(["full_service", "full_service_under_50", "drop_off", "self_listed"] as const).map(num)}
        </div>
      </section>
      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn btn-primary w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
    </div>
  );
}
