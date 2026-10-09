"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PhotoPicker, { type Picked } from "@/components/PhotoPicker";
import InstallPrompt from "@/components/InstallPrompt";
import FixBox from "@/components/FixBox";
import OutOfUses from "@/components/OutOfUses";
import ConditionLadder, { type LadderView } from "@/components/ConditionLadder";
import OriginCard, { type OriginView } from "@/components/OriginCard";
import PartsBox, { type PartView } from "@/components/PartsBox";
import { compressImage } from "@/lib/photo";
import ShareAndAgain from "@/components/ShareAndAgain";
import ShareValuation from "@/components/ShareValuation";

type Place = { key: string; label: string; pct: number; fixed: number; note: string; net_low: number; net_high: number };
type Out = { origin?: OriginView | null; ladder?: LadderView | null; missing_parts?: PartView[]; id: string | null; what: string; condition_guess: string; resale_low: number; resale_high: number; best_place: string; ship_or_local: string; shipping_est: number; confidence: string; why: string; watch_out: string | null; fee: { label: string; pct: number; fixed: number; note: string }; places: Place[]; paid: number; net_low: number; net_high: number; max_pay: number; verdict: "buy" | "maybe" | "pass"; photo_url: string; photo_urls: string[] };
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const V = { buy: { label: "BUY", color: "var(--ok)" }, maybe: { label: "MAYBE", color: "var(--accent)" }, pass: { label: "PASS", color: "var(--danger)" } };

