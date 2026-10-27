"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Mic from "@/components/Mic";
import { createClient } from "@/lib/supabase/client";
import type { DeepReport, QA } from "@/lib/deepcheck";

const money = (n: number | null | undefined) => (n ? `$${Math.round(n).toLocaleString()}` : "—");
const A = ({ href, children }: { href: string; children: React.ReactNode }) => <a className="underline" href={href} target="_blank" rel="noreferrer">{children}</a>;

export default function ReportView({ id, report: r, qa: qa0, notes, photos, createdAt, cost, itemId, meId }: { id: string; report: DeepReport & { listing_history?: unknown[] }; qa: QA[]; notes: string | null; photos: string[]; createdAt: string; cost: number; itemId: string | null; meId: string }) {
  const router = useRouter();
  const [qa, setQa] = useState(qa0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  // the listing can be rewritten on his say-so (Oct 26, 2026), with undo
  const [lst, setLst] = useState({ listing_title: r.listing_title, listing_description: r.listing_description, list_price: r.list_price, listing_keywords: r.listing_keywords });
  const [canUndo, setCanUndo] = useState(!!(r.listing_history || []).length);
  const [change, setChange] = useState("");
  const [lbusy, setLbusy] = useState<string | null>(null);
  const [lmsg, setLmsg] = useState("");

  async function rewrite(undo = false) {
    setLbusy(undo ? "Putting it back…" : "Rewriting…"); setLmsg("");
    const res = await fetch(`/api/deep/${id}/listing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(undo ? { undo: true } : { instruction: change }) });
    const j = (await res.json().catch(() => ({}))) as { listing?: typeof lst; canUndo?: boolean; error?: string };
    setLbusy(null);
    if (!res.ok || !j.listing) { setLmsg(j.error || "Couldn't change it. Try again."); return; }
    setLst(j.listing); setCanUndo(!!j.canUndo); if (!undo) setChange("");
    setLmsg(undo ? "↩ Put back the version before." : "✓ Changed. Check it below.");
  }

  async function makeListing() {
    setLbusy("Setting up your listing…"); setLmsg("");
    const sb = createClient();
    const { data, error } = await sb.from("items").insert({
      owner_id: meId, created_by: meId, title: lst.listing_title.slice(0, 80), description: lst.listing_description, tags: (lst.listing_keywords || []).slice(0, 25),
      brand: r.brand, model: r.model, price: lst.list_price || null, price_min_suggested: r.fast_price || null, price_max_suggested: r.top_price || null,
      status: "draft", ai_generated: true, local_pickup_ok: true, shipping_ok: false, shipping_mode: "calculated",
    }).select("id").single();
    if (error || !data) { setLbusy(null); setLmsg(error?.message || "Couldn't create the listing."); return; }
    if (photos.length) {
      const { error: pe } = await sb.from("item_photos").insert(photos.map((u, i) => ({ item_id: data.id, storage_path: u.split("/item-photos/")[1] || u, url: u, sort_order: i, is_primary: i === 0 })));
      if (pe) setLmsg(`Listing made, but the photos didn't attach: ${pe.message}`);
    }
    await sb.from("deep_reports").update({ item_id: data.id }).eq("id", id);
    router.push(`/app/items/${data.id}?written=1&from=deep#copy`);
  }

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
  const listing = `${lst.listing_title}\n\nPrice box: ${money(lst.list_price)}\n\n${lst.listing_description}${lst.listing_keywords?.length ? `\n\nKeywords: ${lst.listing_keywords.join(", ")}` : ""}`;

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
      <div className="grid grid-cols-2 gap-2">
        <a href={`/api/deep/${id}/docx`} className="btn btn-primary text-lg" style={{ minHeight: 56 }}>📄 Word white paper</a>
        <Link href="/app/deep#new" className="btn btn-primary text-lg" style={{ minHeight: 56 }}>🔬 Check another</Link>
      </div>
      <a href="#listing" className="btn btn-secondary w-full">📝 {itemId ? "Listing made: see it" : "Write the listing from this"}</a>

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

      <div id="listing" className="card p-3 space-y-2 scroll-mt-4">
        <p className="font-bold">📝 Your listing</p>
        <pre className="text-sm whitespace-pre-wrap">{listing}</pre>
        <p className="text-sm">{r.ship_or_pickup}</p>
        {itemId
          ? <Link href={`/app/items/${itemId}`} className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }}>✅ Listing made: open it</Link>
          : <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={!!lbusy} onClick={makeListing}>{lbusy === "Setting up your listing…" ? lbusy : "📝 Make it a listing in my app"}</button>}
        <button type="button" className="btn btn-secondary w-full" onClick={() => navigator.clipboard.writeText(listing).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? "✓ Copied" : "📋 Copy the listing"}</button>
        <p className="font-semibold text-sm pt-2">✏️ Want it different? Say what to change</p>
        <textarea className="input" rows={2} placeholder="Shorter. Price it at $150. Say it was serviced and the lamps are new. Take out the part about…" value={change} onChange={(e) => setChange(e.target.value)} />
        <Mic onText={(t) => setChange((h) => (h ? h.trimEnd() + " " : "") + t)} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" disabled={!!lbusy || !change.trim()} onClick={() => rewrite(false)}>{lbusy === "Rewriting…" ? lbusy : "✏️ Change it"}</button>
          <button type="button" className="btn btn-secondary" disabled={!!lbusy || !canUndo} onClick={() => rewrite(true)}>↩ Undo change</button>
        </div>
        {itemId && <p className="text-xs muted">Changes here don&apos;t touch the listing already made; edit that one on its own page.</p>}
        {lmsg && <p className="text-sm">{lmsg}</p>}
      </div>

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
      <Link href="/app/deep#new" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }}>🔬 Check another item</Link>
      <button type="button" className="btn btn-secondary w-full" onClick={del}>🗑 Delete this report</button>
    </div>
  );
}
