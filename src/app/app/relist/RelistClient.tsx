"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EditBox, { type Editable } from "./EditBox";
import SoldBox from "./SoldBox";
import type { PriceCheck } from "@/lib/pricecheck";

/**
 * Relist list (Oct 23, 2026): old Facebook ads brought in by the importer, N a day (he picks how many).
 * Order for each one matters: delete the old ad FIRST, then post the new one (two of the same ad up at once
 * is what gets Marketplace listings flagged as duplicates).
 * Facebook only lets approved business partners post or change listings from outside, so the app can't post or
 * change prices there itself. It keeps today's batch ready, lowers prices on our site on his schedule, and lists
 * the Facebook ads whose price he should change to match.
 */
type Row = { id: string; sku: string; title: string; price: number | null; status: string; oldUrl: string | null; postedTo: Record<string, string>; photo: string | null; pick: string | null; hold: boolean; description: string; location: string | null; removing?: boolean; removedAt?: string | null; listedAt: string | null; pc: PriceCheck | null; mine: number | null };
type Change = { id: string; sku: string; title: string; price: number; was: number };
type Live = { id: string; title: string; price: number | null; at: string; photo: string | null };
type SoldRow = { id: string; title: string; price: number | null; buyer: string | null; soldAt: string; reposted: string | null; days: number | null };
export type RelistSettings = { perDay: number; drop: boolean; pct: number; days: number; floorPct: number; gapMin: number; gapMax: number; relistAfter: number; startHour: number; endHour: number; order: "old" | "fb" | "high" | "low" };
const PER_DAY_CHOICES = [15, 20, 30, 35, 40];
/** What he pastes into the Claude bar in Chrome; Claude in Chrome does the Facebook clicking from his own browser. */
export const CHROME_PROMPT = `Open nextownermarket.com/app/relist/next and keep following that page until it says DONE FOR TODAY or ALL DONE. If it says WAIT, wait until the time shown, then reload it. Find the old ad by its link and the "on Facebook says" title shown on the page; the app's own title, price and photos are the NEW rewritten version on purpose, so they will not match the old ad, and an old ad may show as Sold; that is expected. If the page says REMOVE ONLY, open that ad on Facebook, delete it, post nothing, and tap "I deleted it on Facebook". Otherwise: STEP 1, open the old ad link and delete that listing on Facebook. STEP 2, open Facebook's Create new listing page, fill in the title, price, category, condition, location and description exactly as the page shows, and add the photos in the order shown: for each photo, open its photo page link from the app page in a new tab (it shows only that photo), take a screenshot of that tab, go back to the Facebook tab and upload that screenshot into the photo box; do not ask me to add photos (for a vehicle or boat, use Facebook's vehicle listing form instead). Publish it. STEP 3, open the new listing, copy its link, go back to the app page, paste the link in the "New ad link" box, and tap "I posted it on Facebook". Change nothing else on Facebook. If Facebook shows a warning, a limit, a security check or anything unexpected, stop and tell me.`;
const SELLING = "https://www.facebook.com/marketplace/you/selling";

