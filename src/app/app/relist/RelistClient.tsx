"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EditBox, { type Editable } from "./EditBox";

/**
 * Relist list (Oct 23, 2026): old Facebook ads brought in by the importer, N a day (he picks how many).
 * Order for each one matters: delete the old ad FIRST, then post the new one (two of the same ad up at once
 * is what gets Marketplace listings flagged as duplicates).
 * Facebook only lets approved business partners post or change listings from outside, so the app can't post or
 * change prices there itself. It keeps today's batch ready, lowers prices on our site on his schedule, and lists
 * the Facebook ads whose price he should change to match.
 */
type Row = { id: string; sku: string; title: string; price: number | null; status: string; oldUrl: string | null; postedTo: Record<string, string>; photo: string | null; pick: string | null; hold: boolean; description: string; location: string | null };
type Change = { id: string; sku: string; title: string; price: number; was: number };
export type RelistSettings = { perDay: number; drop: boolean; pct: number; days: number; floorPct: number; gapMin: number; gapMax: number };
const PER_DAY_CHOICES = [20, 30, 40, 50];
const SELLING = "https://www.facebook.com/marketplace/you/selling";

export default function RelistClient({ items, doneToday, changes, settings }: { items: Row[]; doneToday: number; changes: Change[]; settings: RelistSettings }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(items);
  const [fix, setFix] = useState(changes);
  const [today, setToday] = useState(doneToday);
  const [deleted, setDeleted] = useState<Record<string, boolean>>({});
  const [s, setS] = useState(settings);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const left = Math.max(0, s.perDay - today);
  // his picks go first, in the order he tapped them; skipped ones never go
  const queue = rows.filter((r) => !r.hold).sort((a, b) => (a.pick && b.pick ? a.pick.localeCompare(b.pick) : a.pick ? -1 : b.pick ? 1 : 0));
  const now = queue.slice(0, left);
  const picked = rows.filter((r) => r.pick && !r.hold).length;

  const saved = (id: string) => (e: Editable) => setRows((x) => x.map((y) => (y.id === id ? { ...y, ...e, title: e.title || y.title } : y)));

  async function togglePick(r: Row) {
    const pick = r.pick ? null : new Date().toISOString();
    setRows((x) => x.map((y) => (y.id === r.id ? { ...y, pick, hold: false } : y)));
    await supabase.from("items").update({ fb_pick: pick, fb_hold: false }).eq("id", r.id);
  }
  async function remove(r: Row) {
    if (!confirm(`Delete "${r.title}" from the app? It goes to 🗑 Deleted, where it can be brought back. (This doesn't touch Facebook.)`)) return;
    const { error } = await supabase.rpc("delete_item", { p_item: r.id });
    if (error) { setNote(`Couldn't delete: ${error.message}`); return; }
    setRows((x) => x.filter((y) => y.id !== r.id));
  }

  async function toggleHold(r: Row) {
    const hold = !r.hold;
    setRows((x) => x.map((y) => (y.id === r.id ? { ...y, hold, pick: hold ? null : y.pick } : y)));
    await supabase.from("items").update({ fb_hold: hold, ...(hold ? { fb_pick: null } : {}) }).eq("id", r.id);
  }

  const dropFields = (price: number | null, v = s) => v.drop && price
    ? { drop_pct: v.pct, drop_every_days: v.days, drop_floor: Math.max(1, Math.round(price * v.floorPct / 100)) }
    : { drop_pct: null, drop_every_days: null, drop_floor: null };

  async function saveSettings(next: RelistSettings, applyAll: boolean) {
    setS(next);
    setBusy(true);
    await supabase.from("settings").upsert({ key: "relist:settings", value: next });
    if (applyAll) {
      // every Facebook ad already brought in and not sold gets the same schedule (each item can still be changed on its own page)
      const { data } = await supabase.from("items").select("id, price, fb_posted_price").not("fb_old_url", "is", null).neq("status", "sold").limit(1000);
      const list = data || [];
      for (let i = 0; i < list.length; i += 20) {
        await Promise.all(list.slice(i, i + 20).map((it) => supabase.from("items").update(dropFields(Number(it.fb_posted_price ?? it.price) || null, next)).eq("id", it.id)));
      }
      setNote(next.drop ? `✓ Saved. ${list.length} ads will drop ${next.pct}% every ${next.days} days, never below ${next.floorPct}% of their price.` : `✓ Price drops turned off for ${list.length} ads.`);
    } else setNote("✓ Saved.");
    setBusy(false);
  }

  async function reposted(r: Row) {
    const at = new Date().toISOString();
    const live = r.status === "pending_review" || r.status === "draft" ? { status: "active", listed_at: at } : {};
    await supabase.from("items").update({ fb_relisted_at: at, fb_posted_price: r.price, posted_to: { ...r.postedTo, facebook: at }, ...live, ...dropFields(r.price) }).eq("id", r.id);
    setRows((x) => x.filter((y) => y.id !== r.id));
    setToday((t) => t + 1);
  }

  async function changed(c: Change) {
    await supabase.from("items").update({ fb_posted_price: c.price }).eq("id", c.id);
    setFix((x) => x.filter((y) => y.id !== c.id));
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold">🔁 Relist list</h1>
        <p className="muted text-sm">{queue.length} old Facebook ads waiting • {today} reposted today.</p>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`btn ${!choosing ? "btn-primary" : "btn-secondary"}`} onClick={() => setChoosing(false)}>📋 Today&apos;s list</button>
          <button type="button" className={`btn ${choosing ? "btn-primary" : "btn-secondary"}`} onClick={() => setChoosing(true)}>✋ Choose{picked ? ` (${picked} picked)` : ""}</button>
        </div>
      )}

      {choosing && (
        <div className="space-y-2">
          <p className="text-sm muted">Tap <b>⭐ Post next</b> on the ones you want out first (they go in the order you tap). <b>🚫 Skip</b> keeps one from being relisted. Everything else follows after your picks.</p>
          {rows.map((r) => (
            <div key={r.id} className="space-y-1">
            <div className="card p-2 flex gap-2 items-center" style={r.pick && !r.hold ? { borderColor: "var(--brand)" } : r.hold ? { opacity: 0.55 } : {}}>
              {r.photo ? <img src={r.photo} alt="" className="w-14 h-14 object-cover rounded shrink-0" /> : <div className="w-14 h-14 rounded shrink-0" style={{ background: "var(--line)" }} />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{r.title}</p>
                <p className="text-xs muted">{r.price ? `$${r.price}` : "No price"}{r.pick && !r.hold ? ` • ⭐ #${queue.findIndex((q) => q.id === r.id) + 1} in line` : ""}{r.hold ? " • skipped" : ""}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" className={`pill ${r.pick && !r.hold ? "font-bold" : ""}`} onClick={() => togglePick(r)}>{r.pick && !r.hold ? "⭐ Picked" : "⭐ Post next"}</button>
                <button type="button" className="pill" onClick={() => toggleHold(r)}>{r.hold ? "↩ Undo skip" : "🚫 Skip"}</button>
                <button type="button" className="pill" onClick={() => remove(r)}>🗑 Delete</button>
              </div>
            </div>
            <EditBox id={r.id} value={{ title: r.title, price: r.price, description: r.description, location: r.location }} onSaved={saved(r.id)} />
            </div>
          ))}
        </div>
      )}

      {!choosing && rows.length > 0 && <Link href="/app/relist/next" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }}>📣 Post them one at a time (random waits)</Link>}

      {fix.length > 0 && (
        <div className="card p-3 space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-semibold">💲 {fix.length} price{fix.length > 1 ? "s" : ""} dropped. Change {fix.length > 1 ? "them" : "it"} on Facebook too</p>
          {fix.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <a href={SELLING} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm"><span className="font-semibold truncate block">{c.title}</span><span className="muted">${c.was} → <b>${c.price}</b></span></a>
              <button type="button" className="btn btn-secondary" onClick={() => changed(c)}>✅ Done</button>
            </div>
          ))}
        </div>
      )}

      <div className="card p-3 space-y-2">
        <p className="font-semibold">How many a day?</p>
        <div className="grid grid-cols-4 gap-2">
          {PER_DAY_CHOICES.map((n) => (
            <button key={n} type="button" disabled={busy} className={`btn ${s.perDay === n ? "btn-primary" : "btn-secondary"}`} onClick={() => saveSettings({ ...s, perDay: n }, false)}>{n}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Wait at least (min)<input className="input" inputMode="numeric" value={s.gapMin} onChange={(e) => setS({ ...s, gapMin: Number(e.target.value.replace(/\D/g, "")) || 0 })} onBlur={() => saveSettings(s, false)} /></label>
          <label>Up to (min)<input className="input" inputMode="numeric" value={s.gapMax} onChange={(e) => setS({ ...s, gapMax: Number(e.target.value.replace(/\D/g, "")) || 0 })} onBlur={() => saveSettings(s, false)} /></label>
        </div>
        <p className="text-xs muted">Each wait is a random number in between (like 7, then 13, then 5 minutes).</p>
        <p className="text-xs muted">Facebook has no official daily limit. Sellers with an established account report 15 to 30 a day is safe and about 50 is too many. Spread them through the day (about 15 minutes apart), not all at once.</p>
      </div>

      {!rows.length && (
        <div className="card p-4 space-y-2 text-center">
          <p className="font-semibold">Nothing waiting.</p>
          <Link href="/app/import" className="btn btn-primary w-full">📂 Bring in my Facebook ads</Link>
        </div>
      )}

      {rows.length > 0 && left === 0 && (
        <div className="card p-4 text-center">
          <p className="font-semibold">🎉 {today} reposted today. That&apos;s the day&apos;s {s.perDay}.</p>
          <p className="muted text-sm">The next {Math.min(s.perDay, rows.length)} are ready tomorrow.</p>
        </div>
      )}

      {!choosing && now.map((r, i) => (
        <div key={r.id} className="card p-3 space-y-2">
          <div className="flex gap-3 items-center">
            {r.photo ? <img src={r.photo} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : <div className="w-16 h-16 rounded shrink-0" style={{ background: "var(--line)" }} />}
            <div className="min-w-0">
              <p className="font-semibold truncate">{i + 1}. {r.title}</p>
              <p className="text-sm muted">{r.price ? `$${r.price}` : "No price yet"} • #{r.sku}</p>
            </div>
          </div>
          <p className="text-sm"><b>Not posted yet.</b> To repost it, do these 3 steps in order:{r.location ? ` • 📍 ${r.location}` : ""}</p>
          <EditBox id={r.id} value={{ title: r.title, price: r.price, description: r.description, location: r.location }} onSaved={saved(r.id)} />
          <a href={r.oldUrl || SELLING} target="_blank" rel="noreferrer" className="btn btn-secondary w-full" onClick={() => setDeleted((d) => ({ ...d, [r.id]: true }))}>Step 1: 🗑 Delete the old ad on Facebook</a>
          <Link href={`/app/items/${r.id}?from=relist`} className={`btn w-full ${deleted[r.id] ? "btn-primary" : "btn-secondary"}`}>Step 2: 📋 Copy the new listing + save photos</Link>
          <button type="button" className="btn btn-secondary w-full" onClick={() => reposted(r)}>Step 3: ✅ Tap here AFTER it&apos;s posted on Facebook</button>
          <button type="button" className="pill w-full" onClick={() => remove(r)}>🗑 Don&apos;t want it: delete from the app</button>
        </div>
      ))}

      <details className="card p-3" open={s.drop}>
        <summary className="font-semibold cursor-pointer">📉 Lower the price until it sells {s.drop ? `(on: ${s.pct}% every ${s.days} days)` : "(off)"}</summary>
        <div className="space-y-2 mt-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <label>Drop %<input className="input" inputMode="numeric" value={s.pct} onChange={(e) => setS({ ...s, pct: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
            <label>Every (days)<input className="input" inputMode="numeric" value={s.days} onChange={(e) => setS({ ...s, days: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
            <label>Lowest (% of price)<input className="input" inputMode="numeric" value={s.floorPct} onChange={(e) => setS({ ...s, floorPct: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} /></label>
          </div>
          <p className="text-xs muted">Example: a $100 item at 10% every 7 days, lowest 60%, goes $90, $81, $73, $66, $60, then stops. Each drop shows up at the top of this page so you can change it on Facebook. Buyers who saved it on our site get a price-drop email.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || !s.pct || !s.days} onClick={() => saveSettings({ ...s, drop: true }, true)}>Turn on for all</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => saveSettings({ ...s, drop: false }, true)}>Turn off</button>
          </div>
          <p className="text-xs muted">Want one item different? Open it and use “📉 Drop the price automatically” on its page.</p>
        </div>
      </details>
      {note && <p className="text-sm text-center">{note}</p>}
    </div>
  );
}
