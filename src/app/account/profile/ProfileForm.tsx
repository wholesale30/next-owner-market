"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CARRIERS, smsAddress } from "@/lib/sms";
import UsernameField from "@/components/UsernameField";

interface Me { username: string | null; sms_gateway: string | null; alert_messages: boolean; alert_orders: boolean; id: string; email: string | null; full_name: string | null; phone: string | null; business_name: string | null; city: string; state: string; zip: string; address1: string; address2: string; role: string; referral_code: string; plan: string; created_at: string }

export default function ProfileForm({ me }: { me: Me }) {
  const router = useRouter();
  const supabase = createClient();
  const seller = me.role !== "buyer";
  const initialCarrier = CARRIERS.find((c) => me.sms_gateway?.endsWith("@" + c.gateway))?.key || "";
  const [al, setAl] = useState({ carrier: initialCarrier, on: !!me.sms_gateway, messages: me.alert_messages !== false, orders: me.alert_orders !== false });
  const [p, setP] = useState({ username: me.username || "", full_name: me.full_name || "", phone: me.phone || "", business_name: me.business_name || "", city: me.city, state: me.state, zip: me.zip, address1: me.address1, address2: me.address2 });
  const [pw, setPw] = useState({ a: "", b: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const gateway = al.on && al.carrier ? smsAddress(p.phone, al.carrier) : null;
    if (al.on && !gateway) { setBusy(false); return setMsg("For text alerts, enter a 10-digit phone number and pick your carrier."); }
    const { error } = await supabase.from("profiles").update({ username: p.username || null, full_name: p.full_name || null, phone: p.phone || null, business_name: seller ? p.business_name || null : undefined, city: p.city || null, state: p.state || null, zip: p.zip || null, address1: p.address1 || null, address2: p.address2 || null, sms_gateway: gateway, alert_messages: al.messages, alert_orders: al.orders }).eq("id", me.id);
    if (!error) await fetch("/api/geo/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    setBusy(false);
    setMsg(error ? (/username/i.test(error.message) ? "That username is taken or not allowed." : error.message) : "Saved.");
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
        <UsernameField value={p.username} onChange={(v) => setP({ ...p, username: v })} current={me.username || undefined} />
        <div><label className="label">Name (private)</label><input className="input" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
        {seller && <div><label className="label">Business or shop name (shown to buyers instead of your name)</label><input className="input" value={p.business_name} onChange={(e) => setP({ ...p, business_name: e.target.value })} /></div>}
        <div><label className="label">Email</label><input className="input" value={me.email || ""} disabled /><p className="text-xs muted">To change your email, message us; it&apos;s tied to your sign-in.</p></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>

        <div className="card p-3 space-y-2">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={al.on} onChange={(e) => setAl({ ...al, on: e.target.checked })} /> 📱 Text me (free) when something happens</label>
          {al.on && (
            <>
              <div><label className="label">Your phone carrier</label><select className="input" value={al.carrier} onChange={(e) => setAl({ ...al, carrier: e.target.value })}><option value="">Pick one…</option>{CARRIERS.map((c) => <option key={c.key} value={c.key}>{c.label}{c.dead ? " (texts not available)" : ""}</option>)}</select></div>
              {CARRIERS.find((c) => c.key === al.carrier)?.dead && <p className="text-sm" style={{ color: "var(--danger)" }}>{CARRIERS.find((c) => c.key === al.carrier)!.dead}, so we can&apos;t text you. You&apos;ll still get every alert by email.</p>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={al.messages} onChange={(e) => setAl({ ...al, messages: e.target.checked })} /> New message from a buyer</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={al.orders} onChange={(e) => setAl({ ...al, orders: e.target.checked })} /> Someone bought or made an offer</label>
              <p className="text-xs muted">Uses the phone number above. Texts come from our alert address; standard message rates from your carrier may apply. You always get email too.</p>
            </>
          )}
        </div>
        <div className="card p-3 space-y-2">
          <p className="font-semibold">📍 Your address</p>
          <div><label className="label">Street address</label><input className="input" autoComplete="address-line1" value={p.address1} onChange={(e) => setP({ ...p, address1: e.target.value })} /></div>
          <div><label className="label">Apt / suite (optional)</label><input className="input" autoComplete="address-line2" value={p.address2} onChange={(e) => setP({ ...p, address2: e.target.value })} /></div>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2"><label className="label">City</label><input className="input" autoComplete="address-level2" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} /></div>
            <div><label className="label">State</label><input className="input" maxLength={2} autoComplete="address-level1" value={p.state} onChange={(e) => setP({ ...p, state: e.target.value.toUpperCase() })} /></div>
            <div><label className="label">ZIP</label><input className="input" maxLength={5} inputMode="numeric" autoComplete="postal-code" value={p.zip} onChange={async (e) => { const zip = e.target.value; setP({ ...p, zip }); if (zip.length === 5) { const g = await fetch(`/api/geo?zip=${zip}`).then((r) => r.json()).catch(() => null); if (g?.ok) setP((q) => ({ ...q, zip, city: q.city || g.city, state: q.state || g.state })); } }} /></div>
          </div>
          <p className="text-xs muted">{seller ? "Only your city and state show on listings. The street address is used for shipping labels and the bill of sale; buyers never see it." : "Only city and state are ever shown (for \"near you\"). Street address is optional; it fills in your shipping address at checkout."}</p>
        </div>
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
