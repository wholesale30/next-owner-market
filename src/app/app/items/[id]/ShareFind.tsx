"use client";

import { useState } from "react";
import Link from "next/link";

/** On a live listing: one tap makes its "find" page too (a second page for Google), then send it anywhere. */
export default function ShareFind({ itemId, sku, title, shared: startSlug }: { itemId: string; sku: string; title: string; shared: string | null }) {
  const [slug, setSlug] = useState<string | null>(startSlug);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function share() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/items/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    const j = (await r.json().catch(() => ({}))) as { slug?: string; error?: string };
    setBusy(false);
    if (!j.slug) return setErr(j.error || "Couldn't share it. Try again.");
    setSlug(j.slug);
  }
  async function send() {
    const url = `${window.location.origin}/item/${sku}`;
    try { if (navigator.share) await navigator.share({ title, text: `${title}, for sale:`, url }); else { await navigator.clipboard.writeText(url); setErr("Link copied. Paste it anywhere."); } } catch { /* closed */ }
  }
  const box = { background: "color-mix(in srgb, var(--brand) 8%, var(--surface))", borderColor: "var(--brand)", borderWidth: 2 } as const;
  if (slug) return (
    <div className="card p-3 space-y-2" style={box}>
      <p className="text-base font-bold text-center" style={{ color: "var(--ok)" }}>✓ Shared: it&apos;s on the internet twice now</p>
      <p className="text-sm text-center">Your listing, plus its <Link href={`/valued/${slug}`} className="underline font-semibold">find page</Link> with a Buy button back to it. Both are sent to the search engines.</p>
      <button type="button" className="btn btn-primary w-full" style={{ minHeight: 48 }} onClick={send}>📲 Also send it to Facebook or a friend</button>
      {err && <p className="text-xs text-center muted">{err}</p>}
    </div>
  );
  return (
    <div className="card p-3 space-y-2" style={box}>
      <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={busy} onClick={share}>{busy ? "Sharing…" : "📣 Share this find"}</button>
      <p className="text-sm text-center">Gives it a second page on our site that links back to your listing, so it shows up on the internet twice. Free.</p>
      {err && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
