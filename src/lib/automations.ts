import { createClient as createAdmin } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "@/lib/md";

/**
 * Everything the site does by itself. Each automation is a small function that:
 *  - reads real data, decides who/what qualifies, acts (email, post, price drop…)
 *  - records what it did in `automations.last_result` so the Operations page can show it in plain English
 * Runs from the daily job (/api/notify/send). Each one can be switched off from Operations.
 */
const db = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
const DAILY_EMAIL_CAP = Number(process.env.AUTOMATION_EMAIL_CAP || 80);

type Result = Record<string, unknown>;
type Automation = { key: string; name: string; what: string; why: string; schedule: string; sort_order: number; run: () => Promise<Result> };

async function send(to: string, subject: string, text: string, opts: { profile_id?: string | null; kind: string; ref_id?: string | null }) {
  const d = db();
  if (!process.env.RESEND_API_KEY) return false;
  const { data: biz } = await d.from("settings").select("value").eq("key", "business").maybeSingle();
  const name = (biz?.value as { name?: string })?.name || "Next Owner Market";
  const from = process.env.EMAIL_FROM || `${name} <alerts@nextownermarket.com>`;
  const footer = `\n\n—\n${name} · ${site()}\nStop these emails: ${site()}/unsubscribe`;
  let ok = false;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text: text + footer }) });
    ok = r.ok;
  } catch { ok = false; }
  await d.from("email_log").insert({ profile_id: opts.profile_id || null, to_email: to, kind: opts.kind, ref_id: opts.ref_id || null, subject, ok });
  return ok;
}

async function alreadySent(profile_id: string, kind: string, ref_id?: string | null) {
  let q = db().from("email_log").select("id", { count: "exact", head: true }).eq("profile_id", profile_id).eq("kind", kind);
  q = ref_id ? q.eq("ref_id", ref_id) : q.is("ref_id", null);
  const { count } = await q;
  return (count || 0) > 0;
}

/** Budget so the free email tier is never blown in one run. */
async function budget() {
  const { count } = await db().from("email_log").select("id", { count: "exact", head: true }).gte("sent_at", new Date(Date.now() - 86400_000).toISOString());
  return Math.max(0, DAILY_EMAIL_CAP - (count || 0));
}

// ---------------------------------------------------------------- welcome series
const welcome: Automation = {
  key: "welcome_series", name: "Welcome series (day 1, 3, 7)", schedule: "daily", sort_order: 10,
  what: "Three short emails to every new account: day 1 'start with one box', day 3 'what your first item is probably worth', day 7 'list something this week'. Each only once, and only if they haven't already done the thing.",
  why: "People who list something in their first week stay. People who don't, vanish. These emails turn sign-ups into sellers.",
  async run() {
    const d = db(); let left = await budget(); const sent: string[] = [];
    const { data: people } = await d.from("profiles").select("id, email, full_name, username, role, created_at, marketing_opt_out").gte("created_at", new Date(Date.now() - 10 * 86400_000).toISOString()).not("email", "is", null);
    for (const p of people || []) {
      if (left <= 0) break;
      if (p.marketing_opt_out || p.role === "admin" || p.role === "staff") continue;
      const days = (Date.now() - new Date(p.created_at).getTime()) / 86400_000;
      const first = p.full_name?.split(" ")[0] || "there";
      const { count: items } = await d.from("items").select("id", { count: "exact", head: true }).eq("owner_id", p.id);
      if (days >= 1 && !(await alreadySent(p.id, "welcome_1"))) {
        await send(p.email, "Start with one box", `Hi ${first},\n\nWelcome to Next Owner Market. Here's the only tip that matters: don't look at the whole pile. Pick one box.\n\nPhotograph it, go to ${site()}/pile, and tap Sort it. In a minute you'll see what's in it, what it's worth, and what to sell, keep, donate, or toss. The ones worth selling become listings in one tap.\n\nThe full path, eight steps, plain English: ${site()}/start\n\nYou get three free AI lookups to start. Go find a box.`, { profile_id: p.id, kind: "welcome_1" }); sent.push("1"); left--;
      } else if (days >= 3 && !(await alreadySent(p.id, "welcome_3")) && (items || 0) === 0) {
        await send(p.email, "What's the first thing you'd sell worth?", `Hi ${first},\n\nQuick one. Think of the first thing you'd get rid of if it were easy. The lamp, the drill, the stereo in the basement.\n\nTake one photo of it and open ${site()}/worth. Thirty seconds later you'll know what it's worth and where it sells best. If it's worth selling, there's a List it now button and the listing is already written.\n\nMost people's first item is worth more than they thought.`, { profile_id: p.id, kind: "welcome_3" }); sent.push("3"); left--;
      } else if (days >= 7 && !(await alreadySent(p.id, "welcome_7"))) {
        const txt = (items || 0) > 0
          ? `Hi ${first},\n\nYou've got ${items} item${items === 1 ? "" : "s"} on Next Owner Market. Nice. Two things that get them sold faster:\n\n1. Copy them to Facebook Marketplace: open the item in your app, tap the Facebook tab, Copy, paste. Local buyers are there.\n2. Make sure payouts are set up (Payouts in your app, 5 minutes) so buyers can hit Buy.\n\nThen do the next box: ${site()}/pile`
          : `Hi ${first},\n\nA week in and nothing listed yet. That's normal; the hard part is starting. So here's the smallest possible start: one item, one photo, ${site()}/worth. You don't have to sell it. Just see the number.\n\nIf you're staring at a garage and not a lamp: ${site()}/start walks you through it one box at a time.`;
        await send(p.email, (items || 0) > 0 ? "Two things that sell your items faster" : "The smallest possible start", txt, { profile_id: p.id, kind: "welcome_7" }); sent.push("7"); left--;
      }
    }
    return { emails_sent: sent.length, budget_left: left };
  },
};

