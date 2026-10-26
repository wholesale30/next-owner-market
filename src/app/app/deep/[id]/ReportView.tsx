"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Mic from "@/components/Mic";
import { createClient } from "@/lib/supabase/client";
import type { DeepReport, QA } from "@/lib/deepcheck";

const money = (n: number | null | undefined) => (n ? `$${Math.round(n).toLocaleString()}` : "—");
const A = ({ href, children }: { href: string; children: React.ReactNode }) => <a className="underline" href={href} target="_blank" rel="noreferrer">{children}</a>;

export default function ReportView({ id, report: r, qa: qa0, notes, photos, createdAt, cost }: { id: string; report: DeepReport; qa: QA[]; notes: string | null; photos: string[]; createdAt: string; cost: number }) {
  const router = useRouter();
  const [qa, setQa] = useState(qa0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true); setErr("");
    const res = await fetch(`/api/deep/${id}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
    const j = (await res.json().catch(() => ({}))) as { qa?: QA; error?: string };
    setBusy(false);
    if (j.qa) { setQa((x) => [...x, j.qa!]); setQ(""); }
    if (!res.ok) setErr(j.error || "Couldn't answer that. Try again.");
  }
  async function del() {
    if (!window.confirm("Delete this report for good?")) return;
    const { error } = await createClient().from("deep_reports").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    router.push("/app/deep");
  }
  const listing = `${r.listing_title}\n\nPrice box: ${money(r.list_price)}\n\n${r.listing_description}${r.listing_keywords.length ? `\n\nKeywords: ${r.listing_keywords.join(", ")}` : ""}`;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Link href="/app/deep" className="text-sm underline">← All reports</Link>
      <h1 className="text-2xl font-bold">{r.what}</h1>
      <p className="text-xs muted">{new Date(createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })}{r.era ? ` · Made ${r.era}` : ""} · {r.searches} searches · cost about ${cost.toFixed(2)}</p>

      <div className="card p-4 space-y-1">
        <p className="text-3xl font-bold">{money(r.expected_price)}</p>
        <p className="text-sm">List {money(r.list_price)} · Fast {money(r.fast_price)} · Top {money(r.top_price)}{r.hold ? " · 💎 Hold for top dollar" : ""}</p>
        <p className="text-sm">{r.summary}</p>
      </div>
      <a href={`/api/deep/${id}/docx`} className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }}>📄 Download the Word white paper</a>

      {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map((u) => <img key={u} src={u} alt="" className="w-full aspect-square object-cover rounded-xl" />)}</div>}
      {notes && <p className="text-sm muted">Your notes: {notes}</p>}

      <details className="card p-3" open><summary className="font-bold cursor-pointer">💲 What it&apos;s worth</summary>
        <div className="space-y-2 mt-2 text-sm">
          <p>{r.value_why}</p>
          <p>New / original: {money(r.retail_new)} · For parts: {money(r.parts_value)} · Scrap: {money(r.scrap_value)}</p>
          {r.comps.length > 0 && <ul className="space-y-1">{r.comps.map((c, i) => <li key={i}>• {c.where}: {c.url ? <A href={c.url}>{c.what}</A> : c.what} <b>{money(c.price)}</b> {c.sold ? "(sold)" : "(asking)"}</li>)}</ul>}
          {r.who_buys.length > 0 && <><p className="font-semibold">Who buys it</p><ul>{r.who_buys.map((t, i) => <li key={i}>• {t}</li>)}</ul></>}
          {r.alternate_uses.length > 0 && <><p className="font-semibold">Parts and other uses</p><ul>{r.alternate_uses.map((t, i) => <li key={i}>• {t}</li>)}</ul></>}
        </div>
      </details>

      <details className="card p-3" open><summary className="font-bold cursor-pointer">🔧 How to test it</summary>
        <div className="space-y-2 mt-2 text-sm">
          {r.safety.length > 0 && <div className="p-2 rounded-lg" style={{ border: "2px solid var(--danger)" }}><p className="font-bold">⚠ Safety first</p><ul>{r.safety.map((t, i) => <li key={i}>• {t}</li>)}</ul></div>}
          {r.tools_needed.length > 0 && <><p className="font-semibold">Tools you need</p><ul>{r.tools_needed.map((t, i) => <li key={i}>• {t}</li>)}</ul></>}
          <ol className="space-y-3">{r.test_steps.map((s, i) => (
            <li key={i} className="card p-2"><p className="font-bold">Step {i + 1}. {s.title}</p><p>{s.how}</p><p>✅ Good: {s.good}</p><p>❌ Problem: {s.bad}</p></li>
          ))}</ol>
          {r.check_before_listing.length > 0 && <><p className="font-semibold">Check these before you price it</p><ul>{r.check_before_listing.map((t, i) => <li key={i}>• {t}</li>)}</ul></>}
        </div>
      </details>

      {r.common_faults.length > 0 && <details className="card p-3"><summary className="font-bold cursor-pointer">🩺 Known problems and fixes</summary>
        <ul className="space-y-2 mt-2 text-sm">{r.common_faults.map((f, i) => <li key={i}><b>{f.fault}</b>. Signs: {f.signs}. Fix: {f.fix}. Cost: {f.cost}.</li>)}</ul>
        {r.value_after_fix && <p className="text-sm mt-2">{r.value_after_fix}</p>}
      </details>}

      {r.specs.length > 0 && <details className="card p-3"><summary className="font-bold cursor-pointer">📐 Specs</summary>
        <ul className="mt-2 text-sm">{r.specs.map((s, i) => <li key={i}><b>{s.label}:</b> {s.value}</li>)}</ul></details>}

      {(r.manuals.length > 0 || r.parts_sources.length > 0) && <details className="card p-3"><summary className="font-bold cursor-pointer">📘 Manuals and parts</summary>
        <ul className="mt-2 text-sm space-y-1">{r.manuals.map((m, i) => <li key={i}>• <A href={m.url!}>{m.title}</A></li>)}{r.parts_sources.map((s, i) => <li key={`p${i}`}>• {s.part}: {s.url ? <A href={s.url}>{s.where}</A> : s.where}</li>)}</ul></details>}

      <details className="card p-3"><summary className="font-bold cursor-pointer">📝 Ready-to-paste listing</summary>
        <pre className="text-sm whitespace-pre-wrap mt-2">{listing}</pre>
        <p className="text-sm">{r.ship_or_pickup}</p>
        <button type="button" className="btn btn-secondary w-full mt-2" onClick={() => navigator.clipboard.writeText(listing).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? "✓ Copied" : "📋 Copy the listing"}</button>
      </details>

      <div className="card p-3 space-y-2">
        <p className="font-bold">💬 Ask more about it</p>
        {qa.map((x, i) => (
          <div key={i} className="text-sm space-y-1 border-t pt-2"><p className="font-semibold">Q: {x.q}</p><p className="whitespace-pre-wrap">{x.a}</p>{x.links.length > 0 && <ul>{x.links.map((l, j) => <li key={j}>• <A href={l.url!}>{l.title}</A></li>)}</ul>}</div>
        ))}
        <textarea className="input" rows={3} placeholder="How do I check the bias? What's the belt size? Is it worth recapping?…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Mic onText={(t) => setQ((h) => (h ? h.trimEnd() + " " : "") + t)} />
        <button type="button" className="btn btn-primary w-full" disabled={busy || !q.trim()} onClick={ask}>{busy ? "Looking it up… (up to a minute)" : "Ask"}</button>
        <p className="text-xs muted">Answers are saved in this report and go into the Word white paper.</p>
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      </div>

      {r.sources.length > 0 && <details className="card p-3"><summary className="font-bold cursor-pointer">🔗 Sources</summary><ul className="mt-2 text-sm">{r.sources.map((s, i) => <li key={i}>• <A href={s.url!}>{s.title}</A></li>)}</ul></details>}
      <button type="button" className="btn btn-secondary w-full" onClick={del}>🗑 Delete this report</button>
    </div>
  );
}
