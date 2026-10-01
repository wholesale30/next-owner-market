"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Mic from "@/components/Mic";
import CopyTabs from "@/app/app/items/[id]/CopyTabs";
import { compressImage } from "@/lib/photo";
import { HOWTO } from "@/lib/howto";
import { facebookCopy, offerUpCopy, ebayCopy, craigslistCopy, etsyCopy, poshmarkCopy, vintedCopy, mercariCopy, depopCopy, money } from "@/lib/listing";
import type { Item } from "@/lib/types";

type Draft = { title: string; description: string; brand?: string | null; model?: string | null; condition?: string; condition_notes?: string | null; specs?: Record<string, string>; tags?: string[]; price_min?: number; price_max?: number; price_note?: string; box?: string; worth_listing?: boolean };
const STEPS = ["Looking at your photo…", "Reading labels and model numbers…", "Checking what these sell for…", "Writing your listing…", "Making versions for 9 sites…"];

export default function TryClient({ signedIn }: { signedIn: boolean }) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<{ msg: string; signup?: boolean } | null>(null);
  const [res, setRes] = useState<{ token: string; draft: Draft; photo_url: string } | null>(null);
  const [secs, setSecs] = useState(0);

  async function pick(f?: File | null) {
    if (!f) return;
    setErr(null); setRes(null);
    const blob = await compressImage(f, 1280, 0.8);
    const url = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); });
    setPreview(URL.createObjectURL(blob)); setDataUrl(url);
  }
  async function go() {
    if (!dataUrl) return;
    setBusy(true); setErr(null); setStep(0);
    const t0 = Date.now();
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 5000);
    try {
      const r = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl, hints: hint }) });
      const j = await r.json();
      if (!r.ok) setErr({ msg: j.error || "Something went wrong.", signup: j.signup });
      else { setRes(j); setSecs(Math.round((Date.now() - t0) / 1000)); window.scrollTo({ top: 0, behavior: "smooth" }); }
    } catch { setErr({ msg: "Couldn't reach us. Check your connection and try again." }); }
    clearInterval(tick); setBusy(false);
  }

  if (signedIn && !res) return (
    <div className="card p-5 space-y-3 text-center">
      <p className="text-xl font-bold">You already have an account 🎉</p>
      <p className="muted">Add an item and the AI writes it for you, same as here, and saves it.</p>
      <Link href="/app/items/new" className="btn btn-primary w-full text-lg">📸 List an item</Link>
    </div>
  );

  if (res) {
    const d = res.draft;
    const item = { id: "try", sku: "NEW", title: d.title, description: d.description, brand: d.brand || null, model: d.model || null, condition: (d.condition || "good") as Item["condition"], condition_notes: d.condition_notes || null, specs: d.specs || {}, tags: d.tags || [], local_pickup_ok: true, shipping_ok: d.box !== "freight", tested: false, serviced: false } as unknown as Item;
    const input = { item, businessName: "Next Owner Market" };
    const tabs = [
      { key: "facebook", label: "Facebook Marketplace / Group", short: "Facebook", text: facebookCopy(input), howto: HOWTO.facebook },
      { key: "ebay", label: "eBay", short: "eBay", text: ebayCopy(input), title: item.title.slice(0, 80), howto: HOWTO.ebay },
      { key: "offerup", label: "OfferUp", short: "OfferUp", text: offerUpCopy(input), title: item.title, howto: HOWTO.offerup },
      { key: "mercari", label: "Mercari", short: "Mercari", text: mercariCopy(input), title: item.title.slice(0, 80), howto: HOWTO.mercari },
      { key: "poshmark", label: "Poshmark", short: "Poshmark", text: poshmarkCopy(input), title: item.title.slice(0, 80), howto: HOWTO.poshmark },
      { key: "craigslist", label: "Craigslist", short: "Craigslist", text: craigslistCopy(input), title: item.title, howto: HOWTO.craigslist },
      { key: "vinted", label: "Vinted", short: "Vinted", text: vintedCopy(input), title: item.title.slice(0, 100), howto: HOWTO.vinted },
      { key: "depop", label: "Depop", short: "Depop", text: depopCopy(input), howto: HOWTO.depop },
      { key: "etsy", label: "Etsy (vintage/handmade only)", short: "Etsy", text: etsyCopy(input), title: item.title.slice(0, 140), howto: HOWTO.etsy },
    ];
    const signup = `/signup?try=${res.token}`;
    return (
      <div className="space-y-4">
        <div className="card p-4 space-y-1" style={{ borderLeft: "4px solid var(--ok)" }}>
          <p className="text-xl font-extrabold">✨ Done in {secs || 30} seconds.</p>
          <p className="text-sm">Writing this by hand takes most people 15 to 20 minutes. Here&apos;s your listing:</p>
        </div>
        <div className="card overflow-hidden">
          <img src={res.photo_url} alt="" className="w-full max-h-72 object-contain" style={{ background: "var(--line)" }} />
          <div className="p-4 space-y-2">
            <p className="text-lg font-bold leading-tight">{d.title}</p>
            {d.price_min != null && d.price_max != null && <p className="text-2xl font-extrabold" style={{ color: "var(--brand)" }}>{money(d.price_min)} to {money(d.price_max)}</p>}
            {d.price_note && <p className="text-xs muted">{d.price_note}</p>}
            <p className="text-sm whitespace-pre-line">{d.description}</p>
            {d.worth_listing === false && <p className="text-sm" style={{ color: "var(--accent)" }}>Honest take: this one may not be worth much on its own. Try it in a bundle, or donate it.</p>}
          </div>
        </div>

        <Link href={signup} className="btn btn-primary w-full text-lg py-4">💾 Keep this listing (free account)</Link>
        <p className="text-xs muted text-center -mt-2">30 seconds. Your listing and photo are saved into your account, plus 3 more free AI listings.</p>

        <div className="card p-4 space-y-2">
          <p className="font-bold">Ready to paste on 9 sites</p>
          <CopyTabs tabs={tabs} isPro={true} />
        </div>

        <div className="card p-4 space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-bold">🏪 Bonus: list it in our store too, free</p>
          <p className="text-sm">Buyers near you can find it and pay by card, and your listing shows up on Google. One tap after you make your account.</p>
          <Link href={signup} className="btn btn-secondary w-full">Keep it and list it free</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-extrabold leading-tight">Snap a photo.<br />Get your listing free.</h1>
        <p className="muted">The AI writes the title, description and price, plus ready-to-paste versions for Facebook, eBay and 7 more. No account needed.</p>
      </div>
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {!preview ? (
        <div className="space-y-2">
          <button className="btn btn-primary w-full text-lg py-5" onClick={() => gallery.current?.click()}>🖼 Pick a photo from your phone</button>
          <button className="btn btn-secondary w-full" onClick={() => camera.current?.click()}>📷 Take a photo</button>
          <p className="text-xs muted text-center">Tip: the whole item, in good light. A label or model number in the shot helps a lot.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <img src={preview} alt="" className="w-full max-h-72 object-contain rounded-xl" style={{ background: "var(--line)" }} />
          <div className="flex gap-2 items-start">
            <textarea className="input flex-1" rows={2} placeholder="Anything we should know? (optional: works, missing a part, brand…)" value={hint} onChange={(e) => setHint(e.target.value)} />
            <Mic onText={(t) => setHint((h) => (h ? h + " " : "") + t)} />
          </div>
          <button className="btn btn-primary w-full text-lg py-4" disabled={busy} onClick={go}>{busy ? STEPS[step] : "✨ Write my listing"}</button>
          {!busy && <button className="text-sm underline w-full" onClick={() => { setPreview(null); setDataUrl(null); }}>Use a different photo</button>}
        </div>
      )}
      {err && (
        <div className="card p-3 space-y-2" style={{ borderLeft: "4px solid var(--accent)" }}>
          <p className="text-sm">{err.msg}</p>
          {err.signup && <Link href="/signup" className="btn btn-primary w-full">Make a free account</Link>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
        <div><p className="text-2xl">📸</p><p>1 photo</p></div>
        <div><p className="text-2xl">⏱</p><p>About 30 seconds</p></div>
        <div><p className="text-2xl">🛒</p><p>9 sites ready</p></div>
      </div>
    </div>
  );
}
