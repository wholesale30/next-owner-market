"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Inv = { code: string; label: string | null; months: number | null; max_uses: number; uses: number; active: boolean; created_at: string };

export default function InvitesClient({ invites, site, meId }: { invites: Inv[]; site: string; meId: string }) {
  const router = useRouter();
  const sb = createClient();
  const [f, setF] = useState({ code: "", label: "", months: "", max_uses: "1" });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const code = (f.code || Math.random().toString(36).slice(2, 8)).toLowerCase().replace(/[^a-z0-9-]/g, "");
    const { error } = await sb.from("invites").insert({ code, label: f.label || null, months: f.months ? Number(f.months) : null, max_uses: Number(f.max_uses) || 1, created_by: meId });
    setBusy(false);
    if (error) return alert(/duplicate/i.test(error.message) ? "That code is already used. Pick another." : error.message);
    setF({ code: "", label: "", months: "", max_uses: "1" });
    router.refresh();
  }
  async function toggle(code: string, active: boolean) { await sb.from("invites").update({ active }).eq("code", code); router.refresh(); }
  async function share(code: string) {
    const link = `${site}/signup?invite=${code}`;
    const text = `You're invited to Next Owner Market Pro, free. Take a photo, the AI writes the listing for eBay, Facebook, Poshmark and six more, and it lists in the store free. Sign up here: ${link}`;
    try { if (navigator.share) await navigator.share({ title: "Free Pro invite", text, url: link }); else { await navigator.clipboard.writeText(link); setCopied(code); setTimeout(() => setCopied(null), 1500); } } catch { /* cancelled */ }
  }
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">🎁 Free Pro invites</h1><p className="muted text-sm">Make a link, send it to family, friends, or anyone you want on the site. Whoever signs up with it gets Pro free: unlimited AI listings, all nine marketplaces, Snap, video, and they&apos;re an approved seller from the start.</p></div>
      <form onSubmit={create} className="card p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Code (or leave blank)</label><input className="input" placeholder="family" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div><label className="label">Who&apos;s it for</label><input className="input" placeholder="Mom, church group…" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div><label className="label">How long</label><select className="input" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}><option value="">Forever</option><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">1 year</option></select></div>
          <div><label className="label">How many people can use it</label><input className="input" type="number" min={1} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>Make the link</button>
      </form>
      {invites.map((i) => (
        <div key={i.code} className="card p-3 space-y-2 text-sm" style={!i.active ? { opacity: .55 } : undefined}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="font-bold">{i.label || i.code} <span className="muted font-normal">· {i.months ? `${i.months} mo` : "forever"} · {i.uses}/{i.max_uses} used</span></p><p className="font-mono text-xs break-all">{site}/signup?invite={i.code}</p></div>
            <span className={`pill ${i.active && i.uses < i.max_uses ? "pill-active" : "pill-sold"}`}>{!i.active ? "Off" : i.uses >= i.max_uses ? "Used up" : "Live"}</span>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => share(i.code)}>{copied === i.code ? "Copied!" : "Share link"}</button>
            <button className="btn btn-secondary" onClick={() => toggle(i.code, !i.active)}>{i.active ? "Turn off" : "Turn on"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
