"use client";

import Mic from "@/components/Mic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/photo";
import ShareValuation from "@/components/ShareValuation";
import FixBox from "@/components/FixBox";
import PartsBox, { type PartView } from "@/components/PartsBox";
import PhotoEditor from "@/components/PhotoEditor";
import OutOfUses from "@/components/OutOfUses";
import ConditionLadder, { type LadderView } from "@/components/ConditionLadder";

type Piece = { name: string; qty: number; value_low: number; value_high: number; note: string; listing_title: string; listing_description: string };
type Result = {
  missing_parts?: PartView[]; condition_ladder?: LadderView | null; pieces?: Piece[]; sell_advice?: string | null;
  what: string; era: string | null; condition_guess: string; value_low: number; value_high: number; retail_new: number | null; confidence: string; why: string;
  raise_value: string[]; best_places: { place: string; why: string }[]; ship_or_local: string; watch_out: string | null; listing: { title: string; description: string; condition?: string }; weight_lbs: number; box: string;
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export type SavedWorth = { id: string; photo_urls: string[]; hints: string | null; result: unknown };
const pathOf = (url: string) => url.split("/item-photos/")[1] || url;
const newPath = (meId: string | null) => `worth/${meId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

export default function WorthClient({ meId, role, credits, plan, initial }: { meId: string | null; role: string | null; credits: number | null; plan?: string | null; initial?: SavedWorth | null }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>(() => (initial?.photo_urls || []).map((url) => ({ url, path: pathOf(url) })));
  const [hints, setHints] = useState(initial?.hints || "");
  const [lookupId, setLookupId] = useState<string | null>(initial?.id || null);
  const [photosChanged, setPhotosChanged] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean; topup?: boolean } | null>(null);
  const [res, setRes] = useState<Result | null>((initial?.result as Result) || null);
  const [left, setLeft] = useState(credits);
  const [editing, setEditing] = useState<number | null>(null);
  const [fixes, setFixes] = useState(0); // remounts the share box after a fix so it shares the corrected answer

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!meId) { router.push("/signup?buyer=1&next=/worth"); return; }
    setErr(null); setBusy("Uploading…");
    const sb = createClient();
    const added: { url: string; path: string }[] = [];
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      try {
        const blob = await compressImage(f);
        const path = newPath(meId);
        const { error } = await sb.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const ph = { url: sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl, path };
        added.push(ph);
        setPhotos((p) => [...p, ph]);
      } catch (e) { setErr({ msg: e instanceof Error ? e.message : "Upload failed" }); }
    }
    setBusy(null);
    if (res && added.length) { setPhotosChanged(true); savePhotos([...photos, ...added]); }
  }

  /** Keep the saved lookup's photos in step (added, removed, touched up). */
  function savePhotos(list: { url: string }[]) {
    if (!lookupId) return;
    fetch("/api/lookups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "photos", id: lookupId, photo_urls: list.map((p) => p.url) }) }).catch(() => {});
  }
  function removePhoto(i: number) {
    const next = photos.filter((_, j) => j !== i);
    setPhotos(next);
    if (res) savePhotos(next);
  }

  async function saveEdit(i: number, blob: Blob) {
    const sb = createClient();
    const path = newPath(meId);
    const { error } = await sb.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const next = photos.map((x, j) => (j === i ? { url: sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl, path } : x));
    setPhotos(next);
    setEditing(null);
    if (res) savePhotos(next);
  }

  async function appraise() {
    setBusy("Looking it over…"); setErr(null); setRes(null);
    const r = await fetch("/api/worth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos.map((p) => p.url), hints }) });
    const j = (await r.json()) as { result?: Result; error?: string; upgrade?: boolean; topup?: boolean; lookup_id?: string | null };
    setBusy(null);
    if (j.lookup_id) setLookupId(j.lookup_id);
    if (!r.ok || !j.result) return setErr({ msg: j.error || "Couldn't get an answer.", upgrade: j.upgrade, topup: j.topup });
    setRes(j.result);
    if (left != null) setLeft(Math.max(0, left - 1));
  }

  async function fix(correction: string): Promise<string | null> {
    if (!res) return "Nothing to fix yet.";
    const r = await fetch("/api/worth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrls: photos.map((p) => p.url), hints, correction, lookup_id: lookupId, previous: { what: res.what, value_low: res.value_low, value_high: res.value_high, era: res.era } }) });
    const j = (await r.json().catch(() => ({}))) as { result?: Result; error?: string; topup?: boolean };
    if (r.status === 402) { setErr({ msg: j.error || "You're out of AI uses.", topup: true }); return "You're out of AI uses for now. See the box below."; }
    if (!r.ok || !j.result) return j.error || "Couldn't update it. Try again.";
    setRes(j.result); setHints((h) => (h ? h + ". " : "") + correction); setFixes((n) => n + 1); setPhotosChanged(false);
    return null;
  }

  async function listIt(piece?: Piece) {
    if (!res || !meId) return;
    setBusy(piece ? `Writing ${piece.name}…` : "Setting up your listing…");
    const sb = createClient();
    if (role === "buyer") { const r = await fetch("/api/become-seller", { method: "POST" }); if (!r.ok) { setBusy(null); return setErr({ msg: "Couldn't switch your account to selling. Message us." }); } }
    const lo = piece ? piece.value_low : res.value_low, hi = piece ? piece.value_high : res.value_high;
    const price = Math.round((lo + hi) / 2);
    const { data, error } = await sb.from("items").insert({
      owner_id: meId, created_by: meId, title: (piece ? piece.listing_title || piece.name : res.listing.title).slice(0, 80), description: piece ? piece.listing_description : res.listing.description, condition_notes: res.listing.condition || res.condition_guess,
      price, price_min_suggested: lo, price_max_suggested: hi, status: "draft", ai_generated: true,
      shipping_ok: res.ship_or_local !== "local" && res.box !== "freight", local_pickup_ok: true, weight_lbs: res.weight_lbs || null, box: res.box === "freight" ? "xl" : res.box || "medium", shipping_mode: "calculated",
    }).select("id").single();
    if (error || !data) { setBusy(null); return setErr({ msg: error?.message || "Couldn't create the listing." }); }
    await sb.from("item_photos").insert(photos.map((p, i) => ({ item_id: data.id, storage_path: p.path, url: p.url, sort_order: i, is_primary: i === 0 })));
    if (lookupId) await fetch("/api/lookups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listed", id: lookupId, item_id: data.id }) }).catch(() => {});
    router.push(`/app/items/${data.id}?written=1#copy`);
  }

  const lot = !!res?.pieces?.length;
  const count = (res?.pieces || []).reduce((a, x) => a + (Number(x.qty) || 1), 0);
  const apart = (res?.pieces || []).reduce((a, x) => [a[0] + x.value_low * (Number(x.qty) || 1), a[1] + x.value_high * (Number(x.qty) || 1)], [0, 0]);

  function reset() { setPhotos([]); setRes(null); setHints(""); setErr(null); setFixes(0); setLookupId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return (
    <div className="space-y-4">
      {editing != null && photos[editing] && <PhotoEditor src={photos[editing].url} onClose={() => setEditing(null)} onSave={(b) => saveEdit(editing, b)} />}
      {!res && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <button key={p.path} type="button" onClick={() => setEditing(i)} className="relative aspect-square">
                <img src={p.url} alt="" className="w-full h-full object-cover rounded-xl" />
                <span className="absolute bottom-1 inset-x-1 text-xs font-bold rounded-lg py-1" style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}>✨ Touch up</span>
              </button>
            ))}
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
          {left != null && meId && <p className="text-xs muted text-center">{plan === "free" ? `${left} free lookup${left === 1 ? "" : "s"} left` : plan === "thrift" ? `${left} checks left today` : `${left} AI uses left this month`}{plan === "free" && <> · <Link href="/pro#plans" className="underline">Get more</Link></>}</p>}
          {!meId && <p className="text-xs muted text-center">Free. You&apos;ll make a free account first so we can save your results.</p>}
        </div>
      )}

      {err && (err.topup ? <OutOfUses message={err.msg} back="/worth" thrift={plan === "free"} /> : <div className="card p-3 text-sm" style={{ borderColor: "var(--danger)" }}>{err.msg}</div>)}

      {res && (
        <div className="space-y-3">
          <div className="card p-4 space-y-2">
            <div className="flex gap-2">
              {photos[0] && <img src={photos[0].url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />}
              <div className="min-w-0"><p className="font-bold leading-tight">{res.what}</p>{res.era && <p className="text-xs muted">{res.era}</p>}<p className="text-sm muted">{res.condition_guess}</p></div>
            </div>
            <div className="text-center py-2">
              <p className="text-xs muted uppercase tracking-wide">{lot ? `All ${count} together, sold as one lot` : "Worth about"}</p>
              <p className="text-4xl font-extrabold">{money(res.value_low)} – {money(res.value_high)}</p>
              <p className="text-xs muted">{res.retail_new ? `New today: ${money(res.retail_new)} · ` : ""}Confidence: {res.confidence}</p>
            </div>
            <p className="text-sm">{res.why}</p>
            {res.watch_out && <p className="text-sm p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>⚠ {res.watch_out}</p>}
          </div>
          <div className="card p-4 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 2 }}>
            <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={!!busy} onClick={() => listIt()}>{busy || (lot ? "📝 Write the listing for the lot" : "📝 Write my listing")}</button>
            <p className="text-xs muted text-center">One tap: your Facebook post is written, plus eBay, OfferUp, Mercari and 5 more. Free to list here.</p>
            <p className="text-sm font-semibold pt-1">Your photos <span className="muted font-normal text-xs">· tap one to ✨ touch it up</span></p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <div key={p.path} className="relative shrink-0">
                  <button type="button" onClick={() => setEditing(i)} className="block">
                    <img src={p.url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <span className="absolute bottom-1 left-1 text-xs rounded-full px-1" style={{ background: "var(--brand)", color: "#fff" }}>✨</span>
                  </button>
                  {photos.length > 1 && <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo" className="absolute -top-1 -right-1 w-6 h-6 rounded-full text-white text-xs" style={{ background: "rgba(0,0,0,.7)" }}>×</button>}
                </div>
              ))}
              {photos.length < 6 && (
                <>
                  <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-xs font-semibold cursor-pointer" style={{ borderColor: "var(--brand)" }}>
                    <span className="text-xl">🖼</span>Add
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                  <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-xs font-semibold cursor-pointer" style={{ borderColor: "var(--line)" }}>
                    <span className="text-xl">📸</span>Camera
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                </>
              )}
            </div>
            {photosChanged && <button type="button" className="btn btn-secondary w-full" disabled={!!busy} onClick={async () => { setBusy("Looking again…"); const m = await fix("I added more photos. Look again at all of them."); setBusy(null); if (m) setErr({ msg: m }); }}>{busy === "Looking again…" ? busy : "🔄 Re-check with the new photos"}</button>}
          </div>
          {lot && (
            <div className="card p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">Sold one at a time</p>
                <p className="text-xl font-extrabold whitespace-nowrap">{money(apart[0])} – {money(apart[1])}</p>
              </div>
              {res.sell_advice && <p className="text-sm p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--brand) 10%, var(--surface))" }}>💡 {res.sell_advice}</p>}
              {res.pieces!.map((x, i) => (
                <div key={i} className="border-t pt-2 space-y-1" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight">{x.name}{x.qty > 1 ? ` ×${x.qty}` : ""}</p>
                    <p className="font-bold whitespace-nowrap">{money(x.value_low)}–{money(x.value_high)}{x.qty > 1 ? " each" : ""}</p>
                  </div>
                  <p className="text-sm muted">{x.note}</p>
                  <details className="text-sm"><summary className="underline cursor-pointer">Its own description</summary><p className="pt-1 font-semibold">{x.listing_title}</p><p className="whitespace-pre-wrap">{x.listing_description}</p></details>
                  <button type="button" className="btn btn-secondary w-full" disabled={!!busy} onClick={() => listIt(x)}>📝 List this one by itself</button>
                </div>
              ))}
            </div>
          )}
          <ConditionLadder l={res.condition_ladder} nowLow={res.value_low} nowHigh={res.value_high} />
          <PartsBox parts={res.missing_parts} nowLow={res.value_low} nowHigh={res.value_high} />
          <FixBox onFix={fix} />
          <ShareValuation key={fixes} photoUrl={photos[0]?.url} payload={{ source: "worth", title: res.what, era: res.era, condition: res.condition_guess, value_low: res.value_low, value_high: res.value_high, retail_new: res.retail_new, confidence: res.confidence, why: res.why, raise_value: res.raise_value, best_places: res.best_places, ship_or_local: res.ship_or_local, watch_out: res.watch_out }} />
          <button type="button" className="btn btn-secondary w-full text-lg" style={{ minHeight: 52 }} onClick={reset}>📸 Check another item</button>
          <div className="card p-4 space-y-2 text-sm">
            <p className="font-semibold">Where it sells best</p>
            {res.best_places.map((b, i) => <p key={i}><b>{i + 1}. {b.place}</b> <span className="muted">— {b.why}</span></p>)}
            <p className="text-xs muted">{res.ship_or_local === "local" ? "Too big or heavy to ship; sell it local." : res.ship_or_local === "ship" ? "Ships fine; opens you up to buyers nationwide." : "Works local or shipped."}</p>
          </div>
          {res.raise_value?.length > 0 && (
            <div className="card p-4 text-sm"><p className="font-semibold mb-1">Get more for it</p><ul className="list-disc pl-5 space-y-1">{res.raise_value.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
          )}
        </div>
      )}
    </div>
  );
}
