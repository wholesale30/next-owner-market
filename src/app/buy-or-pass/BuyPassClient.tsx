"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PhotoPicker, { type Picked } from "@/components/PhotoPicker";
import InstallPrompt from "@/components/InstallPrompt";
import FixBox from "@/components/FixBox";
import { compressImage } from "@/lib/photo";

type Place = { key: string; label: string; pct: number; fixed: number; note: string; net_low: number; net_high: number };
type Out = { id: string | null; what: string; condition_guess: string; resale_low: number; resale_high: number; best_place: string; ship_or_local: string; shipping_est: number; confidence: string; why: string; watch_out: string | null; fee: { label: string; pct: number; fixed: number; note: string }; places: Place[]; paid: number; net_low: number; net_high: number; max_pay: number; verdict: "buy" | "maybe" | "pass"; photo_url: string; photo_urls: string[] };
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const V = { buy: { label: "BUY", color: "var(--ok)" }, maybe: { label: "MAYBE", color: "var(--accent)" }, pass: { label: "PASS", color: "var(--danger)" } };

export default function BuyPassClient({ meId, refCode, freeLeft, inRef = "" }: { meId: string | null; refCode?: string | null; freeLeft?: number | null; inRef?: string }) {
  const refQ = inRef ? `&ref=${encodeURIComponent(inRef)}` : "";
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [anonPhoto, setAnonPhoto] = useState<string | null>(null); // signed out: one photo, sent with the check
  const [paid, setPaid] = useState("");
  const [hints, setHints] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean; signup?: boolean } | null>(null);
  const [res, setRes] = useState<Out | null>(null);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
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
    setRes(j); setShared(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function fix(correction: string): Promise<string | null> {
    if (!res?.id) return "Nothing to fix yet.";
    const r = await fetch("/api/buy-or-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correction, prev_id: res.id, paid: res.paid, hints, photoUrls: res.photo_urls }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.verdict) return j.error || "Couldn't update it. Try again.";
    setRes(j); setShared(false); setPage(null); setHints((h) => (h ? h + ". " : "") + correction);
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
    router.push(`/app/items/${j.item_id}/edit`);
  }
  // Step 1: put it on our site (no popup). Step 2 (optional button): send the brag card to Facebook or a friend.
  async function share() {
    if (!res?.id) return;
    setSharing(true);
    const r = await fetch("/api/buy-or-pass/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: res.id }) });
    const j = (await r.json().catch(() => ({}))) as { slug?: string };
    setSharing(false);
    if (j.slug) { setPage(j.slug); setShared(true); } else setErr({ msg: "Couldn't share that one. Tap Share again." });
  }
  async function send() {
    if (!res?.id) return;
    const url = `${window.location.origin}/flip/${res.id}${refCode ? `?ref=${refCode}` : ""}`;
    const text = res.paid ? `Paid ${money(res.paid)} at the thrift store. It sells for about ${money(res.resale_low)}–${money(res.resale_high)}. ${V[res.verdict].label}! Checked free with Buy or Pass:` : `Found this thrifting. It sells for about ${money(res.resale_low)}–${money(res.resale_high)}. Checked free with Buy or Pass:`;
    try {
      if (navigator.share) await navigator.share({ title: "Buy or pass?", text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch { /* closed */ }
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
  function again() { setRes(null); setPhotos([]); setAnonPhoto(null); setPaid(""); setHints(""); setErr(null); }

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
      {err?.upgrade && (
        <div className="card p-3 text-center space-y-2" style={{ borderColor: "var(--ok)", borderWidth: 2 }}>
          <p className="font-bold">Unlimited checks: $3.99 a month</p>
          <p className="text-xs muted">Thrift Pro. Other thrift apps charge $10 a week. No trial tricks; cancel in one tap.</p>
          <button type="button" className="btn btn-primary w-full" onClick={thriftPro}>Get Thrift Pro</button>
        </div>
      )}
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err.msg}{err.signup && <> <Link href={`/signup?buyer=1${refQ}&next=/buy-or-pass`} className="underline font-semibold">Make a free account</Link></>}</p>}
      <p className="text-xs muted text-center">{meId ? (freeLeft != null ? `${freeLeft} free check${freeLeft === 1 ? "" : "s"} left today · Pro is unlimited` : "Unlimited checks") : "Free. No account, no app, no card. Try it right now."}</p>
    </div>
  );

  const r = res;
  const bestPlace = r.places.find((p) => p.key === r.best_place) || r.places[0];
  const sorted = [...r.places].sort((a, b) => b.net_high - a.net_high);
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
      <FixBox onFix={fix} examples="it's the 1978 model · missing the remote · that's real Pyrex" />

      <div className="card p-3 space-y-2" style={{ background: "color-mix(in srgb, var(--brand) 8%, var(--surface))", borderColor: "var(--brand)", borderWidth: 2 }}>
        {shared && page ? (
          <>
            <p className="text-base font-bold text-center" style={{ color: "var(--ok)" }}>✓ Shared on Next Owner Market</p>
            <p className="text-sm text-center">It has its own page now, so people searching Google for one can find it. <Link className="underline font-semibold" href={`/valued/${page}`}>See your page</Link> · <Link className="underline" href="/valued">Everyone&apos;s finds</Link></p>
            <button type="button" className="btn btn-secondary w-full" onClick={send}>Also send it to Facebook or a friend</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={sharing} onClick={share}>{sharing ? "Sharing…" : "📣 Share this find"}</button>
            <p className="text-sm text-center">🔒 <b>Private.</b> No name, no email, no address, no location. People only see the item, its photo and what it&apos;s worth.</p>
            <p className="text-xs muted text-center">It goes on our site as its own page that Google can find. It helps the next person with the same thing.</p>
          </>
        )}
      </div>

      <div className="grid gap-2">
        <button type="button" className="btn btn-secondary w-full text-lg" style={{ minHeight: 52 }} onClick={again}>📸 Check the next one</button>
        {r.verdict !== "pass" && <button type="button" className="btn btn-secondary w-full text-lg" style={{ minHeight: 52 }} disabled={!!busy} onClick={listIt}>{busy || "✅ I bought it: list it now"}</button>}
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