export default function RelistClient({ items, doneToday, changes, settings, live: liveIn, buyers, sold: soldIn }: { items: Row[]; doneToday: number; changes: Change[]; settings: RelistSettings; live: Live[]; buyers: Record<string, { name: string; contact: string }[]>; sold: SoldRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(items);
  const [fix, setFix] = useState(changes);
  const [today, setToday] = useState(doneToday);
  const [deleted, setDeleted] = useState<Record<string, boolean>>({});
  const [s, setS] = useState(settings);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(liveIn);
  const [sold, setSold] = useState(soldIn);
  const soldTotal = sold.reduce((a, x) => a + (x.price || 0), 0);
  const fromRepost = sold.filter((x) => x.reposted);
  const avgDays = fromRepost.length ? Math.round(fromRepost.reduce((a, x) => a + (x.days || 0), 0) / fromRepost.length) : null;
  const [now0] = useState(() => new Date().getTime());
  const ageDays = (iso: string) => Math.max(0, Math.floor((now0 - new Date(iso).getTime()) / 86400000));
  const due = live.filter((l) => ageDays(l.at) >= s.relistAfter);

  async function relistAgain(l: Live) {
    // back in line at the front; its saved link is the ad to delete
    await supabase.from("items").update({ fb_relisted_at: null, fb_pick: new Date().toISOString(), fb_hold: false }).eq("id", l.id);
    setLive((x) => x.filter((y) => y.id !== l.id));
    setNote(`✓ "${l.title}" is back at the front of the line.`);
    setUndo({ label: `Relisting "${l.title}"`, run: async () => {
      await supabase.from("items").update({ fb_relisted_at: l.at, fb_pick: null }).eq("id", l.id);
      setLive((x) => [...x, l]);
    } });
  }
  const left = Math.max(0, s.perDay - today);
  // his picks go first, in the order he tapped them; skipped ones never go
  const rank = (r: Row) => (s.order === "high" ? -(r.price || 0) : s.order === "low" ? (r.price || 0) : s.order === "old" ? (r.listedAt ? new Date(r.listedAt).getTime() : 9e15) : 0);
  const queue = rows.filter((r) => !r.hold).sort((a, b) => (a.pick && b.pick ? a.pick.localeCompare(b.pick) : a.pick ? -1 : b.pick ? 1 : rank(a) - rank(b)));
  // only ads he marked ✅ Ready get posted (Oct 23, 2026): "I'm supposed to be checking these and deciding"
  const readyCount = queue.filter((r) => r.pick).length;
  const todayN = Math.min(left, readyCount);

  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [prev, setPrev] = useState<Record<string, number | null>>({});
  // one-step undo for the last thing he did (bar at the bottom of the screen)
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  async function checkPrice(id: string) {
    setChecking((c) => ({ ...c, [id]: true }));
    try {
      const r = await fetch("/api/price-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id }) });
      const j = await r.json();
      if (r.ok) setRows((x) => x.map((y) => (y.id === id ? { ...y, pc: j } : y)));
    } finally { setChecking((c) => ({ ...c, [id]: false })); }
  }

  async function setPriceRaw(id: string, price: number | null) {
    const { error } = await supabase.from("items").update({ price }).eq("id", id);
    if (error) { alert(`Couldn't change the price: ${error.message}`); return false; }
    setRows((x) => x.map((y) => (y.id === id ? { ...y, price } : y)));
    return true;
  }
  async function applyPrice(r: Row, price: number, label: string) {
    const was = r.price != null ? Number(r.price) : null;
    // tapping the price that's already in use undoes it: back to what it was before (or your own price)
    if (was === price) {
      const back = prev[r.id] !== undefined && prev[r.id] !== price ? prev[r.id] : r.mine;
      if (back == null || back === price) {
        setFlash((f) => ({ ...f, [r.id]: `Already using ${label} ($${price}). ${r.pc ? "Tap List, Fast or Lowest to change it." : "Tap 🔎 Check real price below to get List, Fast and Lowest, or use ✏️ Edit."}` }));
        return;
      }
      if (await setPriceRaw(r.id, back)) setFlash((f) => ({ ...f, [r.id]: `↩ Back to $${back}` }));
      return;
    }
    if (!(await setPriceRaw(r.id, price))) return;
    setPrev((p) => ({ ...p, [r.id]: was }));
    setFlash((f) => ({ ...f, [r.id]: `✓ Price set to $${price} (${label}). Tap it again to undo.` }));
  }

  // a price typed in Edit becomes "Mine"
  const saved = (id: string) => (e: Editable) => {
    setRows((x) => x.map((y) => (y.id === id ? { ...y, ...e, title: e.title || y.title, mine: e.price ?? y.mine } : y)));
    if (e.price) setFlash((f) => ({ ...f, [id]: `✓ Your price is now $${e.price} (Mine)` }));
  };

  // when an ad moves in the list, keep the screen where he is (the browser otherwise follows the button he tapped)
  const holdScroll = () => {
    const y = window.scrollY;
    (document.activeElement as HTMLElement | null)?.blur();
    requestAnimationFrame(() => { window.scrollTo(0, y); requestAnimationFrame(() => window.scrollTo(0, y)); });
  };

  async function togglePick(r: Row) {
    holdScroll();
    const pick = r.pick ? null : new Date().toISOString();
    setRows((x) => x.map((y) => (y.id === r.id ? { ...y, pick, hold: false } : y)));
    setUndo(pick ? { label: `✅ "${r.title}" is ready to post`, run: () => togglePick({ ...r, pick }) } : { label: `↩ "${r.title}" moved back to Not checked yet`, run: () => setPickTime(r.id, r.pick!) });
    await supabase.from("items").update({ fb_pick: pick, fb_hold: false }).eq("id", r.id);
  }
  // reorder the ✅ Ready group: posting order = fb_pick time, earliest first
  async function setPickTime(id: string, iso: string) {
    setRows((x) => x.map((y) => (y.id === id ? { ...y, pick: iso, hold: false } : y)));
    const { error } = await supabase.from("items").update({ fb_pick: iso, fb_hold: false }).eq("id", id);
    if (error) alert(`Couldn't move it: ${error.message}`);
  }
  async function toTop(r: Row) {
    holdScroll();
    const picks = rows.filter((y) => y.pick && !y.hold && y.id !== r.id).map((y) => new Date(y.pick!).getTime());
    const first = picks.length ? Math.min(...picks) : new Date().getTime();
    await setPickTime(r.id, new Date(first - 1000).toISOString());
    setFlash((f) => ({ ...f, [r.id]: "⏫ Moved to #1" }));
  }
  async function toBottom(r: Row) {
    holdScroll();
    const picks = rows.filter((y) => y.pick && !y.hold && y.id !== r.id).map((y) => new Date(y.pick!).getTime());
    const last = picks.length ? Math.max(...picks) : new Date().getTime();
    await setPickTime(r.id, new Date(last + 1000).toISOString());
    setFlash((f) => ({ ...f, [r.id]: "⏬ Moved to the bottom of the Ready list" }));
  }
  async function moveBy(r: Row, dir: -1 | 1, list: Row[]) {
    holdScroll();
    const i = list.findIndex((y) => y.id === r.id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length || !list[j].pick || !r.pick) return;
    const a = r.pick, b = list[j].pick!;
    await Promise.all([setPickTime(r.id, b), setPickTime(list[j].id, a)]);
  }

  async function remove(r: Row) {
    holdScroll();
    if (!confirm(`Delete "${r.title}" from the app? It goes to 🗑 Deleted, where it can be brought back. (This doesn't touch Facebook.)`)) return;
    const { error } = await supabase.rpc("delete_item", { p_item: r.id });
    if (error) { setNote(`Couldn't delete: ${error.message}`); return; }
    setRows((x) => x.filter((y) => y.id !== r.id));
    setUndo({ label: `Deleted "${r.title}"`, run: async () => {
      const { data: tr } = await supabase.from("trash").select("batch").eq("table_name", "items").eq("row_id", r.id).is("restored_at", null).order("deleted_at", { ascending: false }).limit(1).maybeSingle();
      if (!tr) { alert("Couldn't find it to bring back. It's in ☰ More → 🗑 Deleted."); return; }
      const { error: e2 } = await supabase.rpc("restore_trash", { p_batch: tr.batch });
      if (e2) { alert(`Couldn't bring it back: ${e2.message}`); return; }
      setRows((x) => [...x, r]);
    } });
  }

  async function takeOff(id: string, title: string) {
    if (!confirm(`Take "${title}" off Facebook? Claude in Chrome deletes the ad and doesn't repost it. It stays in the app.`)) return;
    holdScroll();
    await supabase.from("items").update({ fb_remove: true, fb_hold: true, fb_pick: null }).eq("id", id);
    setRows((x) => x.map((y) => (y.id === id ? { ...y, hold: true, pick: null, removing: true } : y)));
    setLive((x) => x.filter((y) => y.id !== id));
    setNote(`✓ "${title}" will be taken off Facebook next, before any new posts.`);
    setUndo({ label: `Taking "${title}" off Facebook`, run: () => keepOn(id) });
  }
  async function keepOn(id: string) {
    await supabase.from("items").update({ fb_remove: false, fb_hold: false }).eq("id", id).is("fb_removed_at", null);
    setRows((x) => x.map((y) => (y.id === id ? { ...y, hold: false, removing: false } : y)));
    setNote("↩ Staying on Facebook.");
  }

  async function toggleHold(r: Row) {
    holdScroll();
    const hold = !r.hold;
    setRows((x) => x.map((y) => (y.id === r.id ? { ...y, hold, pick: hold ? null : y.pick } : y)));
    await supabase.from("items").update({ fb_hold: hold, ...(hold ? { fb_pick: null } : {}) }).eq("id", r.id);
    if (hold) setUndo({ label: `Skipped "${r.title}"`, run: () => toggleHold({ ...r, hold: true }) });
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
    const { error: postErr } = await supabase.from("items").update({ fb_ad_title: r.title, fb_ad_price: r.price, fb_relisted_at: at, fb_posted_price: r.price, posted_to: { ...r.postedTo, facebook: at }, ...dropFields(r.price) }).eq("id", r.id);
    if (postErr) { alert(`Couldn't record the post: ${postErr.message}`); return; }
    if (Object.keys(live).length) await supabase.from("items").update(live).eq("id", r.id).then(() => {}, () => {});
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
        <p className="muted text-sm">{queue.length} waiting • {today} reposted today • {live.length} on Facebook now</p>
      </div>

      <details className="card p-3">
        <summary className="font-bold cursor-pointer">💰 Sales from your Facebook ads: {sold.length} sold • ${soldTotal.toLocaleString()}{avgDays != null ? ` • about ${avgDays} day${avgDays === 1 ? "" : "s"} from repost to sale` : ""}</summary>
        <div className="space-y-1 mt-2 text-sm">
          {!sold.length && <p className="muted">Nothing marked sold yet. When something sells, tap 💰 Sold on it under 📅 On Facebook now.</p>}
          {sold.map((x) => (
            <p key={x.id}><b>${x.price ?? "?"}</b> {x.title}{x.buyer ? ` • to ${x.buyer}` : ""} <span className="muted">• {new Date(x.soldAt).toLocaleDateString()}{x.days != null ? ` • ${x.days} day${x.days === 1 ? "" : "s"} after repost` : " • before repost"}</span></p>
          ))}
        </div>
      </details>

      {rows.length > 0 && (
        <div className="card p-3 space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-bold">🤖 Let Claude in Chrome post them for you</p>
          <p className="text-sm">The app can&apos;t touch Facebook. Claude in Chrome does the clicking in <b>your own Chrome</b>, working down the list below: deletes the old ad, posts the new one, then waits a random {s.gapMin}–{s.gapMax} minutes, up to {s.perDay} a day. It only posts ads you marked ✅ Ready.</p>
          <ol className="text-sm list-decimal pl-5 space-y-1">
            <li>On your computer, open Chrome, signed in to Facebook and to nextownermarket.com.</li>
            <li>Tap the button below to copy the instructions.</li>
            <li>Open the Claude bar on the right side of Chrome, paste, and send. Leave Chrome open.</li>
          </ol>
          <button type="button" className="btn btn-primary w-full text-lg" style={{ minHeight: 56 }} onClick={() => navigator.clipboard.writeText(CHROME_PROMPT).then(() => setNote("✓ Copied. Paste it into the Claude bar in Chrome."))}>📋 Copy the instructions for Claude</button>
          <p className="text-xs muted">Watch the first one. If it goes right, save it in Claude in Chrome as a shortcut and schedule it daily. <Link href="/app/relist/next" className="underline">See the page Claude works from</Link>.</p>
        </div>
      )}
      {note && <p className="text-sm text-center">{note}</p>}

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

      {rows.some((r) => r.hold) && (
        <details className="card p-3" open style={{ borderColor: "var(--danger)" }}>
          <summary className="font-bold cursor-pointer">🚫 Skipped: {rows.filter((r) => r.hold && !r.removing && !r.removedAt).length} • 📤 Coming off Facebook: {rows.filter((r) => r.removing).length} • ✓ Taken off Facebook: {rows.filter((r) => r.removedAt).length}</summary>
          <p className="text-xs muted mt-1">Skipped ads won&apos;t be reposted but are still up on Facebook. 📤 Off FB has Claude in Chrome delete them there. Deleted-from-app items are in ☰ More → 🗑 Deleted.</p>
          <div className="space-y-2 mt-3">
            {rows.filter((r) => r.hold).map((r) => (
              <div key={r.id} className="flex gap-2 items-center">
                {r.photo ? <img src={r.photo} alt="" className="w-12 h-12 object-cover rounded shrink-0" /> : null}
                <div className="min-w-0 flex-1 text-sm"><p className="font-semibold truncate">{r.title}</p><p className="muted">{r.price ? `$${r.price}` : ""}{r.removedAt ? ` • ✓ taken off Facebook ${new Date(r.removedAt).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}` : r.removing ? " • 📤 coming off Facebook" : " • skipped (still up on Facebook)"}</p></div>
                <div className="flex flex-col gap-1 shrink-0">
                  {r.removedAt ? null : r.removing ? <button type="button" className="pill" onClick={() => keepOn(r.id)}>↩ Keep on Facebook</button> : <>
                    <button type="button" className="pill" onClick={() => toggleHold(r)}>↩ Undo skip</button>
                    <button type="button" className="pill" onClick={() => takeOff(r.id, r.title)}>📤 Off FB</button>
                  </>}
                  <button type="button" className="pill" onClick={() => remove(r)}>🗑 Delete</button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {!rows.length && (
        <div className="card p-4 space-y-2 text-center">
          <p className="font-semibold">Nothing waiting.</p>
          <Link href="/app/import" className="btn btn-primary w-full">📂 Bring in my Facebook ads</Link>
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-2">
          <p className="font-bold text-lg pt-2">📋 The line-up: all {queue.length}, in posting order</p>
          <p className="text-sm"><b>Nothing posts until you mark it ✅ Ready.</b> Look an ad over (price, title, photos), then tap <b>✅ Ready</b>. Claude in Chrome posts only ✅ Ready ads, in the order you marked them, up to {s.perDay} a day, and only after you start it. Tap ✅ again to un-ready it. 🚫 <b>Skip</b> keeps one from ever being reposted.</p>
          <p className="text-sm font-semibold">✅ {readyCount} ready • {queue.length - readyCount} not checked yet</p>
          <div className="grid grid-cols-4 gap-1">
            {([["old", "📅 Oldest first"], ["high", "💰 Highest price"], ["low", "Lowest price"], ["fb", "Facebook order"]] as [RelistSettings["order"], string][]).map(([k, l]) => (
              <button key={k} type="button" className={`pill ${s.order === k ? "font-bold" : ""}`} style={s.order === k ? { borderColor: "var(--brand)" } : {}} onClick={() => saveSettings({ ...s, order: k }, false)}>{l}</button>
            ))}
          </div>
          {left === 0 && <div className="card p-3 text-center"><p className="font-semibold">🎉 {today} reposted today. That&apos;s the day&apos;s {s.perDay}. The next {Math.min(s.perDay, queue.length)} go tomorrow.</p></div>}
          {queue.map((r, i) => (
            <div key={r.id} className="space-y-2">
              {i === 0 && readyCount > 0 && <p className="font-semibold text-sm" style={{ color: "var(--brand)" }}>⬇ ✅ READY: {todayN} will post today{readyCount > todayN ? `, ${readyCount - todayN} after that` : ""}</p>}
              {i === readyCount && <p className="font-semibold text-sm pt-2 border-t" style={{ borderColor: "var(--line)" }}>⬇ NOT CHECKED YET: these won&apos;t post until you mark them ✅ Ready</p>}
              <div className="card p-2 space-y-2" style={r.pick ? { borderColor: "var(--brand)", borderWidth: 2 } : {}}>
                <p className="text-sm font-bold rounded px-2 py-1" style={r.pick ? { background: "color-mix(in srgb, var(--brand) 15%, var(--surface))", color: "var(--brand)" } : { background: "var(--line)" }}>
                  {r.pick ? `✅ READY: #${i + 1} to post${i < todayN ? " (today)" : ""}` : "⬜ NOT CHECKED YET: won't post until you tap ✅ Ready?"}
                </p>
                <div className="flex gap-2 items-center">
                  {r.photo ? <img src={r.photo} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : <div className="w-16 h-16 rounded shrink-0" style={{ background: "var(--line)" }} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">#{i + 1} {r.title}</p>
                    <p className="text-xs muted">{r.price ? `$${r.price}` : "No price"}{r.location ? ` • 📍 ${r.location}` : ""} • {r.listedAt ? `on Facebook since ${new Date(r.listedAt).toLocaleDateString()} (${ageDays(r.listedAt)} days)` : "Facebook date not loaded yet"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs muted">Tap a price to use it (tap it again to undo). Now: <b>{r.price ? `$${Number(r.price)}` : "none"}</b>{flash[r.id] ? <b style={{ color: "var(--brand)" }}> {flash[r.id]}</b> : null}</p>
                  <div className="grid grid-cols-4 gap-1 text-center text-xs">
                    {([["Mine", r.mine], ["List", r.pc?.list_price ?? null], ["Fast", r.pc?.fast_price ?? null], ["Lowest", r.pc?.floor_price ?? null]] as [string, number | null][]).map(([l, v]) => {
                      const on = !!v && Number(r.price) === v;
                      return (
                        <button key={l} type="button" onClick={() => (v ? applyPrice(r, v, l) : setFlash((f) => ({ ...f, [r.id]: `No ${l} price yet. Tap 🔎 Check real price below to fill List, Fast and Lowest.` })))} className="card p-1" style={{ minHeight: 48, ...(on ? { borderColor: "var(--brand)", borderWidth: 2 } : {}), ...(!v ? { opacity: 0.45 } : {}) }}>
                          <div className="muted">{on ? "✓ " : ""}{l}</div><div className="font-bold">{v ? `$${v}` : "—"}</div>
                        </button>
                      );
                    })}
                  </div>
                  {r.pc ? (
                    <p className="text-xs">{r.pc.hold && <b style={{ color: "var(--danger)" }}>🛑 HOLD for top dollar (${r.pc.top_price}). </b>}<span className="muted">{r.pc.why}</span></p>
                  ) : (
                    <button type="button" className="pill w-full" disabled={!!checking[r.id]} onClick={() => checkPrice(r.id)}>{checking[r.id] ? "Checking real prices…" : "🔎 Check real price to fill List / Fast / Lowest (about 11¢)"}</button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button type="button" className="pill" onClick={() => toTop(r)}>{r.pick ? "⏫ To #1" : "⏫ Ready + #1"}</button>
                  <button type="button" className="pill" disabled={!r.pick || i === 0} onClick={() => moveBy(r, -1, queue)}>▲ Up one</button>
                  <button type="button" className="pill" disabled={!r.pick || !queue[i + 1]?.pick} onClick={() => moveBy(r, 1, queue)}>▼ Down one</button>
                  <button type="button" className="pill" disabled={!r.pick} onClick={() => toBottom(r)}>⏬ To bottom</button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button type="button" className={`pill ${r.pick ? "font-bold" : ""}`} onClick={() => togglePick(r)}>{r.pick ? "↩ Not ready" : "✅ Ready?"}</button>
                  <button type="button" className="pill" onClick={() => toggleHold(r)}>🚫 Skip</button>
                  <button type="button" className="pill" onClick={() => takeOff(r.id, r.title)}>📤 Off FB</button>
                  <button type="button" className="pill" onClick={() => remove(r)}>🗑 Delete</button>
                </div>
                <EditBox id={r.id} value={{ title: r.title, price: r.price, description: r.description, location: r.location }} onSaved={saved(r.id)} />
                <details className="text-sm">
                  <summary className="cursor-pointer muted">Do this one by hand instead</summary>
                  <div className="space-y-2 mt-2">
                    <a href={r.oldUrl || SELLING} target="_blank" rel="noreferrer" className="btn btn-secondary w-full" onClick={() => setDeleted((d) => ({ ...d, [r.id]: true }))}>Step 1: 🗑 Delete the old ad on Facebook</a>
                    <Link href={`/app/items/${r.id}?from=relist`} className={`btn w-full ${deleted[r.id] ? "btn-primary" : "btn-secondary"}`}>Step 2: 📋 Copy the new listing + save photos</Link>
                    <button type="button" className="btn btn-secondary w-full" onClick={() => reposted(r)}>Step 3: ✅ Tap here AFTER it&apos;s posted on Facebook</button>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}


      <div className="card p-3 space-y-2">
        <p className="font-semibold">How many a day?</p>
        <div className="grid grid-cols-5 gap-2">
          {PER_DAY_CHOICES.map((n) => (
            <button key={n} type="button" disabled={busy} className={`btn ${s.perDay === n ? "btn-primary" : "btn-secondary"}`} onClick={() => saveSettings({ ...s, perDay: n }, false)}>{n}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Wait at least (min)<input className="input" inputMode="numeric" value={s.gapMin} onChange={(e) => setS({ ...s, gapMin: Number(e.target.value.replace(/\D/g, "")) || 0 })} onBlur={() => saveSettings(s, false)} /></label>
          <label>Up to (min)<input className="input" inputMode="numeric" value={s.gapMax} onChange={(e) => setS({ ...s, gapMax: Number(e.target.value.replace(/\D/g, "")) || 0 })} onBlur={() => saveSettings(s, false)} /></label>
        </div>
        <p className="text-xs muted">Each wait is a random number in between (like 7, then 13, then 5 minutes).</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Start posting at (hour, 0–23)<input className="input" inputMode="numeric" value={s.startHour} onChange={(e) => setS({ ...s, startHour: Math.min(23, Number(e.target.value.replace(/\D/g, "")) || 0) })} onBlur={() => saveSettings(s, false)} /></label>
          <label>Stop at (hour, 1–24)<input className="input" inputMode="numeric" value={s.endHour} onChange={(e) => setS({ ...s, endHour: Math.min(24, Number(e.target.value.replace(/\D/g, "")) || 0) })} onBlur={() => saveSettings(s, false)} /></label>
        </div>
        <p className="text-xs muted">Posts only go up between {s.startHour > 12 ? `${s.startHour - 12} PM` : s.startHour === 12 ? "noon" : `${s.startHour || 12} AM`} and {s.endHour > 12 ? `${s.endHour - 12} PM` : s.endHour === 12 ? "noon" : `${s.endHour} AM`} Eastern, like a work day. Outside those hours the page says WAIT until the next start.</p>
        <p className="text-xs muted">Safe start: <b>15 a day</b>, a random 5 to 15 minutes apart. Facebook publishes no limit, but sellers report 10–15 a day is safe for an account new to posting this way, and 15–30 once it&apos;s been going a while with no warnings. Every relist is a delete plus a post, and both count. Go up only after a week with no warnings.</p>
      </div>

      {live.length > 0 && (
        <details className="card p-3" open={due.length > 0}>
          <summary className="font-semibold cursor-pointer">📅 On Facebook now: {live.length}{due.length ? ` • 🔁 ${due.length} due to relist` : ""}</summary>
          <div className="space-y-2 mt-3">
            <label className="text-sm flex items-center gap-2">Relist after<input className="input w-20" inputMode="numeric" value={s.relistAfter} onChange={(e) => setS({ ...s, relistAfter: Number(e.target.value.replace(/\D/g, "")) || 0 })} onBlur={() => saveSettings(s, false)} />days</label>
            {live.map((l) => {
              const d = ageDays(l.at);
              return (
                <div key={l.id} className="flex gap-2 items-center">
                  {l.photo ? <img src={l.photo} alt="" className="w-12 h-12 object-cover rounded shrink-0" /> : null}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold truncate">{l.title}</p>
                    <p className="muted">Posted {new Date(l.at).toLocaleDateString()} • <b style={d >= s.relistAfter ? { color: "var(--danger)" } : {}}>{d} day{d === 1 ? "" : "s"} old</b>{l.price ? ` • $${l.price}` : ""}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button type="button" className="pill" onClick={() => relistAgain(l)}>{d >= s.relistAfter ? "🔁 Relist now" : "🔁 Relist"}</button>
                    <button type="button" className="pill" onClick={() => takeOff(l.id, l.title)}>📤 Off Facebook</button>
                    <SoldBox id={l.id} price={l.price} buyers={buyers[l.id] || []} onDone={(s) => { setLive((x) => x.filter((y) => y.id !== l.id)); setSold((x) => [{ id: l.id, title: l.title, price: s.price, buyer: s.buyer || null, soldAt: new Date().toISOString(), reposted: l.at, days: ageDays(l.at) }, ...x]); setNote(`💰 "${l.title}" sold for $${s.price}${s.buyer ? ` to ${s.buyer}` : ""}. Nice!`); }} />
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

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
      {undo && (
        <div className="fixed bottom-3 inset-x-3 z-50 card p-3 flex items-center gap-2" style={{ borderColor: "var(--brand)", background: "var(--surface)" }}>
          <span className="text-sm flex-1 truncate">{undo.label}</span>
          <button type="button" className="btn btn-primary" onClick={async () => { const u = undo; setUndo(null); await u.run(); }}>↩ Undo</button>
          <button type="button" className="pill" onClick={() => setUndo(null)} aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}