// ---------------------------------------------------------------- nudges
const nudges: Automation = {
  key: "seller_nudges", name: "Seller nudges", schedule: "daily", sort_order: 20,
  what: "Emails a seller when something on their listing deserves attention: lots of views but no messages (suggest a small price drop), people saving it, drafts sitting for 3+ days, payouts not set up while a listing is live. Each nudge once per item.",
  why: "Every nudge is a reason to open the app and act. Price drops sell stuck items; drafts become listings; payouts get set up so buyers can buy.",
  async run() {
    const d = db(); let left = await budget(); let n = 0;
    const { data: hot } = await d.from("items").select("id, sku, title, price, view_count, save_count, owner_id, listed_at, profiles!items_owner_id_fkey(email, full_name, role, marketing_opt_out, stripe_payouts_ready)").eq("status", "active").gte("view_count", 20).order("view_count", { ascending: false }).limit(200);
    for (const it of hot || []) {
      if (left <= 0) break;
      const p = it.profiles as unknown as { email: string | null; full_name: string | null; role: string; marketing_opt_out: boolean; stripe_payouts_ready: boolean };
      if (!p?.email || p.marketing_opt_out || p.role === "admin" || p.role === "staff") continue;
      const { count: msgs } = await d.from("conversations").select("id", { count: "exact", head: true }).eq("item_id", it.id);
      if ((msgs || 0) === 0 && !(await alreadySent(it.owner_id, "nudge_views", it.id))) {
        await send(p.email, `${it.view_count} people looked at "${it.title.slice(0, 50)}"`, `${it.view_count} people have looked at your listing and nobody's asked about it yet. That usually means the price is a little high for what buyers see.\n\nTry dropping it $${Math.max(5, Math.round(Number(it.price) * 0.1))} (about 10%). Open it: ${site()}/app/items/${it.id}\n\nOr set it to drop by itself: on that page, "Drop the price automatically."`, { profile_id: it.owner_id, kind: "nudge_views", ref_id: it.id }); n++; left--;
      } else if ((it.save_count || 0) >= 3 && !(await alreadySent(it.owner_id, "nudge_saves", it.id))) {
        await send(p.email, `${it.save_count} people saved your "${it.title.slice(0, 50)}"`, `${it.save_count} buyers have saved your listing. They're waiting for something: usually a small price drop. When you lower the price, every one of them gets an email about it.\n\n${site()}/app/items/${it.id}`, { profile_id: it.owner_id, kind: "nudge_saves", ref_id: it.id }); n++; left--;
      }
    }
    // drafts sitting 3+ days
    const { data: drafts } = await d.from("items").select("owner_id, profiles!items_owner_id_fkey(email, full_name, role, marketing_opt_out)").eq("status", "draft").lt("created_at", new Date(Date.now() - 3 * 86400_000).toISOString()).limit(500);
    const byOwner = new Map<string, { n: number; p: { email: string | null; role: string; marketing_opt_out: boolean } }>();
    for (const r of drafts || []) { const p = r.profiles as unknown as { email: string | null; role: string; marketing_opt_out: boolean }; const cur = byOwner.get(r.owner_id) || { n: 0, p }; cur.n++; byOwner.set(r.owner_id, cur); }
    for (const [owner, { n: cnt, p }] of byOwner) {
      if (left <= 0) break;
      if (!p?.email || p.marketing_opt_out || p.role === "admin" || p.role === "staff") continue;
      const { data: last } = await d.from("email_log").select("sent_at").eq("profile_id", owner).eq("kind", "nudge_drafts").order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.sent_at).getTime() < 14 * 86400_000) continue;
      await send(p.email, `${cnt} draft${cnt === 1 ? "" : "s"} waiting to go live`, `You've got ${cnt} listing${cnt === 1 ? "" : "s"} written and sitting in Drafts. They can't sell from there.\n\nOpen My items → Drafts, give each one a quick read, tap List it. Takes about a minute each: ${site()}/app?status=draft`, { profile_id: owner, kind: "nudge_drafts" }); n++; left--;
    }
    // live listing but no payouts
    const { data: noPay } = await d.from("profiles").select("id, email, full_name, marketing_opt_out").eq("role", "consignor").eq("stripe_payouts_ready", false).not("email", "is", null).limit(300);
    for (const p of noPay || []) {
      if (left <= 0) break;
      if (p.marketing_opt_out) continue;
      const { count: live } = await d.from("items").select("id", { count: "exact", head: true }).eq("owner_id", p.id).eq("status", "active");
      if (!live) continue;
      const { data: last } = await d.from("email_log").select("sent_at").eq("profile_id", p.id).eq("kind", "nudge_payouts").order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.sent_at).getTime() < 7 * 86400_000) continue;
      await send(p.email, "Buyers can't hit Buy on your items yet", `Your listings are live, but until payouts are set up, buyers only see "Message the seller" instead of Buy now.\n\nIt's five minutes: name, address, bank account. Handled by Stripe. ${site()}/app/money\n\nAfter that, every sale lands in your bank on its own.`, { profile_id: p.id, kind: "nudge_payouts" }); n++; left--;
    }
    return { emails_sent: n, budget_left: left };
  },
};

