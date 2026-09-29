"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Loc { id: string; code: string; kind: string; description: string | null; sorted: boolean; sort_notes: string | null; total: number; active: number; sold: number }

export default function LocationsClient({ locations }: { locations: Loc[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("gaylord");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSorted, setShowSorted] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.from("locations").insert({ code: code.trim().toUpperCase(), kind, description: desc || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setCode(""); setDesc("");
    router.refresh();
  }
  async function toggleSorted(l: Loc) {
    const notes = !l.sorted ? prompt("What happened with this box? (e.g. 12 listed, rest to lot, 3 trashed)", l.sort_notes || "") : l.sort_notes;
    await supabase.from("locations").update({ sorted: !l.sorted, sort_notes: notes ?? l.sort_notes }).eq("id", l.id);
    router.refresh();
  }

  const list = locations.filter((l) => showSorted || !l.sorted);
  const unsorted = locations.filter((l) => !l.sorted).length;

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card p-3 space-y-2">
        <div className="flex gap-2">
          <input className="input" placeholder="Code, e.g. G-115" value={code} onChange={(e) => setCode(e.target.value)} required />
          <select className="input w-32" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["gaylord", "pallet", "shelf", "bin", "area"].map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="What's in it (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>Add</button>
        </div>
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      </form>

      <div className="flex items-center justify-between text-sm">
        <span className="muted">{unsorted} unsorted • {locations.length - unsorted} sorted</span>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showSorted} onChange={(e) => setShowSorted(e.target.checked)} /> show sorted</label>
      </div>

      {list.map((l) => (
        <div key={l.id} className="card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold">{l.code} <span className="pill ml-1">{l.kind}</span>{l.sorted && <span className="pill pill-active ml-1">sorted</span>}</p>
            {l.description && <p className="text-sm muted truncate">{l.description}</p>}
            <p className="text-xs muted">{l.total} items • {l.active} listed • {l.sold} sold{l.sort_notes ? ` • ${l.sort_notes}` : ""}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Link href={`/app/items/new?bin=${l.id}`} className="pill pill-active text-center">+ item</Link>
            <Link href={`/app?bin=${l.id}`} className="pill text-center">view</Link>
            <button className="pill" onClick={() => toggleSorted(l)}>{l.sorted ? "unsort" : "✓ sorted"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
