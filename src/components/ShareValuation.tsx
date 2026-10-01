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
  // Step 1: put it on our site (no popup). Step 2 (optional button): send it to Facebook or a friend.
  async function publish() {
    setState("busy");
    const r = await fetch("/api/valuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, photo_url: withPhoto ? photoUrl : null }) });
    const j = (await r.json().catch(() => ({}))) as { slug?: string };
    setState(j.slug ? { slug: j.slug } : "err");
  }
  async function send() {
    if (typeof state !== "object") return;
    const url = `${window.location.origin}/valued/${state.slug}`;
    const low = Number(payload.value_low || 0), high = Number(payload.value_high || 0);
    const text = `Found out what this is worth: about $${Math.round(low)}–$${Math.round(high)}. Check yours free:`;
    try {
      if (navigator.share) await navigator.share({ title: String(payload.title || "What's it worth?"), text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch { /* closed */ }
  }
  const done = typeof state === "object";
  return (
    <div className="card p-3 space-y-2" style={{ background: "color-mix(in srgb, var(--brand) 8%, var(--surface))", borderColor: "var(--brand)", borderWidth: 2 }}>
      {done ? (
        <>
          <p className="text-base font-bold text-center" style={{ color: "var(--ok)" }}>✓ Shared on Next Owner Market</p>
          <p className="text-sm text-center">It has its own page now, so people searching Google for one can find it. <Link className="underline font-semibold" href={`/valued/${(state as { slug: string }).slug}`}>See your page</Link> · <Link className="underline" href="/valued">Everyone&apos;s finds</Link></p>
          <button type="button" className="btn btn-secondary w-full" onClick={send}>Also send it to Facebook or a friend</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={state === "busy"} onClick={publish}>{state === "busy" ? "Sharing…" : state === "err" ? "Couldn't share; tap to try again" : "📣 Share this find"}</button>
          <p className="text-sm text-center">🔒 <b>Private.</b> No name, no email, no address, no location. People only see the item, its photo and what it&apos;s worth.</p>
          <p className="text-xs muted text-center">It goes on our site as its own page that Google can find. It helps the next person with the same thing.</p>
          {photoUrl && <label className="flex items-center justify-center gap-2 text-xs"><input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} /> Include the photo</label>}
        </>
      )}
    </div>
  );
}