// ---------------------------------------------------------------- milestones
const milestones: Automation = {
  key: "milestones", name: "Milestones & share moments", schedule: "daily", sort_order: 30,
  what: "When a seller hits a milestone (first listing, 10 listings, first sale, third sale, $100, $500, $1,000 sold), they get a short congratulations with a ready-to-share line. Each once.",
  why: "People share wins. 'I just cleared $500 of garage junk' in a Facebook group brings the next seller. And a first sale is the moment someone decides this works.",
  async run() {
    const d = db(); let left = await budget(); let n = 0;
    const { data: sellers } = await d.from("profiles").select("id, email, full_name, username, role, marketing_opt_out, completed_sales").in("role", ["consignor"]).not("email", "is", null).limit(1000);
    for (const p of sellers || []) {
      if (left <= 0) break;
      if (p.marketing_opt_out) continue;
      const { count: listings } = await d.from("items").select("id", { count: "exact", head: true }).eq("owner_id", p.id).in("status", ["active", "reserved", "sold"]);
      const { data: sold } = await d.from("orders").select("amount").eq("seller_id", p.id).eq("status", "released");
      const total = (sold || []).reduce((a, o) => a + Number(o.amount), 0);
      const sales = (sold || []).length;
      const first = p.full_name?.split(" ")[0] || "there";
      const checks: [string, boolean, string, string][] = [
        ["first_listing", (listings || 0) >= 1, "Your first listing is live", `Hi ${first},\n\nYour first item is live on Next Owner Market. That's the hard part done.\n\nNext: copy it to Facebook Marketplace (open the item, Facebook tab, Copy, paste) so local buyers see it too. Then the next box.`],
        ["ten_listings", (listings || 0) >= 10, "Ten listings. You're rolling.", `Hi ${first},\n\nTen items listed. Most people never get past one. If you're on the free plan, this is where Pro pays for itself: unlimited AI listings, all nine marketplaces, and the pile sorter. ${site()}/pro`],
        ["first_sale", sales >= 1, "You made your first sale 🎉", `Hi ${first},\n\nFirst sale done and paid. The money lands in your bank in about two business days.\n\nWant to tell someone? Here's a line you can paste:\n"Sold my first thing on Next Owner Market. Took a photo, it wrote the listing, buyer paid by card. ${site()}"`],
        ["third_sale", sales >= 3, "Three sales: your limits just came off", `Hi ${first},\n\nThree completed sales. The new-seller limits (5 listings, $500) are off your account now. List as much as you want.`],
        ["sold_100", total >= 100, "You've sold $100 of stuff", `Hi ${first},\n\nYou've cleared $${Math.round(total)} of things that were just sitting there. Paste-able: "Turned $${Math.round(total)} of stuff I wasn't using into cash this month. ${site()}"`],
        ["sold_500", total >= 500, "$500. That's a real dent.", `Hi ${first},\n\n$${Math.round(total)} sold. That's a car payment, from a pile. Keep going: ${site()}/pile`],
        ["sold_1000", total >= 1000, "$1,000 sold. You're a reseller now.", `Hi ${first},\n\nOver a thousand dollars sold through Next Owner Market. If you haven't yet, the Year page in your app has it all added up for tax time: ${site()}/app/taxes`],
      ];
      for (const [key, hit, subj, body] of checks) {
        if (!hit || left <= 0) continue;
        const { data: have } = await d.from("milestones").select("key").eq("profile_id", p.id).eq("key", key).maybeSingle();
        if (have) continue;
        await d.from("milestones").insert({ profile_id: p.id, key });
        await send(p.email, subj, body, { profile_id: p.id, kind: `milestone_${key}` }); n++; left--;
      }
    }
    return { emails_sent: n, budget_left: left };
  },
};

