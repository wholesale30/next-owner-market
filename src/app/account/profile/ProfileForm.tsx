"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Me { id: string; email: string | null; full_name: string | null; phone: string | null; business_name: string | null; city: string; state: string; zip: string; address1: string; address2: string; role: string; referral_code: string; plan: string; created_at: string }

export default function ProfileForm({ me }: { me: Me }) {
  const router = useRouter();
  const supabase = createClient();
  const seller = me.role !== "buyer";
  const [p, setP] = useState({ full_name: me.full_name || "", phone: me.phone || "", business_name: me.business_name || "", city: me.city, state: me.state, zip: me.zip, address1: me.address1, address2: me.address2 });
  const [pw, setPw] = useState({ a: "", b: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({ full_name: p.full_name || null, phone: p.phone || null, business_name: seller ? p.business_name || null : undefined, city: p.city || null, state: p.state || null, zip: p.zip || null, address1: p.address1 || null, address2: p.address2 || null }).eq("id", me.id);
    if (!error) await fetch("/api/geo/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    setBusy(false);
    setMsg(error ? error.message : "Saved.");
    router.refresh();
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.a.length < 8) return setPwMsg("At least 8 characters.");
    if (pw.a !== pw.b) return setPwMsg("They don't match.");
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    setPwMsg(error ? error.message : "Password changed.");
    if (!error) setPw({ a: "", b: "" });
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My profile</h1>
        <p className="muted text-sm">{me.email} • {seller ? (me.role === "consignor" ? "Seller" : "Staff") : "Buyer"} account{seller ? ` • ${me.plan === "pro" ? "Pro" : "Free plan"}` : ""} • member since {new Date(me.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}</p>
      </div>
      {seller && (
        <div className="flex gap-2 flex-wrap">
          <Link href="/app" className="btn btn-secondary">📦 My listings</Link>
          <Link href={`/seller/${me.id}`} className="btn btn-secondary">👁 My public seller page</Link>
          <Link href="/app/money" className="btn btn-secondary">💵 Payouts & plan</Link>
        </div>
      )}
      <form onSubmit={save} className="card p-4 space-y-3">
        <div><label className="label">Name</label><input className="input" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
        {seller && <div><label className="label">Business or shop name (shown to buyers instead of your name)</label><input className="input" value={p.business_name} onChange={(e) => setP({ ...p, business_name: e.target.value })} /></div>}
        <div><label className="label">Email</label><input className="input" value={me.email || ""} disabled /><p className="text-xs muted">To change your email, message us; it&apos;s tied to your sign-in.</p></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2"><label className="label">City</label><input className="input" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} /></div>
          <div><label className="label">State</label><input className="input" maxLength={2} value={p.state} onChange={(e) => setP({ ...p, state: e.target.value.toUpperCase() })} /></div>
          <div><label className="label">ZIP</label><input className="input" maxLength={5} inputMode="numeric" value={p.zip} onChange={async (e) => { const zip = e.target.value; setP({ ...p, zip }); if (zip.length === 5) { const g = await fetch(`/api/geo?zip=${zip}`).then((r) => r.json()).catch(() => null); if (g?.ok) setP((q) => ({ ...q, zip, city: q.city || g.city, state: q.state || g.state })); } }} /></div>
        </div>
        <p className="text-xs muted">City and state show on your listings so buyers know where pickup is. Everything else stays private.</p>
        {seller && (
          <>
            <div><label className="label">Street address (for shipping labels only; never shown)</label><input className="input" value={p.address1} onChange={(e) => setP({ ...p, address1: e.target.value })} /></div>
            <div><label className="label">Apt / suite</label><input className="input" value={p.address2} onChange={(e) => setP({ ...p, address2: e.target.value })} /></div>
          </>
        )}
        <div className="flex items-center gap-2"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>{msg && <span className="text-sm muted">{msg}</span>}</div>
      </form>
      <form onSubmit={changePw} className="card p-4 space-y-3">
        <p className="font-semibold">Change password</p>
        <div><label className="label">New password</label><input className="input" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></div>
        <div><label className="label">Again</label><input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></div>
        <div className="flex items-center gap-2"><button className="btn btn-secondary">Change password</button>{pwMsg && <span className="text-sm muted">{pwMsg}</span>}</div>
      </form>
      {seller && <p className="text-xs muted">Your referral link: nextownermarket.com/signup?ref={me.referral_code}</p>}
    </div>
  );
}
