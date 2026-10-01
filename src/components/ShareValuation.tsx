"use client";
import Link from "next/link";

import { useState } from "react";

/**
 * Share a valuation: one big tap makes its own public page (no name) that Google finds,
 * then opens the phone's share sheet so it can go to Facebook, texts, TikTok.
 * Every share is a new page on the site and a free ad.
 */
export default function ShareValuation({ payload, photoUrl }: { payload: Record<string, unknown>; photoUrl?: string | null }) {
  const [withPhoto, setWithPhoto] = useState(true);
  const [state, setState] = useState<"idle" | "busy" | { slug: string } | "err">("idle");
  async function share() {
    let slug = typeof state === "object" ? state.slug : null;
    if (!slug) {
      setState("busy");
      const r = await fetch("/api/valuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, photo_url: withPhoto ? photoUrl : null }) });
      const j = (await r.json().catch(() => ({}))) as { slug?: string };
      if (!j.slug) { setState("err"); return; }
      slug = j.slug; setState({ slug });
    }
    const url = `${window.location.origin}/valued/${slug}`;
    const low = Number(payload.value_low || 0), high = Number(payload.value_high || 0);
    const text = `Found out what this is worth: about $${Math.round(low)}–$${Math.round(high)}. Check yours free:`;
    try {
      if (navigator.share) await navigator.share({ title: String(payload.title || "What's it worth?"), text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch { /* closed the share sheet: the page is still made */ }
  }
  const done = typeof state === "object";
  return (
    <div className="card p-3 space-y-2" style={{ background: "color-mix(in srgb, var(--brand) 8%, var(--surface))", borderColor: "var(--brand)", borderWidth: 2 }}>
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={state === "busy"} onClick={share}>{state === "busy" ? "Making its page…" : state === "err" ? "Couldn't share; tap to try again" : done ? "📣 Share it again" : "📣 Share this find"}</button>
      {done ? (
        <p className="text-sm text-center" style={{ color: "var(--ok)" }}>✓ It has its own page now, so people searching Google for it can find it. <Link className="underline" href={`/valued/${(state as { slug: string }).slug}`}>See it</Link></p>
      ) : (
        <>
          <p className="text-xs muted text-center">Every share gets its own page that people searching Google can find. It helps the next person, and your friends can check theirs free. No name on it.</p>
          {photoUrl && <label className="flex items-center justify-center gap-2 text-xs"><input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} /> Include the photo</label>}
        </>
      )}
    </div>
  );
}