// ---------------------------------------------------------------- review requests
const reviews: Automation = {
  key: "review_requests", name: "Ask for a review after each sale", schedule: "daily", sort_order: 40,
  what: "One day after an order is completed, buyer and seller each get one email: 'How did it go?' with a link to rate the other person. Once per order.",
  why: "Reviews show on seller pages and the home page, and in Google results. Trust is what makes strangers pay a stranger.",
  async run() {
    const d = db(); let left = await budget(); let n = 0;
    const { data: orders } = await d.from("orders").select("id, buyer_id, seller_id, released_at, items(title)").eq("status", "released").gte("released_at", new Date(Date.now() - 7 * 86400_000).toISOString()).lte("released_at", new Date(Date.now() - 86400_000).toISOString()).limit(200);
    for (const o of orders || []) {
      for (const who of [o.buyer_id, o.seller_id]) {
        if (left <= 0) break;
        const { data: rated } = await d.from("ratings").select("id").eq("order_id", o.id).eq("rater_id", who).maybeSingle();
        if (rated || (await alreadySent(who, "review_request", o.id))) continue;
        const { data: p } = await d.from("profiles").select("email, marketing_opt_out").eq("id", who).single();
        if (!p?.email || p.marketing_opt_out) continue;
        const title = (o.items as unknown as { title: string } | null)?.title || "your order";
        await send(p.email, `How did it go? (${title.slice(0, 40)})`, `Your order for "${title}" is complete. One tap to rate the other person: ${site()}/account/orders/${o.id}\n\nRatings show on profiles so the next buyer or seller knows who they're dealing with. Thanks.`, { profile_id: who, kind: "review_request", ref_id: o.id }); n++; left--;
      }
    }
    return { emails_sent: n, budget_left: left };
  },
};

