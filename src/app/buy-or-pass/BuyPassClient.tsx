"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PhotoPicker, { type Picked } from "@/components/PhotoPicker";

type Out = { what: string; condition_guess: string; resale_low: number; resale_high: number; best_place: string; ship_or_local: string; shipping_est: number; confidence: string; why: string; watch_out: string | null; fee: { label: string; pct: number; fixed: number; note: string }; paid: number; net_low: number; net_high: number; verdict: "buy" | "maybe" | "pass" };
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;

export default function BuyPassClient({ meId }: { meId: string | null }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [paid, setPaid] = useState("");
  const [hints, setHints] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean } | null>(null);
  const [res, setRes] = useState<Out | null>(null);
  async function run() {
    if (!meId) { router.push("/signup?buyer=1&next=/buy-or-pass"); return; }
    setBusy("Checking…"); setErr(null);
    const r = await fetch("/api/buy-or-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos.map((p) => p.url), paid: Number(paid || 0), hints }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setErr({ msg: j.error || "Couldn't read that.", upgrade: j.upgrade });
    setRes(j);
  }
  const V = { buy: { label: "BUY", color: "var(--ok)" }, maybe: { label: "MAYBE", color: "var(--accent)" }, pass: { label: "PASS", color: "var(--danger)" } };
  return (
    <div className="space-y-3">
      {!res ? (
        <div className="card p-4 space-y-3">
          <PhotoPicker photos={photos} onChange={setPhotos} max={4} folder="buypass" meId={meId} onBusy={setBusy} label="Pick a photo" />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">What they&apos;re asking</label><input className="input text-xl" inputMode="decimal" placeholder="$" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} /></div>
            <div><label className="label">Notes (optional)</label><input className="input" placeholder="works, missing cord…" value={hints} onChange={(e) => setHints(e.target.value)} /></div>
          </div>
          <button type="button" className="btn btn-primary w-full text-lg" disabled={!photos.length || !!busy} onClick={run}>{busy || "Buy or pass?"}</button>
          {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err.msg}{err.upgrade && <> <Link href="/pro" className="underline font-semibold">Go Pro</Link></>}</p>}
          {!meId && <p className="text-xs muted text-center">Free. You&apos;ll make a free account first.</p>}
        </div>
      ) : (
        <>
          <div className="card p-4 text-center space-y-1" style={{ borderColor: V[res.verdict].color, borderWidth: 2 }}>
            <p className="text-5xl font-extrabold" style={{ color: V[res.verdict].color }}>{V[res.verdict].label}</p>
            <p className="font-bold">{res.what}</p>
            <p className="text-sm muted">{res.condition_guess} · confidence {res.confidence}</p>
          </div>
          <div className="card p-4 text-sm space-y-1">
            <div className="flex justify-between"><span>Resells for</span><b>{money(res.resale_low)} – {money(res.resale_high)}</b></div>
            <div className="flex justify-between muted"><span>Best place: {res.fee.label}</span><span>fees {res.fee.pct}%{res.fee.fixed ? ` + ${money(res.fee.fixed)}` : ""}</span></div>
            {res.ship_or_local !== "local" && <div className="flex justify-between muted"><span>Shipping (you pay or build in)</span><span>about {money(res.shipping_est)}</span></div>}
            <div className="flex justify-between muted"><span>You&apos;d pay</span><span>{money(res.paid)}</span></div>
            <div className="flex justify-between text-base pt-1 border-t" style={{ borderColor: "var(--line)" }}><b>Profit</b><b style={{ color: V[res.verdict].color }}>{money(res.net_low)} – {money(res.net_high)}</b></div>
          </div>
          <div className="card p-4 text-sm space-y-1"><p>{res.why}</p>{res.watch_out && <p className="p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>⚠ {res.watch_out}</p>}</div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" onClick={() => { setRes(null); setPhotos([]); setPaid(""); setHints(""); }}>Check another</button>
            {res.verdict !== "pass" && <Link href="/worth" className="btn btn-secondary flex-1">Bought it? List it</Link>}
          </div>
          <p className="text-xs muted">Estimates from a photo and current fee schedules; not a guarantee. Fees: {res.fee.note}.</p>
        </>
      )}
    </div>
  );
}
