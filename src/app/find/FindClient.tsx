"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Mic from "@/components/Mic";
import OutOfUses from "@/components/OutOfUses";
import ShareAndAgain from "@/components/ShareAndAgain";
import { compressImage } from "@/lib/photo";

type Opt = { store: string; product: string; price: number | null; condition: string; url: string; note: string; checked: boolean };
export type FindOut = {
  query: string; what_it_is: string; exact_specs: string[]; answer: string;
  shop_price_low: number | null; shop_price_high: number | null; shop_label: string;
  options: Opt[];
  diy: { doable: "easy" | "medium" | "hard" | "pro_only"; time: string; tools: string[]; steps: string[]; video_search: string; safety: string };
  watch_out: string; cheaper_idea: string; best_price: number | null; photo_url?: string | null; lookup_id?: string | null;
};

const money = (n: number) => `$${n >= 100 ? Math.round(n).toLocaleString() : (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0)}`;
const EXAMPLES = ["2012 Prius EGR valve", "LED bulb for a 500 watt halogen work light", "Dyson V8 replacement battery", "Shark Navigator vacuum filter", "Toro lawn mower blade 22 inch", "KitchenAid mixer beater"];
const DIY = { easy: { label: "Easy, do it yourself", color: "var(--ok)" }, medium: { label: "Doable with basic tools", color: "var(--accent)" }, hard: { label: "Hard, take your time", color: "var(--danger)" }, pro_only: { label: "Best left to a pro", color: "var(--danger)" } };
const STEPS = ["Reading what you need…", "Matching the exact part…", "Checking Amazon and Walmart…", "Checking Home Depot, Lowe's and eBay…", "Checking specialty stores…", "Comparing prices…", "Almost there…"];

