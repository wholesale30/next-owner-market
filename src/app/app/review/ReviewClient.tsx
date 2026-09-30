"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";

interface Row { id: string; sku: string; title: string; price: number | null; tier: string; created_at: string; item_photos: { url: string; is_primary: boolean }[]; profiles: { full_name: string | null; business_name: string | null; approved: boolean } | null }

export default function ReviewClient({ items }: { items: Row[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = () => Array.from(sel);

  async function approve() {
    setBusy(true); setErr(null);
    const { error } = await supabase.from("items").update({ status: "active", listed_at: new Date().toISOString() }).in("id", ids());
    setBusy(false);
    if (error) return setErr(error.message);
    fetch("/api/notify/flush", { method: "POST" }).catch(() => {});
    setSel(new Set()); router.refresh();
  }
  async function archive() {
    if (!confirm(`Archive ${sel.size} item(s)? They keep their history and can be found under Inventory → All.`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("items").update({ status: "archived" }).in("id", ids());
    setBusy(false);
    if (error) return setErr(error.message);
    setSel(new Set()); router.refresh();
  }
  async function del() {
    if (!confirm(`Delete ${sel.size} item(s) and their photos for good?`)) return;
    setBusy(true); setErr(null);
    const failed: string[] = [];
    for (const id of ids()) {
      const { data: paths, error } = await supabase.rpc("delete_item", { p_item: id });
      if (error) { failed.push(error.message); continue; }
      if (paths?.length) await supabase.storage.from("item-photos").remove(paths as string[]);
    }
    setBusy(false);
    if (failed.length) setErr(`${failed.length} couldn't be deleted (have a sale or order): archive those instead.`);
    setSel(new Set()); router.refresh();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold">Items to review ({items.length})</h2>
        <div className="flex gap-1"><button className="pill" onClick={() => setSel(new Set(items.map((i) => i.id)))}>Select all</button><button className="pill" onClick={() => setSel(new Set())}>None</button></div>
      </div>
      {sel.size > 0 && (
        <div className="sticky top-14 z-10 card p-2 flex gap-2 flex-wrap items-center" style={{ borderColor: "var(--brand)" }}>
          <span className="text-sm font-semibold">{sel.size} selected</span>
          <button className="btn btn-primary" disabled={busy} onClick={approve}>✅ Approve & list</button>
          <button className="btn btn-secondary" disabled={busy} onClick={archive}>Archive</button>
          <button className="btn btn-secondary" disabled={busy} onClick={del}>🗑 Delete</button>
        </div>
      )}
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      {!items.length && <div className="card p-6 text-center muted text-sm">Queue is empty.</div>}
      {items.map((it) => {
        const photo = [...(it.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
        const on = sel.has(it.id);
        return (
          <div key={it.id} className="card p-3 flex gap-3 items-center" style={on ? { borderColor: "var(--brand)" } : undefined}>
            <input type="checkbox" className="w-5 h-5 shrink-0" checked={on} onChange={() => toggle(it.id)} aria-label="Select" />
            <Link href={`/app/items/${it.id}`} className="flex gap-3 items-center flex-1 min-w-0">
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{it.title || "(untitled)"}</p>
                <p className="text-sm muted truncate">{it.profiles?.business_name || it.profiles?.full_name} • {it.sku} • {it.tier.replace("_", " ")}</p>
              </div>
              <p className="font-semibold shrink-0">{money(it.price)}</p>
            </Link>
          </div>
        );
      })}
    </section>
  );
}
