"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EditBox from "../EditBox";

type Listing = { adTitle: string | null; adPrice: number | null; id: string; title: string; price: number | null; category: string; location: string | null; rawDescription: string; condition: string; description: string; photos: string[]; oldUrl: string | null; postedTo: Record<string, string>; status: string };
type Removal = { id: string; title: string; price: number | null; adTitle: string | null; adPrice: number | null; oldUrl: string | null; photo: string | null };
type Props = { removal: Removal | null; state: "empty" | "day_done" | "wait" | "go" | "remove"; nextAt: string | null; done: number; perDay: number; waiting: number; gap: [number, number]; listing: Listing | null };

const CREATE = "https://www.facebook.com/marketplace/create/item";
const SELLING = "https://www.facebook.com/marketplace/you/selling";
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function NextClient({ removal, state, nextAt, done, perDay, waiting, gap, listing }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // while waiting, reload by itself right when the next one is due
  useEffect(() => {
    if (state !== "wait" || !nextAt) return;
    const ms = Math.max(1000, new Date(nextAt).getTime() - Date.now() + 1500);
    const t = setTimeout(() => router.refresh(), Math.min(ms, 2147483000));
    return () => clearTimeout(t);
  }, [state, nextAt, router]);

  async function posted() {
    if (!listing) return;
    setBusy(true);
    const at = new Date();
    const { data: s } = await supabase.from("settings").select("value").eq("key", "relist:settings").maybeSingle();
    const v = (s?.value || {}) as { drop?: boolean; pct?: number; days?: number; floorPct?: number };
    const drop = v.drop && listing.price ? { drop_pct: v.pct, drop_every_days: v.days, drop_floor: Math.max(1, Math.round(listing.price * (v.floorPct || 60) / 100)) } : {};
    const live = listing.status === "pending_review" ? { status: "active", listed_at: at.toISOString() } : {};
    // the new ad's link becomes the "old ad" to delete next time it's relisted
    const link = /^https:\/\/(www\.|m\.)?facebook\.com\/marketplace\/item\/\d+/.test(newUrl.trim()) ? { fb_old_url: newUrl.trim() } : {};
    await supabase.from("items").update({ ...link, fb_ad_title: listing.title, fb_ad_price: listing.price, fb_relisted_at: at.toISOString(), fb_posted_price: listing.price, posted_to: { ...listing.postedTo, facebook: at.toISOString() }, ...live, ...drop }).eq("id", listing.id);
    // random gap so posts don't land like clockwork (e.g. 7, then 13, then 5 minutes)
    const mins = gap[0] + Math.random() * Math.max(0, gap[1] - gap[0]);
    await supabase.from("settings").upsert({ key: "relist:next_at", value: { at: new Date(at.getTime() + mins * 60000).toISOString() } });
    setBusy(false);
    router.refresh();
  }

  async function removed() {
    if (!removal) return;
    setBusy(true);
    const at = new Date();
    await supabase.from("items").update({ fb_removed_at: at.toISOString(), fb_hold: true, fb_pick: null }).eq("id", removal.id);
    // deleting a few old ads in a row is normal: a short random 1-3 minutes between removals
    const mins = 1 + Math.random() * 2;
    await supabase.from("settings").upsert({ key: "relist:next_at", value: { at: new Date(at.getTime() + mins * 60000).toISOString() } });
    setBusy(false);
    router.refresh();
  }

  const copy = (label: string, text: string) => { navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1500); }); };

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold">📣 Next Facebook post</h1>
        <p className="muted text-sm">Today: {done} of {perDay} posted • {waiting} waiting in all • random {gap[0]}–{gap[1]} minutes apart</p>
      </div>

      {state === "empty" && <div className="card p-4 text-center space-y-2"><p className="text-xl font-bold">ALL DONE. Nothing marked ✅ Ready is left to post.</p><p className="muted text-sm">Mark more ✅ Ready on the Relist list when you&apos;ve checked them.</p><Link href="/app/import" className="btn btn-secondary w-full">📂 Bring in more Facebook ads</Link></div>}
      {state === "day_done" && <div className="card p-4 text-center"><p className="text-xl font-bold">✅ DONE FOR TODAY. STOP.</p><p className="muted">{done} posted today. The next ones are ready tomorrow.</p></div>}
      {state === "wait" && nextAt && <div className="card p-4 text-center"><p className="text-xl font-bold">⏳ WAIT. Next post at {time(nextAt)}.</p><p className="muted">This page shows the next listing by itself at that time.</p></div>}

      {state === "remove" && removal && (
        <div className="card p-3 space-y-2" style={{ borderColor: "var(--danger)" }}>
          <p className="text-xl font-bold">🗑 REMOVE ONLY. Delete this ad on Facebook. Do NOT post anything.</p>
          <div className="flex gap-3 items-center">
            {removal.photo && <img src={removal.photo} alt="" className="w-16 h-16 object-cover rounded" />}
            <p className="font-semibold">{removal.title}{removal.price ? ` • $${removal.price}` : ""}</p>
          </div>
          <a href={removal.oldUrl || SELLING} target="_blank" rel="noreferrer" className="btn btn-secondary w-full">🗑 Open the ad on Facebook</a>
          <p className="text-sm"><b>The ad on Facebook says:</b> &quot;{removal.adTitle || removal.title}&quot;{removal.adPrice ? ` • $${removal.adPrice}` : ""}</p>
          <p className="text-xs muted">Ad link: {removal.oldUrl || "not saved; find it on your selling page by its photo and title"}. Match it by this link and the Facebook title above. The app&apos;s own title may be newer wording; that&apos;s expected. It may also show as Sold; delete it anyway.</p>
          <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={busy} onClick={removed}>✅ I deleted it on Facebook</button>
        </div>
      )}

      {state === "go" && listing && (
        <div className="space-y-3">
          <div className="card p-3 space-y-2">
            <p className="font-bold">STEP 1. Delete the old ad</p>
            <a href={listing.oldUrl || SELLING} target="_blank" rel="noreferrer" className="btn btn-secondary w-full">🗑 Open the old ad</a>
            <p className="text-sm"><b>The old ad on Facebook says:</b> &quot;{listing.adTitle || "(not saved)"}&quot;{listing.adPrice ? ` • $${listing.adPrice}` : ""}</p>
            <p className="text-xs muted">Old ad link: {listing.oldUrl || "not saved; find it on your selling page by its photo"}. Match the old ad by this link and that old title. The new ad below has new wording, new photo order and maybe a new price on purpose, so it won&apos;t match the old one.</p>
          </div>

          <div className="card p-3 space-y-2">
            <p className="font-bold">STEP 2. Post the new ad</p>
            <EditBox id={listing.id} value={{ title: listing.title, price: listing.price, description: listing.rawDescription, location: listing.location }} onSaved={() => router.refresh()} />
            <a href={CREATE} target="_blank" rel="noreferrer" className="btn btn-primary w-full">➕ Open Facebook &quot;Create new listing&quot;</a>
            <dl className="text-sm space-y-1">
              <div><dt className="font-semibold inline">Title: </dt><dd className="inline" id="fb-title">{listing.title}</dd> <button className="pill" onClick={() => copy("title", listing.title)}>{copied === "title" ? "✓" : "Copy"}</button></div>
              <div><dt className="font-semibold inline">Price: </dt><dd className="inline" id="fb-price">{listing.price ?? ""}</dd></div>
              <div><dt className="font-semibold inline">Category: </dt><dd className="inline" id="fb-category">{listing.category}</dd></div>
              {listing.location && <div><dt className="font-semibold inline">Location: </dt><dd className="inline" id="fb-location">{listing.location}</dd></div>}
              <div><dt className="font-semibold inline">Condition: </dt><dd className="inline" id="fb-condition">{listing.condition}</dd></div>
            </dl>
            <div>
              <p className="font-semibold text-sm">Description: <button className="pill" onClick={() => copy("desc", listing.description)}>{copied === "desc" ? "✓ Copied" : "Copy"}</button></p>
              <pre id="fb-description" className="text-sm whitespace-pre-wrap card p-2">{listing.description}</pre>
            </div>
            <div>
              <p className="font-semibold text-sm">Photos, in this order ({listing.photos.length}):</p>
              <div className="grid grid-cols-3 gap-1">
                {listing.photos.map((u, i) => <a key={u} href={u} download={`photo-${i + 1}.jpg`} target="_blank" rel="noreferrer"><img src={u} alt={`Photo ${i + 1}`} className="aspect-square object-cover rounded" /></a>)}
              </div>
            </div>
          </div>

          <div className="card p-3 space-y-2">
            <p className="font-bold">STEP 3. Only after it&apos;s live on Facebook</p>
            <label className="block text-sm font-semibold">New ad link (paste the new Facebook listing&apos;s link)<input id="fb-new-url" className="input" placeholder="https://www.facebook.com/marketplace/item/…" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} /></label>
            <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={busy} onClick={posted}>✅ I posted it on Facebook</button>
            <p className="text-xs muted">Sets a random wait before the next one.</p>
          </div>
        </div>
      )}
      <Link href="/app/relist" className="btn btn-secondary w-full">← Relist list</Link>
    </div>
  );
}