// ---------------------------------------------------------------- weekly auto blog
const weeklyBlog: Automation = {
  key: "weekly_blog", name: "Weekly blog post from the site's own data", schedule: "weekly (Monday)", sort_order: 50,
  what: "Every Monday, writes and publishes a post: what people valued this week and what it was worth, what sold and for how much, which categories are moving, plus one tip. Built from real numbers on the site; the AI only writes the sentences.",
  why: "Fifty-two new pages a year with real numbers in them, without anyone writing. Google rewards sites that keep publishing; people share 'what sold this week' posts.",
  async run() {
    const d = db();
    const day = new Date().getUTCDay();
    const force = process.env.FORCE_WEEKLY_BLOG === "1";
    if (day !== 1 && !force) return { skipped: "not Monday" };
    const weekStart = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: exists } = await d.from("posts").select("id").gte("created_at", new Date(Date.now() - 6 * 86400_000).toISOString()).like("slug", "this-week-%").maybeSingle();
    if (exists && !force) return { skipped: "already posted this week" };
    const [{ data: vals }, { data: sold }, { data: listed }] = await Promise.all([
      d.from("valuations").select("title, value_low, value_high, category, slug").eq("is_public", true).gte("created_at", weekStart).order("value_high", { ascending: false }).limit(15),
      d.from("orders").select("amount, items(title, sku, categories(name))").eq("status", "released").gte("released_at", weekStart).limit(30),
      d.from("items").select("title, sku, price, categories(name)").eq("status", "active").gte("listed_at", weekStart).order("listed_at", { ascending: false }).limit(30),
    ]);
    if (!vals?.length && !sold?.length && !listed?.length) return { skipped: "nothing happened this week" };
    if (!process.env.ANTHROPIC_API_KEY) return { skipped: "no AI key" };
    const client = new Anthropic();
    const data = { valued: vals, sold: (sold || []).map((o) => ({ title: (o.items as unknown as { title: string })?.title, price: o.amount })), listed: (listed || []).map((i) => ({ title: i.title, price: i.price, sku: i.sku, category: (i.categories as unknown as { name: string } | null)?.name })) };
    const msg = await client.messages.create({
      model: process.env.CLAUDE_ASK_MODEL || "claude-haiku-4-5-20251001", max_tokens: 1800,
      messages: [{ role: "user", content: `Write this week's post for the Next Owner Market blog (a marketplace where people photograph their stuff, an AI values it and writes the listing, buyers pay by card with money held until hand-off). Plain, friendly, 8th-grade English, first person plural ("we"), no hype, no "AI-powered". 350-550 words. Use ONLY the real data below; do not invent items or numbers. Structure: a short opener about the week; "What people found out their stuff is worth" (3-6 items with the ranges, link each as [title](/valued/slug) when a slug exists); "What sold" (if any, titles and prices); "New this week" (3-5 listed items as [title](/item/SKU)); one practical tip for someone overwhelmed by a pile; a closing line pointing to /pile or /worth. Markdown. Return only the post body, no title.\n\nDATA:\n${JSON.stringify(data).slice(0, 12000)}` }],
    });
    const body = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    const dt = new Date();
    const title = `This week on Next Owner Market: ${dt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
    const slug = `this-week-${dt.toISOString().slice(0, 10)}`;
    const excerpt = `What people found out their stuff is worth, what sold, and what's new this week. Real numbers from real piles.`;
    const { error } = await d.from("posts").insert({ slug, title, excerpt, body, published_at: dt.toISOString() });
    if (error) return { error: error.message };
    try { const { indexNow } = await import("@/lib/indexnow"); await indexNow([`/blog/${slug}`, "/blog"]); } catch { /* ok */ }
    return { posted: slug, words: body.split(/\s+/).length };
  },
};

// ---------------------------------------------------------------- price drops (existing SQL) + comps expiry are called directly in the daily job; register them for visibility
const priceDrops: Automation = { key: "price_drops", name: "Automatic price drops", schedule: "daily", sort_order: 60,
  what: "For every listing where the seller set 'drop X% every Y days, never below Z', lowers the price on schedule. Buyers who saved the item get a price-drop email.",
  why: "Stuck listings sell. Sellers set it once and forget it.",
  async run() { const { data } = await db().rpc("run_price_drops"); return { items_dropped: data ?? 0 }; } };

