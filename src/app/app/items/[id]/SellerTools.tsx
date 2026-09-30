"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HelpTip } from "@/components/Help";

export const MARKETS: { key: string; label: string; manage: string }[] = [
  { key: "facebook", label: "Facebook", manage: "https://www.facebook.com/marketplace/you/selling" },
  { key: "ebay", label: "eBay", manage: "https://www.ebay.com/sh/lst/active" },
  { key: "offerup", label: "OfferUp", manage: "https://offerup.com/accounts/myaccount/" },
  { key: "craigslist", label: "Craigslist", manage: "https://accounts.craigslist.org/login/home" },
  { key: "mercari", label: "Mercari", manage: "https://www.mercari.com/mypage/listings/" },
  { key: "poshmark", label: "Poshmark", manage: "https://poshmark.com/closet" },
  { key: "vinted", label: "Vinted", manage: "https://www.vinted.com/member/items" },
  { key: "depop", label: "Depop", manage: "https://www.depop.com/sellinghub/" },
  { key: "etsy", label: "Etsy", manage: "https://www.etsy.com/your/shops/me/tools/listings" },
];

type Stats = { view_count: number; save_count: number; message_count: number; offer_count: number } | null;

export default function SellerTools({ itemId, status, price, postedTo, stats, drop }: { itemId: string; status: string; price: number | null; postedTo: Record<string, string>; stats: Stats; drop: { pct: number | null; days: number | null; floor: number | null; last: string | null } }) {
  const router = useRouter();
  const supabase = createClient();
  const [posted, setPosted] = useState<Record<string, string>>(postedTo || {});
  const [d, setD] = useState({ pct: drop.pct ? String(drop.pct) : "", days: drop.days ? String(drop.days) : "", floor: drop.floor ? String(drop.floor) : "" });
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(key: string) {
    const next = { ...posted };
    if (next[key]) delete next[key]; else next[key] = new Date().toISOString();
    setPosted(next);
    await supabase.from("items").update({ posted_to: next }).eq("id", itemId);
  }
  async function saveDrop(v = d) {
    setBusy(true);
    const { error } = await supabase.from("items").update({ drop_pct: v.pct ? Number(v.pct) : null, drop_every_days: v.days ? Number(v.days) : null, drop_floor: v.floor ? Number(v.floor) : null }).eq("id", itemId);
    setBusy(false);
    setSaved(error ? error.message : "Saved");
    setTimeout(() => setSaved(null), 1500);
    router.refresh();
  }
  const elsewhere = MARKETS.filter((m) => posted[m.key]);
  const sold = status === "sold" || status === "shipped" || status === "reserved";
  const hot = stats && stats.view_count >= 20 && stats.message_count === 0 && stats.offer_count === 0 && status === "active";

  return (
    <div className="space-y-3 no-print">
      {stats && (
        <div className="card p-3">
          <div className="grid grid-cols-4 text-center">
            {[["Views", stats.view_count], ["Saved", stats.save_count], ["Messages", stats.message_count], ["Offers", stats.offer_count]].map(([l, n]) => (
              <div key={String(l)}><p className="text-xl font-extrabold">{n}</p><p className="text-xs muted">{l}</p></div>
            ))}
          </div>
          {hot && <p className="text-sm mt-2 p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>👀 People are looking but nobody&apos;s asking. A price drop of $5–10 usually gets the first message.</p>}
        </div>
      )}

      {sold && elsewhere.length > 0 && (
        <div className="card p-3 space-y-2" style={{ borderColor: "var(--danger)" }}>
          <p className="font-semibold">⚠ Take it down from {elsewhere.map((m) => m.label).join(", ")}</p>
          <p className="text-sm muted">It&apos;s sold here. Delete it on the other sites so you don&apos;t sell it twice. Tap to open your listings there, then tick it off.</p>
          <div className="flex gap-2 flex-wrap">
            {elsewhere.map((m) => (
              <a key={m.key} href={m.manage} target="_blank" rel="noreferrer" className="pill px-3 py-2" onClick={() => setTimeout(() => toggle(m.key), 500)}>{m.label} ↗</a>
            ))}
          </div>
        </div>
      )}

      {!sold && (
        <details className="card p-3">
          <summary className="font-semibold cursor-pointer flex items-center justify-between">
            <span>Also posted on {elsewhere.length ? elsewhere.map((m) => m.label).join(", ") : "…"}</span>
            <HelpTip topic="crosspost" />
          </summary>
          <p className="text-xs muted mt-1">Tick each site after you paste it there. When it sells anywhere, mark it sold here and we&apos;ll remind you to pull the others.</p>
          <div className="flex gap-2 flex-wrap mt-2">
            {MARKETS.map((m) => (
              <button key={m.key} type="button" className={`pill px-3 py-2 ${posted[m.key] ? "pill-active" : ""}`} onClick={() => toggle(m.key)}>{posted[m.key] ? "✓ " : ""}{m.label}</button>
            ))}
          </div>
        </details>
      )}

      {!sold && price != null && (
        <details className="card p-3" open={!!drop.pct}>
          <summary className="font-semibold cursor-pointer">📉 Drop the price automatically {drop.pct ? `(${drop.pct}% every ${drop.days} days)` : ""}</summary>
          <p className="text-xs muted mt-1">Set it and forget it. Every few days the price comes down a bit until it sells or hits your floor. Buyers who saved it get told.</p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div><label className="label">Drop %</label><input className="input" inputMode="numeric" placeholder="10" value={d.pct} onChange={(e) => setD({ ...d, pct: e.target.value })} /></div>
            <div><label className="label">Every (days)</label><input className="input" inputMode="numeric" placeholder="7" value={d.days} onChange={(e) => setD({ ...d, days: e.target.value })} /></div>
            <div><label className="label">Never below $</label><input className="input" inputMode="decimal" placeholder={String(Math.round(price * 0.6))} value={d.floor} onChange={(e) => setD({ ...d, floor: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => saveDrop()}>{saved || "Save"}</button>
            {drop.pct ? <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { const off = { pct: "", days: "", floor: "" }; setD(off); saveDrop(off); }}>Turn off</button> : null}
            {drop.last && <span className="text-xs muted">Last drop {new Date(drop.last).toLocaleDateString()}</span>}
          </div>
        </details>
      )}
    </div>
  );
}
