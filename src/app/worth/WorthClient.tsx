"use client";

import Mic from "@/components/Mic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/photo";
import ShareValuation from "@/components/ShareValuation";

type Result = {
  what: string; era: string | null; condition_guess: string; value_low: number; value_high: number; retail_new: number | null; confidence: string; why: string;
  raise_value: string[]; best_places: { place: string; why: string }[]; ship_or_local: string; watch_out: string | null; listing: { title: string; description: string }; weight_lbs: number; box: string;
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function WorthClient({ meId, role, credits }: { meId: string | null; role: string | null; credits: number | null }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>([]);
  const [hints, setHints] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean } | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [left, setLeft] = useState(credits);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!meId) { router.push("/signup?buyer=1&next=/worth"); return; }
    setErr(null); setBusy("Uploading…");
    const sb = createClient();
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      try {
        const blob = await compressImage(f);
        const path = `worth/${meId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await sb.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        setPhotos((p) => [...p, { url: sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl, path }]);
      } catch (e) { setErr({ msg: e instanceof Error ? e.message : "Upload failed" }); }
    }
    setBusy(null);
  }

  async function appraise() {
    setBusy("Looking it over…"); setErr(null); setRes(null);
    const r = await fetch("/api/worth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos.map((p) => p.url), hints }) });
    const j = (await r.json()) as { result?: Result; error?: string; upgrade?: boolean };
    setBusy(null);
    if (!r.ok || !j.result) return setErr({ msg: j.error || "Couldn't get an answer.", upgrade: j.upgrade });
    setRes(j.result);
    if (left != null) setLeft(Math.max(0, left - 1));
  }

  async function listIt() {
    if (!res || !meId) return;
    setBusy("Setting up your listing…");
    const sb = createClient();
    if (role === "buyer") { const r = await fetch("/api/become-seller", { method: "POST" }); if (!r.ok) { setBusy(null); return setErr({ msg: "Couldn't switch your account to selling. Message us." }); } }
    const price = Math.round((res.value_low + res.value_high) / 2);
    const { data, error } = await sb.from("items").insert({
      owner_id: meId, created_by: meId, title: res.listing.title.slice(0, 80), description: res.listing.description, condition_notes: res.condition_guess,
      price, price_min_suggested: res.value_low, price_max_suggested: res.value_high, status: "draft", ai_generated: true,
      shipping_ok: res.ship_or_local !== "local" && res.box !== "freight", local_pickup_ok: true, weight_lbs: res.weight_lbs || null, box: res.box === "freight" ? "xl" : res.box || "medium", shipping_mode: "calculated",
    }).select("id").single();
    if (error || !data) { setBusy(null); return setErr({ msg: error?.message || "Couldn't create the listing." }); }
    await sb.from("item_photos").insert(photos.map((p, i) => ({ item_id: data.id, storage_path: p.path, url: p.url, sort_order: i, is_primary: i === 0 })));
    router.push(`/app/items/${data.id}/edit`);
  }

  function reset() { setPhotos([]); setRes(null); setHints(""); setErr(null); }

  return (
    <div className="space-y-4">
      {!res && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => <img key={p.path} src={p.url} alt="" className="aspect-square object-cover rounded-xl" />)}
            {photos.length < 6 && (
              <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm cursor-pointer" style={{ borderColor: "var(--brand)" }}>
                <span className="text-3xl">🖼</span><span className="font-semibold">{photos.length ? "Add more" : "Pick photos"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            )}
            {photos.length < 6 && (
              <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm cursor-pointer" style={{ borderColor: "var(--brand)" }}>
                <span className="text-3xl">📸</span><span className="font-semibold">Take a photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <p className="text-xs muted">Get the whole thing in one photo, then close-ups of any label, model number, or damage. Up to 6.</p>
          <div className="space-y-1"><textarea className="input" rows={3} style={{ minHeight: 72, fieldSizing: "content" } as React.CSSProperties} placeholder="Anything we should know? (works, missing the lid, grandma's…)" value={hints} onChange={(e) => setHints(e.target.value)} /><Mic onText={(t) => setHints((h) => (h ? h.trimEnd() + " " : "") + t)} /></div>
          <button type="button" className="btn btn-primary w-full text-lg" disabled={!photos.length || !!busy} onClick={appraise}>{busy || "What's it worth?"}</button>
          {left != null && meId && <p className="text-xs muted text-center">{left} free lookup{left === 1 ? "" : "s"} left · <Link href="/pro" className="underline">Pro = unlimited</Link></p>}
          {!meId && <p className="text-xs muted text-center">Free. You&apos;ll make a free account first so we can save your results.</p>}
        </div>
      )}

      {err && <div className="card p-3 text-sm" style={{ borderColor: "var(--danger)" }}>{err.msg}{err.upgrade && <div className="pt-2 space-y-2"><button type="button" className="btn btn-primary w-full" onClick={async () => { const r = await fetch("/api/stripe/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "thrift", back: "/worth" }) }); const j = (await r.json().catch(() => ({}))) as { url?: string }; if (j.url) window.location.assign(j.url); }}>Unlimited checks: Thrift Pro, $3.99 a month</button><p className="text-xs muted text-center">Or <Link href="/pro" className="underline">Pro</Link> ($15) for unlimited listings for nine sites too.</p></div>}</div>}

      {res && (
        <div className="space-y-3">
          <div className="card p-4 space-y-2">
            <div className="flex gap-2">
              {photos[0] && <img src={photos[0].url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />}
              <div className="min-w-0"><p className="font-bold leading-tight">{res.what}</p>{res.era && <p className="text-xs muted">{res.era}</p>}<p className="text-sm muted">{res.condition_guess}</p></div>
            </div>
            <div className="text-center py-2">
              <p className="text-xs muted uppercase tracking-wide">Worth about</p>
              <p className="text-4xl font-extrabold">{money(res.value_low)} – {money(res.value_high)}</p>
              <p className="text-xs muted">{res.retail_new ? `New today: ${money(res.retail_new)} · ` : ""}Confidence: {res.confidence}</p>
            </div>
            <p className="text-sm">{res.why}</p>
            {res.watch_out && <p className="text-sm p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>⚠ {res.watch_out}</p>}
          </div>
          <ShareValuation photoUrl={photos[0]?.url} payload={{ source: "worth", title: res.what, era: res.era, condition: res.condition_guess, value_low: res.value_low, value_high: res.value_high, retail_new: res.retail_new, confidence: res.confidence, why: res.why, raise_value: res.raise_value, best_places: res.best_places, ship_or_local: res.ship_or_local, watch_out: res.watch_out }} />
          <button type="button" className="btn btn-secondary w-full text-lg" style={{ minHeight: 52 }} onClick={reset}>📸 Check another item</button>
          <div className="card p-4 space-y-2 text-sm">
            <p className="font-semibold">Where it sells best</p>
            {res.best_places.map((b, i) => <p key={i}><b>{i + 1}. {b.place}</b> <span className="muted">— {b.why}</span></p>)}
            <p className="text-xs muted">{res.ship_or_local === "local" ? "Too big or heavy to ship; sell it local." : res.ship_or_local === "ship" ? "Ships fine; opens you up to buyers nationwide." : "Works local or shipped."}</p>
          </div>
          {res.raise_value?.length > 0 && (
            <div className="card p-4 text-sm"><p className="font-semibold mb-1">Get more for it</p><ul className="list-disc pl-5 space-y-1">{res.raise_value.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
          )}
          <div className="card p-4 space-y-2 text-center" style={{ borderColor: "var(--brand)" }}>
            <p className="font-bold">Want to sell it?</p>
            <p className="text-sm muted">One tap. Photos, title, description, and price are already written. You just check it and hit List. Listing here is free; you also get the Facebook version to paste, and Pro gets all nine marketplaces.</p>
            <button type="button" className="btn btn-primary w-full text-lg" disabled={!!busy} onClick={listIt}>{busy || "List it now"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
