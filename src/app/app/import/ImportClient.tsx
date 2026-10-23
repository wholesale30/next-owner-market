"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toCanvas, toBlob, fixLight, removeSpecks } from "@/lib/photo-edit";

/**
 * Bring old Facebook Marketplace ads into the app (Oct 23, 2026).
 * He uploads facebook_listings.json (made by the Claude panel in Chrome). For each ad:
 *  - photos come in through our server (Facebook links expire), get a fresh look: a different cover photo,
 *    a slight crop and a light touch-up, so the repost doesn't look like the same ad;
 *  - the old description becomes facts for the AI, which writes a new title and description;
 *  - his old price is kept (he knows his prices);
 *  - the old ad's link is saved so the Relist list can say "delete the old one first".
 */

type FbAd = { title: string; price: number | null; condition: string; description: string; photos: string[]; url: string; location: string };

function readAds(raw: unknown): FbAd[] {
  const arr = Array.isArray(raw) ? raw : (raw as { listings?: unknown[] })?.listings || [];
  return (arr as Record<string, unknown>[]).map((x) => {
    const p = String(x.price ?? "").replace(/[^0-9.]/g, "");
    const photos = (Array.isArray(x.photos) ? x.photos : Array.isArray(x.images) ? x.images : []).map(String).filter((s) => s.startsWith("http"));
    return {
      title: String(x.title || "").trim(),
      price: p ? Math.round(Number(p)) : null,
      condition: String(x.condition || "").trim(),
      description: String(x.description || "").trim(),
      photos: [...new Set(photos)],
      url: String(x.listing_url || x.url || "").trim(),
      location: String(x.location || "").trim(),
    };
  }).filter((a) => a.title || a.photos.length);
}

/** New cover: photo 2 goes first, old cover moves to the end. */
const reorder = (p: string[]) => (p.length > 1 ? [...p.slice(1, 2), ...p.slice(2), p[0]] : p);

/** Slight crop (about 4% off the edges) plus touch-up, so each photo is a new picture, not a copy. */
async function freshen(blob: Blob): Promise<Blob> {
  const c = await toCanvas(blob, 1600);
  const dx = Math.round(c.width * 0.04), dy = Math.round(c.height * 0.04);
  const o = document.createElement("canvas");
  o.width = c.width - dx * 2; o.height = c.height - dy * 2;
  o.getContext("2d")!.drawImage(c, dx, dy, o.width, o.height, 0, 0, o.width, o.height);
  removeSpecks(o); fixLight(o);
  return toBlob(o, 0.86);
}

const CONDITION: Record<string, string> = { new: "new", "used - like new": "like_new", "like new": "like_new", "used - good": "good", good: "good", "used - fair": "fair", fair: "fair" };

export default function ImportClient({ userId, already }: { userId: string; already: string[] }) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ads, setAds] = useState<FbAd[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const seen = useMemo(() => new Set(already), [already]);
  const todo = ads.filter((a) => !a.url || !seen.has(a.url));

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const list = readAds(JSON.parse(await f.text()));
      setAds(list);
      setLog(list.length ? [] : ["That file has no listings in it. Make sure it's facebook_listings.json from the Chrome panel."]);
    } catch {
      setLog(["Couldn't read that file. It should be facebook_listings.json."]);
    }
  }

  async function run() {
    setRunning(true);
    setLog([]);
    const say = (m: string) => setLog((l) => [...l, m]);
    let n = 0;
    for (const ad of todo) {
      n++;
      try {
        const facts = [
          ad.title && `Old ad title: ${ad.title}`,
          ad.condition && `Condition (seller said): ${ad.condition}`,
          ad.description && `Seller's facts from the old ad (rewrite in new words, don't copy): ${ad.description}`,
        ].filter(Boolean).join("\n");
        const { data: item, error } = await supabase.from("items").insert({
          owner_id: userId, created_by: userId, title: "", description: "", status: "draft", tier: "owned",
          condition_notes: facts || null, fb_location: ad.location || null, fb_old_url: ad.url || `fb-import-${crypto.randomUUID()}`,
        }).select("id, sku").single();
        if (error) throw error;
        let saved = 0;
        const order = reorder(ad.photos).slice(0, 20);
        for (let j = 0; j < order.length; j++) {
          try {
            const r = await fetch(`/api/import/photo?url=${encodeURIComponent(order[j])}`);
            if (!r.ok) continue;
            const blob = await freshen(await r.blob());
            const path = `${userId}/fb-${item.id}-${j}-${crypto.randomUUID().slice(0, 8)}.jpg`;
            const up = await supabase.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
            if (up.error) continue;
            const { data: pub } = supabase.storage.from("item-photos").getPublicUrl(path);
            await supabase.from("item_photos").insert({ item_id: item.id, storage_path: path, url: pub.publicUrl, sort_order: saved, is_primary: saved === 0 });
            saved++;
          } catch { /* skip one bad photo, keep going */ }
        }
        if (!saved) { say(`${n}/${todo.length} ⚠ ${ad.title || "No title"}: photos didn't come through (links may have expired). Saved as a draft; add photos by hand.`); setDone(n); continue; }
        const r = await fetch("/api/ai-listing/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) });
        const j = await r.json().catch(() => ({}));
        const keep: Record<string, unknown> = {};
        if (ad.price) keep.price = ad.price; // his price wins
        const cond = CONDITION[ad.condition.toLowerCase()];
        if (cond) keep.condition = cond;
        if (Object.keys(keep).length) await supabase.from("items").update(keep).eq("id", item.id);
        say(r.ok ? `${n}/${todo.length} ✓ ${j.title || ad.title} • ${saved} photos${ad.price ? ` • $${ad.price}` : ""}` : `${n}/${todo.length} ⚠ ${ad.title}: photos saved, AI rewrite failed (${j.error || "try again"}). Open it and tap Write listing.`);
      } catch (e) {
        say(`${n}/${todo.length} ⚠ ${ad.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
      setDone(n);
    }
    say("🎉 All in. Next: open the Relist list and do 10 a day.");
    setRunning(false);
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold">Bring in my Facebook ads</h1>
        <p className="muted text-sm">Pick <b>facebook_listings.json</b>. Every ad comes in with its photos in a new order and freshened up, a new AI-written listing, and your same price.</p>
      </div>

      <button type="button" className="btn btn-primary w-full" disabled={running} onClick={() => fileRef.current?.click()}>📂 Pick facebook_listings.json</button>
      <input ref={fileRef} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      {ads.length > 0 && (
        <div className="card p-3 space-y-2">
          <p className="font-semibold">{ads.length} ads found{ads.length - todo.length ? ` • ${ads.length - todo.length} already brought in` : ""}</p>
          <div className="flex gap-1 overflow-x-auto">
            {todo.slice(0, 12).map((a, i) => a.photos[0] ? <img key={i} src={`/api/import/photo?url=${encodeURIComponent(reorder(a.photos)[0])}`} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : null)}
          </div>
          <button type="button" className="btn btn-primary w-full" disabled={running || !todo.length} onClick={run}>
            {running ? `Working… ${done}/${todo.length}` : `✨ Bring in ${todo.length} ads`}
          </button>
          <p className="text-xs muted">Keep this screen open while it works (about 20 seconds an ad). If it stops, pick the file again: it skips the ones already done.</p>
        </div>
      )}

      {log.length > 0 && <pre className="card p-3 text-xs whitespace-pre-wrap">{log.join("\n")}</pre>}
      {!running && done > 0 && <Link href="/app/relist" className="btn btn-primary w-full">🔁 Open the Relist list</Link>}
    </div>
  );
}
