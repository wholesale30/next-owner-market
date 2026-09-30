"use client";
import Link from "next/link";

import { useState } from "react";

/** Opt-in: publish this valuation (no name) to /valued so others searching for the same thing find it. */
export default function ShareValuation({ payload, photoUrl }: { payload: Record<string, unknown>; photoUrl?: string | null }) {
  const [withPhoto, setWithPhoto] = useState(true);
  const [state, setState] = useState<"idle" | "busy" | { slug: string } | "err">("idle");
  async function share() {
    setState("busy");
    const r = await fetch("/api/valuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, photo_url: withPhoto ? photoUrl : null }) });
    const j = (await r.json().catch(() => ({}))) as { slug?: string };
    setState(j.slug ? { slug: j.slug } : "err");
  }
  if (typeof state === "object") return <p className="card p-3 text-sm">✅ Shared. It&apos;s at <Link className="underline" href={`/valued/${state.slug}`}>nextownermarket.com/valued/{state.slug}</Link>. No name on it; you can hide it any time from My account.</p>;
  return (
    <div className="card p-3 text-sm space-y-2">
      <p className="font-semibold">Help the next person: share this valuation?</p>
      <p className="muted text-xs">It goes on our public &quot;What things are worth&quot; pages with the value and the reasons. No name, no location. People searching for this exact item find it, and so does Google.</p>
      {photoUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} /> Include the photo</label>}
      <button type="button" className="btn btn-secondary w-full" disabled={state === "busy"} onClick={share}>{state === "busy" ? "Sharing…" : state === "err" ? "Couldn't share; try again" : "Share it (no name)"}</button>
    </div>
  );
}
