"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PriceCheck } from "@/lib/pricecheck";

export type PriceRow = { id: string; sku: string; title: string; price: number | null; status: string; drops: boolean; pc: PriceCheck | null; photo: string | null };
type Filter = "all" | "high" | "hold" | "unchecked";

export default function PricesClient({ rows: initial }: { rows: PriceRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, cost: 0, failed: 0 });
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");

  const unchecked = rows.filter((r) => !r.pc);
  const shown = rows.filter((r) => filter === "all" || (filter === "unchecked" ? !r.pc : filter === "hold" ? r.pc?.hold : !!r.pc && !!r.price && r.price > r.pc.list_price));

  async function checkOne(id: string) {
    setWorking((w) => ({ ...w, [id]: true }));
    try {
      const r = await fetch("/api/price-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRows((x) => x.map((y) => (y.id === id ? { ...y, pc: j } : y)));
      return j as PriceCheck;
    } finally {
      setWorking((w) => ({ ...w, [id]: false }));
    }
  }

  async function checkAll() {
    const ids = unchecked.map((r) => r.id);
    setRunning(true);
    setProgress({ done: 0, total: ids.length, cost: 0, failed: 0 });
    let i = 0;
    const worker = async () => {
      while (i < ids.length) {
        const id = ids[i++];
        try { const pc = await checkOne(id); setProgress((p) => ({ ...p, done: p.done + 1, cost: p.cost + (pc?.cost || 0) })); }
        catch { setProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 })); }
      }
    };
    await Promise.all([worker(), worker(), worker()]); // three at a time
    setRunning(false);
  }

  async function setPrice(r: PriceRow, price: number) {
    // keep automatic drops from going below the lowest price the comps support
    const extra = r.drops && r.pc ? { drop_floor: r.pc.floor_price } : {};
    await supabase.from("items").update({ price, ...extra }).eq("id", r.id);
    setRows((x) => x.map((y) => (y.id === r.id ? { ...y, price } : y)));
  }

  async function applyAll(kind: "list_price" | "fast_price") {
    const targets = rows.filter((r) => r.pc && !r.pc.hold && r.pc[kind] > 0 && r.price !== r.pc[kind]);
    if (!confirm(`Set ${targets.length} items to their ${kind === "list_price" ? "list" : "fast-sale"} price? Items marked HOLD are skipped.`)) return;
    for (const r of targets) await setPrice(r, r.pc![kind]);
    setNote(`✓ ${targets.length} prices changed. Facebook ones show on the Relist list to change there too.`);
  }

  const money = (n: number | null | undefined) => (n ? `$${n.toLocaleString()}` : "—");

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold">💲 Price check</h1>
        <p className="muted text-sm">Your price next to what real sales and listings say. <b>List</b> sells in 1–2 weeks, <b>Fast</b> sells in a few days, <b>Lowest</b> is where to stop. 🛑 HOLD means don&apos;t dump it.</p>
      </div>

      {unchecked.length > 0 && (
        <div className="card p-3 space-y-2">
          <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} disabled={running} onClick={checkAll}>
            {running ? `Checking… ${progress.done}/${progress.total}` : `🔎 Check prices on ${unchecked.length} item${unchecked.length === 1 ? "" : "s"}`}
          </button>
          <p className="text-xs muted">Searches real eBay sold, Marketplace and store prices for each one. About 20 seconds and about 15¢ each (AI plus searches). Keep this screen open.{progress.total ? ` So far: ${progress.done} done, ${progress.failed} failed, $${progress.cost.toFixed(2)}.` : ""}</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {([["all", `All ${rows.length}`], ["high", "Priced above List"], ["hold", "🛑 Hold"], ["unchecked", `Not checked ${unchecked.length}`]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} type="button" className={`pill shrink-0 ${filter === k ? "font-bold" : ""}`} style={filter === k ? { borderColor: "var(--brand)" } : {}} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {rows.some((r) => r.pc) && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => applyAll("list_price")}>Set all to List</button>
          <button type="button" className="btn btn-secondary" onClick={() => applyAll("fast_price")}>Set all to Fast</button>
        </div>
      )}
      {note && <p className="text-sm text-center">{note}</p>}

      {shown.map((r) => (
        <div key={r.id} className="card p-3 space-y-2">
          <div className="flex gap-3 items-center">
            {r.photo ? <img src={r.photo} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : <div className="w-16 h-16 rounded shrink-0" style={{ background: "var(--line)" }} />}
            <div className="min-w-0 flex-1">
              <Link href={`/app/items/${r.id}`} className="font-semibold truncate block">{r.title}</Link>
              <p className="text-sm">Yours: <b>{money(r.price)}</b>{r.pc?.hold && <span className="ml-2 font-bold" style={{ color: "var(--danger)" }}>🛑 HOLD</span>}</p>
            </div>
          </div>
          {r.pc ? (
            <>
              <div className="grid grid-cols-4 gap-1 text-center text-sm">
                {([["Top", r.pc.top_price], ["List", r.pc.list_price], ["Fast", r.pc.fast_price], ["Lowest", r.pc.floor_price]] as [string, number][]).map(([l, v]) => (
                  <div key={l} className="card p-1"><div className="muted text-xs">{l}</div><div className="font-bold">{money(v)}</div></div>
                ))}
              </div>
              <p className="text-sm">{r.pc.why}{r.pc.retail_new ? ` New retail: ${money(r.pc.retail_new)}.` : ""}</p>
              {r.pc.comps.length > 0 && (
                <details className="text-sm"><summary className="cursor-pointer muted">What it&apos;s based on ({r.pc.comps.length})</summary>
                  <ul className="mt-1 space-y-1">{r.pc.comps.map((c, i) => <li key={i}>{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="underline">{c.where}</a> : c.where}{c.sold ? " (sold)" : ""}: <b>{money(c.price)}</b> <span className="muted">{c.what}</span></li>)}</ul>
                </details>
              )}
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="btn btn-secondary" disabled={r.price === r.pc.list_price} onClick={() => setPrice(r, r.pc!.list_price)}>Use {money(r.pc.list_price)}</button>
                <button type="button" className="btn btn-secondary" disabled={r.price === r.pc.fast_price} onClick={() => setPrice(r, r.pc!.fast_price)}>Use {money(r.pc.fast_price)}</button>
                <button type="button" className="btn btn-secondary" disabled={!!working[r.id] || running} onClick={() => checkOne(r.id).catch((e) => alert(e.message))}>{working[r.id] ? "…" : "Re-check"}</button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn-secondary w-full" disabled={!!working[r.id] || running} onClick={() => checkOne(r.id).catch((e) => alert(e.message))}>{working[r.id] ? "Checking…" : "🔎 Check this one"}</button>
          )}
        </div>
      ))}
    </div>
  );
}