export default function BuyPassClient({ meId, refCode, freeLeft, inRef = "", plan = null, initial = null }: { meId: string | null; refCode?: string | null; freeLeft?: number | null; inRef?: string; plan?: string | null; initial?: unknown }) {
  const refQ = inRef ? `&ref=${encodeURIComponent(inRef)}` : "";
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [anonPhoto, setAnonPhoto] = useState<string | null>(null); // signed out: one photo, sent with the check
  const [paid, setPaid] = useState("");
  const [hints, setHints] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean; signup?: boolean } | null>(null);
  const [res, setRes] = useState<Out | null>((initial as Out) || null);
  // the public page made for this answer (by 📤 Share or 📣 Share this find), so it is only ever made once
  const [page, setPage] = useState<string | null>(null);
  const [remind, setRemind] = useState<"idle" | "busy" | "done">("idle");
  const [email, setEmail] = useState("");
  const gallery = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);

  async function pickAnon(f?: File) {
    if (!f) return;
    const blob = await compressImage(f, 1280, 0.8);
    const r = new FileReader(); r.onload = () => setAnonPhoto(String(r.result)); r.readAsDataURL(blob);
  }
  const ready = meId ? photos.length > 0 : !!anonPhoto;

  async function run() {
    setBusy("Checking… about 10 seconds"); setErr(null);
    const body = meId ? { photoUrls: photos.map((p) => p.url), paid: Number(paid || 0), hints } : { image: anonPhoto, paid: Number(paid || 0), hints };
    const r = await fetch("/api/buy-or-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setErr({ msg: j.error || "Couldn't read that.", upgrade: j.upgrade, signup: j.signup });
    setRes(j); setPage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function fix(correction: string): Promise<string | null> {
    if (!res?.id) return "Nothing to fix yet.";
    const r = await fetch("/api/buy-or-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correction, prev_id: res.id, paid: res.paid, hints, photoUrls: res.photo_urls }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.verdict) return j.error || "Couldn't update it. Try again.";
    setRes(j); setPage(null); setHints((h) => (h ? h + ". " : "") + correction);
    return null;
  }

  async function listIt() {
    if (!res?.id) return;
    if (!meId) { router.push(`/signup?buyer=1${refQ}&next=${encodeURIComponent(`/buy-or-pass?claim=${res.id}&list=1`)}`); return; }
    setBusy("Making your listing…");
    const r = await fetch("/api/buy-or-pass/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: res.id, photo_urls: res.photo_urls }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok || !j.item_id) return setErr({ msg: j.error || "Couldn't make the listing." });
    router.push(`/app/items/${j.item_id}?written=1#copy`);
  }
  async function thriftPro() {
    if (!meId) { router.push(`/signup?buyer=1${refQ}&next=/buy-or-pass`); return; }
    const r = await fetch("/api/stripe/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "thrift", back: "/buy-or-pass" }) });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (j.url) window.location.assign(j.url); else setErr({ msg: j.error || "Checkout isn't available right now." });
  }
  async function remindMe() {
    setRemind("busy");
    const r = await fetch("/api/thrift-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setRemind(r.ok ? "done" : "idle");
  }
  /** Make this check's public page on our site (Share this find). Returns its address. */
  async function publishCheck(): Promise<string | null> {
    if (!res?.id) return null;
    const x = await fetch("/api/buy-or-pass/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: res.id }) });
    const j = (await x.json().catch(() => ({}))) as { slug?: string };
    if (j.slug) setPage(j.slug);
    return j.slug || null;
  }
  function again() { setPage(null); setRes(null); setPhotos([]); setAnonPhoto(null); setPaid(""); setHints(""); setErr(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  if (!res) return (
    <div className="card p-4 space-y-3">
      {meId ? (
        <PhotoPicker photos={photos} onChange={setPhotos} max={4} folder="buypass" meId={meId} onBusy={setBusy} label="Pick a photo" />
      ) : anonPhoto ? (
        <div className="relative"><img src={anonPhoto} alt="" className="w-full max-h-72 object-contain rounded-xl" /><button type="button" className="absolute top-2 right-2 pill" onClick={() => setAnonPhoto(null)}>Change</button></div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center font-semibold" style={{ borderColor: "var(--brand)" }} onClick={() => gallery.current?.click()}><span className="text-4xl">🖼</span>Pick a photo</button>
          <button type="button" className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center font-semibold" style={{ borderColor: "var(--brand)" }} onClick={() => camera.current?.click()}><span className="text-4xl">📸</span>Take a photo</button>
          <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => { pickAnon(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pickAnon(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Price on the tag</label><input className="input text-xl" inputMode="decimal" placeholder="$" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} /></div>
        <div><label className="label">Notes (optional)</label><input className="input" placeholder="works, missing cord…" value={hints} onChange={(e) => setHints(e.target.value)} /></div>
      </div>
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={!ready || !!busy} onClick={run}>{busy || "Buy or pass?"}</button>
      {err?.upgrade && <OutOfUses message={err.msg} back="/buy-or-pass" thrift={plan === "free"} />}
      {err && !err.upgrade && <p className="text-sm" style={{ color: "var(--danger)" }}>{err.msg}{err.signup && <> <Link href={`/signup?buyer=1${refQ}&next=/buy-or-pass`} className="underline font-semibold">Make a free account</Link></>}</p>}
      <p className="text-xs muted text-center">{meId ? (freeLeft != null ? `${freeLeft} free check${freeLeft === 1 ? "" : "s"} left today` : "Free for you") : "Free. No account, no app, no card. Try it right now."}</p>
    </div>
  );

  const r = res;
  const places = r.places || []; // older saved checks may not have the per-place table
  const bestPlace = places.find((p) => p.key === r.best_place) || places[0] || { key: r.best_place, label: r.best_place, pct: 0, fixed: 0, note: "", net_low: r.net_low, net_high: r.net_high };
  const sorted = [...places].sort((a, b) => b.net_high - a.net_high);
  return (
    <div className="space-y-3">
      <div className="card p-4 text-center space-y-1" style={{ borderColor: V[r.verdict].color, borderWidth: 3 }}>
        {r.photo_url && <img src={r.photo_url} alt="" className="mx-auto h-28 w-28 object-cover rounded-xl" />}
        <p className="text-6xl font-extrabold" style={{ color: V[r.verdict].color }}>{V[r.verdict].label}</p>
        <p className="font-bold text-lg">{r.what}</p>
        {r.verdict === "buy" && <p className="text-base font-semibold">You could keep about {money(r.net_low)}–{money(r.net_high)}. Leave it and you miss that.</p>}
        {r.verdict === "maybe" && <p className="text-base font-semibold">Worth it at {money(r.max_pay)} or less. Ask if they&apos;ll take that.</p>}
        {r.verdict === "pass" && <p className="text-base font-semibold">{r.net_high < 0 ? `Buy it and you'd lose about ${money(-r.net_high)} after fees.` : `Only about ${money(r.net_low)}–${money(r.net_high)} left after fees. Not worth your time.`}</p>}
        <p className="text-xs muted">{r.condition_guess} · how sure: {r.confidence}</p>
      </div>
      <ShareAndAgain key={`${r.id}-${r.verdict}-${r.resale_low}-${r.resale_high}`} againLabel="📸 Check next" onAgain={again} prepare={async () => {
        if (!r.id) return null;
        const slug = page || (await publishCheck());
        if (!slug) return null;
        const text = r.paid ? `Paid ${money(r.paid)} at the thrift store. It sells for about ${money(r.resale_low)}–${money(r.resale_high)}. ${V[r.verdict].label}! Checked free with Buy or Pass:` : `Found this thrifting. It sells for about ${money(r.resale_low)}–${money(r.resale_high)}. Checked free with Buy or Pass:`;
        return { url: `${window.location.origin}/flip/${r.id}${refCode ? `?ref=${refCode}` : ""}`, page: `/valued/${slug}`, title: "Buy or pass?", text };
      }} />
      <OriginCard o={r.origin} />
      <ConditionLadder l={r.ladder} nowLow={r.resale_low} nowHigh={r.resale_high} nowVerdict={r.verdict} profit={{ low: r.net_low, high: r.net_high }} />
      <PartsBox parts={r.missing_parts} nowLow={r.resale_low} nowHigh={r.resale_high} />
      <FixBox onFix={fix} examples="it's the 1978 model · missing the remote · that's real Pyrex" />
      <ShareValuation key={`${r.id}-${r.verdict}-${r.resale_low}-${r.resale_high}`} published={page} onPublished={setPage} publishFn={() => publishCheck()} payload={{ title: r.what, value_low: r.resale_low, value_high: r.resale_high }} />

      <div className="grid gap-2">
        {r.verdict !== "pass" && <button type="button" className="btn btn-secondary w-full text-lg" style={{ minHeight: 52 }} disabled={!!busy} onClick={listIt}>{busy || "✅ I bought it: write my listing"}</button>}
      </div>

      <div className="card p-4 text-sm space-y-2">
        <div className="flex justify-between text-base"><span>Sells for (used)</span><b>{money(r.resale_low)} – {money(r.resale_high)}</b></div>
        <p className="font-semibold pt-1">What you keep, by where you sell it</p>
        {sorted.map((p) => (
          <div key={p.key} className="flex justify-between items-center rounded-lg px-2 py-1" style={p.key === bestPlace.key ? { background: "color-mix(in srgb, var(--ok) 14%, var(--surface))" } : {}}>
            <span>{p.label}{p.key === bestPlace.key ? " ⭐ best" : ""}<span className="block text-xs muted">fees {p.pct}%{p.fixed ? ` + ${money(p.fixed)}` : ""}{p.key === "facebook" || p.key === "nom" ? "" : r.ship_or_local !== "local" ? ` · shipping about ${money(r.shipping_est)}` : ""}</span></span>
            <b style={{ color: p.net_low >= 15 ? "var(--ok)" : p.net_high < 0 ? "var(--danger)" : undefined }}>{money(p.net_low)} – {money(p.net_high)}</b>
          </div>
        ))}
        <p className="text-xs muted">After fees{r.paid ? `, shipping and the ${money(r.paid)} you pay` : " and shipping"}. BUY means the low end still leaves about $15.</p>
      </div>

      <div className="card p-4 text-sm space-y-1"><p>{r.why}</p>{r.watch_out && <p className="p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>⚠ {r.watch_out}</p>}</div>

      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err.msg}</p>}

      {!meId && (
        <div className="card p-4 space-y-2 text-center" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
          <p className="font-bold text-lg">Keep checking: 5 free every day</p>
          <p className="text-sm muted">Make a free account. We save this find, track your hauls, and the AI writes the listing when you buy. No card.</p>
          <Link href={`/signup?buyer=1${refQ}&next=${encodeURIComponent(`/buy-or-pass?claim=${r.id}`)}`} className="btn btn-primary w-full text-lg">Make my free account</Link>
        </div>
      )}

      <div className="card p-3 text-sm space-y-2">
        <p className="font-semibold">🏷 Get a Monday heads-up?</p>
        <p className="text-xs muted">Many thrift stores start a new half-off color tag every week. We&apos;ll send one short email Monday morning. Stop any time.</p>
        {remind === "done" ? <p style={{ color: "var(--ok)" }}>✓ You&apos;re on the Monday list.</p> : (
          <div className="flex gap-2">
            {!meId && <input className="input flex-1" type="email" inputMode="email" placeholder="your email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            <button type="button" className="btn btn-secondary shrink-0 flex-1" disabled={remind === "busy" || (!meId && !email.includes("@"))} onClick={remindMe}>{remind === "busy" ? "…" : "Remind me Mondays"}</button>
          </div>
        )}
      </div>
      <InstallPrompt />
      <p className="text-xs muted">An estimate from the photo and what similar used items sell for, plus each site&apos;s current fees. Not a guarantee: check labels and condition before you buy.</p>
    </div>
  );
}
