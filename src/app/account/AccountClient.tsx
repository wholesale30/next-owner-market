"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface S { id: string; query: string; category_id: string | null; max_price: number | null; notify: boolean }

export default function AccountClient({ searches, categories }: { searches: S[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [max, setMax] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("saved_searches").insert({ profile_id: user!.id, query: q.trim(), category_id: cat || null, max_price: max ? Number(max) : null });
    setBusy(false);
    if (error) return alert(error.message);
    setQ(""); setMax("");
    router.refresh();
  }
  async function del(id: string) {
    await supabase.from("saved_searches").delete().eq("id", id);
    router.refresh();
  }
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Alert me when this shows up</h2>
      <form onSubmit={add} className="card p-3 space-y-2">
        <input className="input" placeholder="e.g. Technics turntable, Craftsman, bread machine" value={q} onChange={(e) => setQ(e.target.value)} required />
        <div className="flex gap-2">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Any category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="input w-28" type="number" inputMode="decimal" placeholder="Max $" value={max} onChange={(e) => setMax(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>Add</button>
        </div>
      </form>
      {searches.map((s) => (
        <div key={s.id} className="card p-2 text-sm flex justify-between items-center">
          <span>&quot;{s.query}&quot;{s.category_id ? ` in ${categories.find((c) => c.id === s.category_id)?.name || "category"}` : ""}{s.max_price ? ` under $${s.max_price}` : ""}</span>
          <button className="muted" onClick={() => del(s.id)}>×</button>
        </div>
      ))}
      <button className="btn btn-secondary w-full font-bold" onClick={signOut}>Sign out</button>
    </section>
  );
}
