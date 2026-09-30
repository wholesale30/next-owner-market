"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/listing";
import { STATUS_LABELS, type ItemStatus, type Tier } from "@/lib/types";

export interface Row {
  id: string; sku: string; title: string; price: number | null; status: ItemStatus; tier: Tier;
  photo: string | null; location: string | null; owner: string | null; stale: boolean;
}

export default function InventoryList({ items, staff, locations }: { items: Row[]; staff: boolean; locations: { id: string; code: string }[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const selecting = sel.size > 0;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = () => [...sel];

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
    setSel(new Set());
    router.refresh();
  }

  const bulkStatus = (status: ItemStatus) => run(async () => {
    const patch: Record<string, unknown> = { status };
    if (status === "active") patch.listed_at = new Date().toISOString();
    const { error } = await supabase.from("items").update(patch).in("id", ids());
    if (error) throw error;
    if (status === "active") fetch("/api/notify/flush", { method: "POST" }).catch(() => {});
  });

  const bulkDelete = () => {
    if (!confirm(`Delete ${sel.size} item(s) and their photos for good? Anything that sold is skipped.`)) return;
    run(async () => {
      let skipped = 0;
      for (const id of ids()) {
        const { data: paths, error } = await supabase.rpc("delete_item", { p_item: id });
        if (error) { skipped++; continue; }
        if (paths?.length) await supabase.storage.from("item-photos").remove(paths as string[]);
      }
      if (skipped) alert(`${skipped} item(s) have a sale or order and were kept; archive those instead.`);
    });
  };

  const moveBin = () => {
    const code = prompt("Move to bin code (existing or new):");
    if (!code) return;
    run(async () => {
      const c = code.trim().toUpperCase();
      let { data: loc } = await supabase.from("locations").select("id").eq("code", c).maybeSingle();
      if (!loc) { const r = await supabase.from("locations").insert({ code: c }).select("id").single(); if (r.error) throw r.error; loc = r.data; }
      const { error } = await supabase.from("items").update({ location_id: loc.id }).in("id", ids());
      if (error) throw error;
    });
  };

  const makeLot = () => {
    const title = prompt("Lot title (e.g. Box of 14 kitchen gadgets):");
    if (!title) return;
    const price = prompt("Lot price $:");
    run(async () => {
      const chosen = items.filter((i) => sel.has(i.id));
      const desc = "Sold as one lot. Includes:\n" + chosen.map((i) => `• ${i.title}`).join("\n");
      const { data: lotItem, error } = await supabase.from("items").insert({
        owner_id: (await supabase.auth.getUser()).data.user!.id,
        title, description: desc, price: price ? Number(price) : null, sale_type: "lot", status: "draft", tier: "owned",
        category_id: (await supabase.from("categories").select("id").eq("slug", "lots").maybeSingle()).data?.id || null,
      }).select("id").single();
      if (error) throw error;
      const { data: lot, error: e2 } = await supabase.from("lots").insert({ item_id: lotItem.id }).select("id").single();
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("lot_members").insert(ids().map((item_id) => ({ lot_id: lot.id, item_id })));
      if (e3) throw e3;
      // members are reserved under the lot
      await supabase.from("items").update({ status: "reserved" }).in("id", ids());
      // copy the first photo of each member to the lot
      const { data: photos } = await supabase.from("item_photos").select("storage_path, url").in("item_id", ids()).eq("is_primary", true);
      if (photos?.length) await supabase.from("item_photos").insert(photos.map((p, i) => ({ item_id: lotItem.id, storage_path: p.storage_path, url: p.url, sort_order: i, is_primary: i === 0 })));
      router.push(`/app/items/${lotItem.id}`);
    });
  };

  return (
    <div className="space-y-2 pb-24">
      <div className="flex justify-between text-xs muted">
        <span>{selecting ? `${sel.size} selected` : "Tap the circle to select several"}</span>
        <span className="flex gap-2"><button className="underline" onClick={() => setSel(new Set(items.map((i) => i.id)))}>select all</button>{selecting && <button className="underline" onClick={() => setSel(new Set())}>clear</button>}</span>
      </div>
      <ul className="space-y-2">
        {items.map((it) => {
          const pillClass = it.status === "active" ? "pill-active" : it.status === "sold" || it.status === "shipped" ? "pill-sold" : "pill-draft";
          const on = sel.has(it.id);
          return (
            <li key={it.id} className="card p-3 flex gap-3 items-center" style={on ? { outline: "2px solid var(--brand)" } : undefined}>
              <button onClick={() => toggle(it.id)} aria-label="select" className="w-6 h-6 rounded-full border-2 shrink-0" style={{ borderColor: "var(--brand)", background: on ? "var(--brand)" : "transparent" }} />
              <Link href={`/app/items/${it.id}`} className="flex gap-3 items-center flex-1 min-w-0">
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--line)" }}>
                  {it.photo && <img src={it.photo} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{it.title || <span className="muted">Untitled</span>}</p>
                  <p className="text-sm muted truncate">{it.sku}{it.location ? ` • ${it.location}` : ""}{it.owner ? ` • ${it.owner}` : ""}</p>
                  {it.stale && <span className="pill" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>listed 30+ days, refresh or drop price</span>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{money(it.price)}</p>
                  <span className={`pill ${pillClass}`}>{STATUS_LABELS[it.status]}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {selecting && (
        <div className="fixed bottom-0 inset-x-0 p-3 border-t no-print" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto">
            {staff && <button className="btn btn-primary" disabled={busy} onClick={() => bulkStatus("active")}>List</button>}
            {!staff && <button className="btn btn-primary" disabled={busy} onClick={() => bulkStatus("pending_review")}>Submit for review</button>}
            {staff && <button className="btn btn-secondary" disabled={busy} onClick={makeLot}>Make lot</button>}
            {staff && <button className="btn btn-secondary" disabled={busy} onClick={moveBin}>Move bin</button>}
            {staff && <button className="btn btn-secondary" disabled={busy} onClick={() => window.open(`/app/tags?ids=${ids().join(",")}`, "_blank")}>Tags</button>}
            <button className="btn btn-secondary" disabled={busy} onClick={() => bulkStatus("draft")}>Unlist</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => confirm(`Archive ${sel.size} items?`) && bulkStatus("archived")}>Archive</button>
            <button className="btn btn-danger" disabled={busy} onClick={bulkDelete}>🗑 Delete</button>
          </div>
        </div>
      )}
      {locations.length === 0 && null}
    </div>
  );
}