const comps: Automation = { key: "expire_comps", name: "Expire free Pro that had an end date", schedule: "daily", sort_order: 70,
  what: "Free Pro given for a set number of months ends on time; the account goes back to Free (or stays Pro if they're paying).",
  why: "Keeps gifts honest and the Pro count real.",
  async run() { const { data } = await db().rpc("expire_comps"); return { expired: data ?? 0 }; } };

const feedPing: Automation = { key: "search_engines", name: "Tell search engines what changed", schedule: "daily (and on every publish)", sort_order: 80,
  what: "Sends every item, valuation, post, and page that changed in the last day to Bing, DuckDuckGo, Yandex and Seznam (IndexNow). Google reads the sitemap, which rebuilds itself hourly, and the Merchant Center feed, which refreshes every 30 minutes.",
  why: "New pages get found in hours instead of weeks.",
  async run() {
    const d = db(); const since = new Date(Date.now() - 86400_000).toISOString();
    const [{ data: items }, { data: vals }, { data: posts }] = await Promise.all([
      d.from("items").select("sku").gte("updated_at", since).in("status", ["active", "reserved", "sold"]).limit(2000),
      d.from("valuations").select("slug").gte("created_at", since).eq("is_public", true).limit(2000),
      d.from("posts").select("slug").gte("updated_at", since).not("published_at", "is", null),
    ]);
    const paths = ["/", "/sitemap.xml", "/valued", "/blog", ...(items || []).map((i) => `/item/${i.sku}`), ...(vals || []).map((v) => `/valued/${v.slug}`), ...(posts || []).map((p) => `/blog/${p.slug}`)];
    const { indexNow } = await import("@/lib/indexnow"); await indexNow(paths);
    return { urls_submitted: paths.length };
  } };

const backups: Automation = { key: "backups", name: "Nightly backup", schedule: "daily", sort_order: 90,
  what: "Copies every table to a private storage bucket. Keeps 30 days.",
  why: "If anything ever goes wrong, nothing is lost.",
  async run() { const { runBackup } = await import("@/lib/backup"); const r = await runBackup(); return (r as Result) || { ok: true }; } };

const heldMoney: Automation = { key: "held_money_timers", name: "Held-money timers", schedule: "daily", sort_order: 5,
  what: "Releases payment to the seller 3 days after a shipped item is delivered if the buyer hasn't reported a problem; refunds pickup orders nobody completed within 7 days; applies referral credits to paying Pro subscriptions.",
  why: "Money never gets stuck. Buyers and sellers both know exactly when it moves.",
  async run() { return { note: "runs inside the daily job before the others" }; } };

export const AUTOMATIONS: Automation[] = [heldMoney, welcome, nudges, milestones, reviews, weeklyBlog, priceDrops, comps, feedPing, backups];

/** Make sure every automation is registered (so the Operations page can list and toggle it). */
export async function registerAutomations() {
  const d = db();
  for (const a of AUTOMATIONS) await d.from("automations").upsert({ key: a.key, name: a.name, what: a.what, why: a.why, schedule: a.schedule, sort_order: a.sort_order }, { onConflict: "key", ignoreDuplicates: false });
}

/** Run every enabled automation (skip the ones the daily job already did inline), record results. */
export async function runAutomations(only?: string): Promise<Record<string, Result>> {
  const d = db();
  await registerAutomations();
  const { data: rows } = await d.from("automations").select("key, enabled");
  const enabled = new Map((rows || []).map((r) => [r.key, r.enabled]));
  const out: Record<string, Result> = {};
  for (const a of AUTOMATIONS) {
    if (only && a.key !== only) continue;
    if (!only && a.key === "held_money_timers") continue; // done inline in the daily job
    if (!only && a.key === "backups") continue;            // done inline too
    if (enabled.get(a.key) === false) { out[a.key] = { skipped: "switched off" }; continue; }
    const started = Date.now();
    try { out[a.key] = await a.run(); } catch (e) { out[a.key] = { error: e instanceof Error ? e.message : String(e) }; }
    out[a.key].ms = Date.now() - started;
    await d.from("automations").update({ last_run_at: new Date().toISOString(), last_result: out[a.key] }).eq("key", a.key);
    await d.rpc("bump_automation_runs", { p_key: a.key }).then(() => {}, () => {});
  }
  return out;
}

export { slugify };
