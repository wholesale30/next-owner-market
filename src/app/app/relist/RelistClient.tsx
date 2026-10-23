"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Relist list (Oct 23, 2026): old Facebook ads brought in by the importer, 10 a day.
 * Order for each one matters: delete the old ad FIRST, then post the new one (two of the same ad up at once
 * is what gets Marketplace listings flagged as duplicates).
 */
type Row = { id: string; sku: string; title: string; price: number | null; oldUrl: string | null; postedTo: Record<string, string>; photo: string | null };
const PER_DAY = 10;

export default function RelistClient({ items, doneToday }: { items: Row[]; doneToday: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(items);
  const [today, setToday] = useState(doneToday);
  const [deleted, setDeleted] = useState<Record<string, boolean>>({});
  const left = Math.max(0, PER_DAY - today);
  const now = rows.slice(0, Math.max(left, 0));

  async function reposted(r: Row) {
    const at = new Date().toISOString();
    await supabase.from("items").update({ fb_relisted_at: at, posted_to: { ...r.postedTo, facebook: at } }).eq("id", r.id);
    setRows((x) => x.filter((y) => y.id !== r.id));
    setToday((t) => t + 1);
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold">🔁 Relist list</h1>
        <p className="muted text-sm">{rows.length} old Facebook ads waiting • {today} reposted today. Do {PER_DAY} a day so Facebook doesn&apos;t flag you.</p>
      </div>

      {!rows.length && (
        <div className="card p-4 space-y-2 text-center">
          <p className="font-semibold">Nothing waiting.</p>
          <Link href="/app/import" className="btn btn-primary w-full">📂 Bring in my Facebook ads</Link>
        </div>
      )}

      {rows.length > 0 && left === 0 && (
        <div className="card p-4 text-center">
          <p className="font-semibold">🎉 {today} reposted today. That&apos;s the day&apos;s {PER_DAY}.</p>
          <p className="muted text-sm">Come back tomorrow for the next {Math.min(PER_DAY, rows.length)}.</p>
        </div>
      )}

      {now.map((r, i) => (
        <div key={r.id} className="card p-3 space-y-2">
          <div className="flex gap-3 items-center">
            {r.photo ? <img src={r.photo} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : <div className="w-16 h-16 rounded shrink-0" style={{ background: "var(--line)" }} />}
            <div className="min-w-0">
              <p className="font-semibold truncate">{i + 1}. {r.title}</p>
              <p className="text-sm muted">{r.price ? `$${r.price}` : "No price yet"} • #{r.sku}</p>
            </div>
          </div>
          {r.oldUrl ? (
            <a href={r.oldUrl} target="_blank" rel="noreferrer" className="btn btn-secondary w-full" onClick={() => setDeleted((d) => ({ ...d, [r.id]: true }))}>① 🗑 Open the old ad and delete it</a>
          ) : (
            <a href="https://www.facebook.com/marketplace/you/selling" target="_blank" rel="noreferrer" className="btn btn-secondary w-full" onClick={() => setDeleted((d) => ({ ...d, [r.id]: true }))}>① 🗑 Delete the old ad (your selling page)</a>
          )}
          <Link href={`/app/items/${r.id}?from=relist`} className={`btn w-full ${deleted[r.id] ? "btn-primary" : "btn-secondary"}`}>② 📋 Copy the new listing + save photos</Link>
          <button type="button" className="btn btn-secondary w-full" onClick={() => reposted(r)}>③ ✅ Posted it</button>
        </div>
      ))}
    </div>
  );
}