export default function FindClient({ meId, plan, initial = null, startQ = "", feeText }: { meId: string | null; plan: string | null; initial?: FindOut | null; startQ?: string; feeText: string }) {
  const [text, setText] = useState(startQ);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean; signup?: boolean } | null>(null);
  const [res, setRes] = useState<FindOut | null>(initial);
  const gallery = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3200);
    return () => clearInterval(t);
  }, [busy]);

  async function pick(f?: File) {
    if (!f) return;
    const blob = await compressImage(f, 1280, 0.8);
    const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(blob);
  }

  async function run() {
    if (!text.trim() && !photo) return setErr({ msg: "Type or say what you need, or add a photo." });
    setBusy(true); setStep(0); setErr(null);
    const r = await fetch("/api/find", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, image: photo }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr({ msg: j.error || "Couldn't find that one. Try different words.", upgrade: j.upgrade, signup: j.signup });
    setRes(j);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function again() { setRes(null); setText(""); setPhoto(null); setErr(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  if (!res) return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2"><label className="label text-base mb-0" htmlFor="need">What do you need?</label><Mic onText={(t) => setText((x) => (x ? x + " " : "") + t)} /></div>
      <div>
        <textarea id="need" className="input text-lg" rows={3} placeholder="A part, a bulb, a filter, anything. Add the brand, model or year if you know it." value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} />
      </div>
      {photo ? (
        <div className="relative"><img src={photo} alt="" className="w-full max-h-56 object-contain rounded-xl" /><button type="button" className="absolute top-2 right-2 pill" onClick={() => setPhoto(null)}>Remove</button></div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-secondary" style={{ minHeight: 52 }} onClick={() => gallery.current?.click()}>🖼 Pick photo</button>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 52 }} onClick={() => camera.current?.click()}>📸 Camera</button>
          <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}
      <p className="text-xs muted">Tip: a photo of the label or the old part works great.</p>
      {err && (err.upgrade ? <OutOfUses message={err.msg} back="/find" /> : (
        <div className="text-sm space-y-2"><p style={{ color: "var(--danger)" }}>{err.msg}</p>{err.signup && <Link href="/signup?buyer=1&next=/find" className="btn btn-primary w-full">Make my free account</Link>}</div>
      ))}
      <button type="button" className="btn btn-primary w-full text-xl" style={{ minHeight: 60 }} disabled={busy || (!text.trim() && !photo)} onClick={run}>{busy ? STEPS[step] : "🔎 Find it for less"}</button>
      {busy && <p className="text-xs muted text-center">We&apos;re checking real stores right now. About 20 seconds.</p>}
      {!busy && !text && (
        <div className="space-y-1">
          <p className="text-xs muted">Or try one:</p>
          <div className="flex flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} type="button" className="pill px-3 py-2 text-sm" onClick={() => setText(x)}>{x}</button>)}</div>
        </div>
      )}
      {!meId && <p className="text-xs muted text-center">Your first find is free. No account needed.</p>}
    </div>
  );

  const shop = res.shop_price_high || res.shop_price_low;
  // "EGR valve for 2012 Prius (Toyota part 25620-37120)" → big name + small part-number line
  const name = res.what_it_is.replace(/\s*\(.*$/, "").trim() || res.what_it_is;
  const sub = res.what_it_is.length > name.length ? res.what_it_is.slice(name.length).replace(/^\s*\(|\)\s*$/g, "").trim() : "";
  const storeName = (x: string) => x.replace(/\s*\(.*$/, "").trim() || x;
  const save = shop && res.best_price != null ? Math.max(0, shop - res.best_price) : 0;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://nextownermarket.com";
  const shareTarget = async () => ({
    url: `${origin}/find?q=${encodeURIComponent(res.query || res.what_it_is)}`,
    title: "Find it for less",
    text: res.best_price != null
      ? `Found ${name} for ${money(res.best_price)}${shop && save >= 10 ? ` instead of ${money(shop)}${res.shop_label ? ` (${res.shop_label})` : ""}` : ""}. Check yours free:`
      : `Look what I found for ${name}. Check yours free:`,
  });

  return (
    <div className="space-y-4">
      {/* 1. the answer */}
      <div className="card p-4 space-y-2" style={{ borderColor: "var(--ok)", borderWidth: 2 }}>
        <p className="text-xs muted uppercase tracking-wide">You need</p>
        <h2 className="text-xl font-extrabold leading-tight">{name}</h2>
        {sub && <p className="text-sm muted -mt-1">{sub}</p>}
        {res.best_price != null && <p className="text-4xl font-extrabold" style={{ color: "var(--ok)" }}>{money(res.best_price)}<span className="text-base font-semibold muted"> best price found</span></p>}
        {save >= 10 && shop && (
          <div className="rounded-xl p-3 text-center" style={{ background: "color-mix(in srgb, var(--ok) 14%, transparent)" }}>
            <p className="text-lg font-extrabold">🎉 Save about {money(save)}</p>
            <p className="text-sm">vs {money(shop)}{res.shop_label ? ` (${res.shop_label})` : ""}</p>
          </div>
        )}
        <p>{res.answer}</p>
      </div>

      {/* 2. share · find another (same spot as every other tool) */}
      <ShareAndAgain prepare={shareTarget} againLabel="🔎 Find another" onAgain={again} />

      {/* 3. where to buy */}
      {!!res.options.length && (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Where to buy it</h3>
          {res.options.map((o, i) => (
            <div key={i} className="card p-3 space-y-2">
              <div className="flex justify-between gap-2 items-start">
                <div className="min-w-0"><p className="font-bold">{o.store}{i === 0 && o.price != null ? <span className="pill ml-2 text-xs" style={{ background: "var(--ok)", color: "#fff" }}>Lowest</span> : null}</p><p className="text-sm">{o.product}</p></div>
                <p className="text-xl font-extrabold whitespace-nowrap">{o.price != null ? money(o.price) : <span className="text-sm muted font-normal">see price</span>}</p>
              </div>
              <p className="text-xs muted">{o.condition}{o.note ? ` · ${o.note}` : ""}</p>
              <a href={o.url} target="_blank" rel="nofollow sponsored noopener noreferrer" className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"} w-full`} style={{ minHeight: 48 }}>{o.checked ? `Open at ${storeName(o.store)} ›` : `Search ${storeName(o.store)} ›`}</a>
            </div>
          ))}
          <p className="text-xs muted">Prices change fast; the store&apos;s page has the final price. Some links may earn us a small commission at no cost to you. That keeps this tool free.</p>
        </div>
      )}

      {/* 4. let us do it */}
      <HelpBox res={res} meId={meId} feeText={feeText} />

      {/* 5. match these specs */}
      {!!res.exact_specs.length && (
        <div className="card p-4 space-y-1">
          <h3 className="font-bold">✅ Make sure it matches</h3>
          <ul className="text-sm space-y-1">{res.exact_specs.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      )}

      {/* 6. do it yourself */}
      <div className="card p-4 space-y-2">
        <h3 className="font-bold">🔧 Do it yourself?</h3>
        <p className="font-bold" style={{ color: DIY[res.diy.doable].color }}>{DIY[res.diy.doable].label}</p>
        {res.diy.time && <p className="text-sm">⏱ About {res.diy.time}</p>}
        {res.diy.safety && <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>⚠️ {res.diy.safety}</p>}
        {!!res.diy.tools.length && <p className="text-sm"><b>Tools:</b> {res.diy.tools.join(", ")}</p>}
        {!!res.diy.steps.length && (
          <details><summary className="text-sm underline cursor-pointer">See the steps</summary>
            <ol className="text-sm space-y-1 pt-2 list-decimal pl-5">{res.diy.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>
        )}
        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(res.diy.video_search)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full" style={{ minHeight: 48 }}>▶️ Watch how it&apos;s done</a>
      </div>

      {(res.watch_out || res.cheaper_idea) && (
        <div className="card p-4 space-y-2 text-sm">
          {res.cheaper_idea && <p>💡 <b>Even cheaper:</b> {res.cheaper_idea}</p>}
          {res.watch_out && <p>👀 <b>Watch out:</b> {res.watch_out}</p>}
        </div>
      )}

      {!meId && (
        <div className="card p-4 space-y-2 text-center">
          <p className="font-bold">Keep this find?</p>
          <p className="text-sm muted">Make a free account and every find is saved in My lookups, next to what your stuff is worth.</p>
          <Link href="/signup?buyer=1&next=/find" className="btn btn-primary w-full" style={{ minHeight: 52 }}>Make my free account</Link>
        </div>
      )}
      {meId && plan === "free" && save >= 25 && (
        <div className="card p-3 text-sm text-center">🎉 That find could save you {money(save)}. <Link href="/pro#plans" className="underline font-semibold">Pro</Link> gives you 300 finds and lookups a month.</div>
      )}
      {meId && res.lookup_id && <p className="text-xs muted text-center">✓ Saved in <Link href="/lookups" className="underline">My lookups</Link></p>}
    </div>
  );
}

function HelpBox({ res, meId, feeText }: { res: FindOut; meId: string | null; feeText: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", contact: "", budget: "", notes: "", install: false });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  async function send() {
    setState("busy"); setErr(null);
    const r = await fetch("/api/find/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, query: res.query, what_it_is: res.what_it_is, best_price: res.best_price, shop_price_high: res.shop_price_high, lookup_id: res.lookup_id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setState("idle"); return setErr(j.error || "Couldn't send that. Try again."); }
    setState("done");
  }
  if (state === "done") return <div className="card p-4 text-center space-y-1" style={{ borderColor: "var(--ok)", borderWidth: 2 }}><p className="font-bold text-lg">🙌 Got it. We&apos;re on the hunt.</p><p className="text-sm muted">We&apos;ll reach out at {f.contact} when we find it. No find, no fee.</p></div>;
  return (
    <div className="card p-4 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
      {!open ? (
        <>
          <p className="font-bold">🙋 Too much hassle? Let us find it for you.</p>
          <p className="text-sm muted">We track down the right part at the best price and get it to you.</p>
          <button type="button" className="btn btn-primary w-full" style={{ minHeight: 52 }} onClick={() => setOpen(true)}>🙋 Find it for me</button>
        </>
      ) : (
        <>
          <p className="font-bold">🙋 We&apos;ll find it for you</p>
          <p className="text-sm">{feeText}</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Your name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label">Top budget $</label><input className="input" inputMode="decimal" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/[^\d.]/g, "") })} /></div>
          </div>
          <div><label className="label">Phone or email</label><input className="input" inputMode="email" required value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder={meId ? "Where should we reach you?" : "So we can tell you when we find it"} /></div>
          <div><label className="label">Anything else? (year, model, color)</label><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.install} onChange={(e) => setF({ ...f, install: e.target.checked })} /> I could use help getting it put in, too</label>
          {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
          <button type="button" className="btn btn-primary w-full" style={{ minHeight: 52 }} disabled={state === "busy" || !f.contact.trim()} onClick={send}>{state === "busy" ? "Sending…" : "Send it to us"}</button>
        </>
      )}
    </div>
  );
}
