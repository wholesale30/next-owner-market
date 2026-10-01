"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Auto = { key: string; name: string; what: string; why: string; schedule: string; enabled: boolean; last_run_at: string | null; last_result: Record<string, unknown> | null; runs_count: number };
type Task = { id: string; area: string; title: string; what: string; why: string; how: string; link: string | null; frequency: string; done_at: string | null; notes: string | null };

const STAT: { key: string; label: string; meaning: string; money?: boolean }[] = [
  { key: "signups_total", label: "Accounts", meaning: "Everyone who has ever signed up, buyers and sellers." },
  { key: "signups_7d", label: "New this week", meaning: "Sign-ups in the last 7 days. The marketing plan's job is to move this." },
  { key: "sellers", label: "Sellers", meaning: "Accounts that can list. Buyers become sellers the first time they list." },
  { key: "sellers_with_payouts", label: "…with payouts set up", meaning: "Sellers whose items can actually be bought. If this is much lower than Sellers, buyers are seeing 'Message' instead of 'Buy'." },
  { key: "pro", label: "Pro accounts", meaning: "Everyone on Pro, including free (gifted) ones." },
  { key: "pro_paying", label: "Paying Pro", meaning: "Pro accounts that pay $15/month. This times 15 is monthly subscription revenue." },
  { key: "items_live", label: "Items live", meaning: "Listings buyers can see right now. Each is a page Google can find." },
  { key: "items_7d", label: "Listed this week", meaning: "New listings in 7 days. If sign-ups are up and this isn't, people get stuck after signing up." },
  { key: "drafts", label: "Drafts / waiting", meaning: "Written but not live: drafts, and listings waiting for your approval under Review." },
  { key: "pending_review", label: "Waiting for approval", meaning: "Listings you need to approve. Tap Review." },
  { key: "pending_sellers", label: "Sellers to approve", meaning: "New sellers waiting for a human OK. Tap People." },
  { key: "orders_paid", label: "Orders (all time)", meaning: "Paid orders ever, including completed." },
  { key: "orders_open", label: "Orders in progress", meaning: "Paid but not handed over yet. Money is being held." },
  { key: "gmv", label: "Sold (all time)", meaning: "Total paid through the store. Buyers see 'gross merchandise value' in investor talk.", money: true },
  { key: "gmv_30d", label: "Sold, last 30 days", meaning: "Same, last month. The number that shows the store is alive.", money: true },
  { key: "commission_30d", label: "Our cut, last 30 days", meaning: "Commission earned on completed sales in the last month.", money: true },
  { key: "disputes_open", label: "Problems open", meaning: "Orders where someone reported a problem. Money frozen; needs a decision." },
  { key: "valuations_public", label: "Public valuations", meaning: "'What things are worth' pages people chose to share. Each is a page Google can rank." },
  { key: "pile_scans", label: "Piles sorted", meaning: "Times someone used Sort the pile." },
  { key: "buypass_scans", label: "Buy-or-pass checks", meaning: "Times someone used Buy or pass?" },
  { key: "posts_live", label: "Blog posts", meaning: "Published posts, including the automatic weekly ones." },
  { key: "threads", label: "Community posts", meaning: "Threads on the community board." },
  { key: "reports_open", label: "Reports to look at", meaning: "Community posts someone flagged. See the bottom of Blog." },
  { key: "subscribers", label: "Email subscribers", meaning: "People on the New Arrivals list." },
  { key: "emails_7d", label: "Automatic emails, 7 days", meaning: "Welcome, nudges, milestones, review requests the site sent on its own." },
  { key: "views_7d", label: "Item views (total)", meaning: "Page views across all items (counted since Sept 30)." },
  { key: "favorites", label: "Items saved", meaning: "Hearts on items. Savers get price-drop emails." },
  { key: "invites_used", label: "Invites used", meaning: "Free-Pro invite links that were redeemed." },
];

const GLOSSARY: [string, string][] = [
  ["Automation", "Something the site does by itself on a schedule, with no one pressing anything. Each one below says what it does, why, when it last ran, and what happened."],
  ["Daily job", "Once a day (about 9 AM Eastern) the site runs every automation in order. 'Run now' runs one immediately."],
  ["Held money", "When a buyer pays, the money sits with us (Stripe) until the buyer has the item. Then it goes to the seller. That's what makes strangers trust each other."],
  ["Pro", "The $15/month plan: unlimited AI listings and lookups, copy-and-paste for nine marketplaces, Sort the pile, video. Free Pro = gifted by us."],
  ["Commission", "Our percentage of a store sale (default 15%, on the item price only). We earn when the seller earns."],
  ["Indexing", "Google (and Bing) reading our pages so they show up in search. The site tells them about new pages automatically; the tasks below are the one-time setup."],
  ["Backlink", "Another website linking to ours. Google counts these as votes. The free widget and creator deals exist to get them."],
  ["Nudge", "A short automatic email to a seller when their listing needs attention (lots of views, saves, drafts sitting, payouts not set up)."],
  ["Milestone", "An automatic congratulations when a seller hits a mark (first sale, $100, $500…) with a line they can paste on social media."],
  ["Valuation", "A 'what's it worth' result. If the person ticks 'share,' it becomes a public page with no name on it."],
];

const KIND_LABEL: Record<string, string> = { welcome_1: "Welcome day 1", welcome_3: "Welcome day 3", welcome_7: "Welcome day 7", nudge_views: "Views, no messages", nudge_saves: "People saved it", nudge_drafts: "Drafts waiting", nudge_payouts: "Set up payouts", review_request: "Review request" };

export default function OpsClient({ stats, automations, tasks, emailsByKind, posts, now }: { now: number; stats: Record<string, number>; automations: Auto[]; tasks: Task[]; emailsByKind: Record<string, number>; posts: { slug: string; title: string; published_at: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const money = (n: number) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
  async function run(key: string) { setBusy(key); const r = await fetch("/api/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run", key }) }); const j = await r.json(); setOut((o) => ({ ...o, [key]: JSON.stringify(j.result || j) })); setBusy(null); router.refresh(); }
  async function toggle(key: string, enabled: boolean) { await fetch("/api/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", key, enabled }) }); router.refresh(); }
  async function task(id: string, done: boolean, n?: string) { await fetch("/api/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "task", id, done, notes: n }) }); router.refresh(); }
  const areas = [...new Set(tasks.map((t) => t.area))];
  const ago = (d: string | null) => d ? `${Math.round((now - new Date(d).getTime()) / 3600_000)}h ago` : "never";
  const plain = (r: Record<string, unknown> | null) => !r ? "—" : Object.entries(r).filter(([k]) => k !== "ms").map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🎛 Operations</h1>
        <p className="text-sm muted">Everything the site does, in one place, explained so anyone can run it. Three parts: <b>the numbers</b> (what&apos;s happening), <b>what runs by itself</b> (and whether it worked), and <b>what a person still has to do</b> (with exact steps). Words you don&apos;t know are at the bottom.</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold text-lg">The numbers</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {STAT.map((s) => (
            <details key={s.key} className="card p-3">
              <summary className="cursor-pointer list-none"><p className="text-2xl font-extrabold">{s.money ? money(stats[s.key]) : Number(stats[s.key] || 0).toLocaleString()}</p><p className="text-xs font-semibold">{s.label}</p></summary>
              <p className="text-xs muted pt-1">{s.meaning}</p>
            </details>
          ))}
        </div>
        <p className="text-xs muted">Tap a number to see what it means.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-lg">What runs by itself</h2>
        <p className="text-sm muted">Each one runs in the daily job. Green = on. &quot;Last run&quot; shows when and what happened, in plain words. Switch one off if it&apos;s ever misbehaving; tell Claude.</p>
        {automations.map((a) => (
          <div key={a.key} className="card p-3 space-y-1" style={{ borderLeft: `4px solid ${a.enabled ? "var(--ok)" : "var(--muted)"}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-bold">{a.name}</p><p className="text-xs muted">{a.schedule} · ran {a.runs_count} time{a.runs_count === 1 ? "" : "s"} · last {ago(a.last_run_at)}</p></div>
              <label className="flex items-center gap-1 text-xs shrink-0"><input type="checkbox" checked={a.enabled} onChange={(e) => toggle(a.key, e.target.checked)} /> On</label>
            </div>
            <p className="text-sm"><b>What it does:</b> {a.what}</p>
            <p className="text-sm muted"><b>Why:</b> {a.why}</p>
            <p className="text-xs"><b>Last result:</b> {out[a.key] || plain(a.last_result)}</p>
            <button type="button" className="pill px-3 py-1" disabled={busy === a.key} onClick={() => run(a.key)}>{busy === a.key ? "Running…" : "▶ Run now"}</button>
          </div>
        ))}
        <div className="card p-3 text-sm space-y-1">
          <p className="font-semibold">Automatic emails sent this week</p>
          {Object.keys(emailsByKind).length === 0 ? <p className="muted">None yet.</p> : <p className="muted">{Object.entries(emailsByKind).map(([k, n]) => `${KIND_LABEL[k] || k.replace(/_/g, " ")}: ${n}`).join(" · ")}</p>}
          <p className="font-semibold pt-2">Latest blog posts (automatic ones start with &quot;This week&quot;)</p>
          <ul className="muted">{posts.map((p) => <li key={p.slug}><Link href={`/blog/${p.slug}`} className="underline">{p.title}</Link>{p.published_at ? "" : " (draft)"}</li>)}</ul>
        </div>
        <div className="card p-3 text-sm space-y-1">
          <p className="font-semibold">Also running, with nothing to switch</p>
          <ul className="list-disc pl-5 muted">
            <li>Sitemap rebuilds itself every hour (every item, category, valuation, hub, city page, post, guide).</li>
            <li>Google Shopping feed refreshes every 30 minutes (/feed/google.xml).</li>
            <li>Every item, valuation, and post is pushed to Bing/DuckDuckGo the moment it&apos;s published.</li>
            <li>Share images are made on the fly for every item, valuation, and tool page.</li>
            <li>Hub pages (&quot;What is a ___ worth?&quot;) and city pages appear on their own once there&apos;s enough data.</li>
            <li>Price-drop emails go to everyone who saved an item when its price falls.</li>
            <li>Staff get an email/text for new orders, problems, messages, listings to review, new sellers, invites used.</li>
            <li>Nightly backup of every table, 30 days kept.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-lg">What a person still has to do</h2>
        <p className="text-sm muted">These can&apos;t be automated (they need a human login or a human judgment). Each says what, why, and the exact steps. Tick it when done; leave a note for the next person.</p>
        {areas.map((area) => (
          <div key={area} className="space-y-2">
            <h3 className="font-semibold">{area}</h3>
            {tasks.filter((t) => t.area === area).map((t) => (
              <details key={t.id} className="card p-3" style={t.done_at && t.frequency === "once" ? { opacity: .6 } : undefined}>
                <summary className="cursor-pointer flex items-center justify-between gap-2"><span className="font-semibold">{t.done_at && t.frequency === "once" ? "✅ " : t.done_at ? "☑ " : "⬜ "}{t.title}</span><span className="pill">{t.frequency}</span></summary>
                <div className="pt-2 space-y-2 text-sm">
                  <p><b>What:</b> {t.what}</p>
                  <p className="muted"><b>Why:</b> {t.why}</p>
                  <div><b>How:</b><pre className="whitespace-pre-wrap font-sans text-sm mt-1 p-2 rounded-lg" style={{ background: "var(--line)" }}>{t.how}</pre></div>
                  {t.link && (t.link.startsWith("/") ? <Link href={t.link} className="btn btn-secondary">Open →</Link> : <a href={t.link} target="_blank" rel="noreferrer" className="btn btn-secondary">Open ↗</a>)}
                  <textarea className="input" rows={2} placeholder="Notes for the next person (what you did, what you saw)" value={notes[t.id] ?? t.notes ?? ""} onChange={(e) => setNotes({ ...notes, [t.id]: e.target.value })} onBlur={() => task(t.id, !!t.done_at, notes[t.id] ?? t.notes ?? "")} />
                  <div className="flex gap-2"><button type="button" className="btn btn-primary" onClick={() => task(t.id, true, notes[t.id] ?? t.notes ?? "")}>{t.frequency === "once" ? "Mark done" : "Done for now"}</button>{t.done_at && <button type="button" className="btn btn-secondary" onClick={() => task(t.id, false)}>Undo</button>}</div>
                  {t.done_at && <p className="text-xs muted">Last done {new Date(t.done_at).toLocaleString()}</p>}
                </div>
              </details>
            ))}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-lg">Words</h2>
        {GLOSSARY.map(([w, d]) => <p key={w} className="text-sm"><b>{w}:</b> {d}</p>)}
      </section>
    </div>
  );
}
