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

export async function sendAutoEmail(to: string, subject: string, text: string, opts: { profile_id?: string | null; kind: string; ref_id?: string | null }) { return send(to, subject, text, opts); }

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
    const { data: hot } = await d.from("items").select("id, sku, title, price, view_count, save_count, owner_id, listed_at, profiles!items_owner_id_fkey(email, full_name, role, marketing_opt_out, stripe_payouts_ready)").eq("status", "active").gte("view_count", 10).order("view_count", { ascending: false }).limit(200);
    for (const it of hot || []) {
      if (left <= 0) break;
      const p = it.profiles as unknown as { email: string | null; full_name: string | null; role: string; marketing_opt_out: boolean; stripe_payouts_ready: boolean };
      if (!p?.email || p.marketing_opt_out || p.role === "admin" || p.role === "staff") continue;
      const { count: msgs } = await d.from("conversations").select("id", { count: "exact", head: true }).eq("item_id", it.id);
      if ((msgs || 0) === 0 && !(await alreadySent(it.owner_id, "nudge_views", it.id))) {
        await send(p.email, `${it.view_count} people looked at "${it.title.slice(0, 50)}"`, `${it.view_count} people have looked at your listing and nobody's asked about it yet. That usually means the price is a little high for what buyers see.\n\nTry dropping it $${Math.max(5, Math.round(Number(it.price) * 0.1))} (about 10%). Open it: ${site()}/app/items/${it.id}\n\nOr set it to drop by itself: on that page, "Drop the price automatically."`, { profile_id: it.owner_id, kind: "nudge_views", ref_id: it.id }); n++; left--;
      } else if ((it.save_count || 0) >= 2 && !(await alreadySent(it.owner_id, "nudge_saves", it.id))) {
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
    // payout setup reminders: day 1, 3 and 5 after signup, for sellers who haven't finished
    const { data: noPay } = await d.from("profiles").select("id, email, full_name, created_at").eq("role", "consignor").eq("stripe_payouts_ready", false).not("email", "is", null).gte("created_at", new Date(Date.now() - 8 * 86400_000).toISOString()).limit(500);
    for (const p of noPay || []) {
      if (left <= 0) break;
      const age = (Date.now() - new Date(p.created_at).getTime()) / 86400_000;
      const step = age >= 5 ? 5 : age >= 3 ? 3 : age >= 1 ? 1 : 0;
      if (!step || await alreadySent(p.id, `payout_setup_${step}`)) continue;
      const first = p.full_name?.split(" ")[0] || "there";
      const subj = step === 1 ? "One step left so you can get paid" : step === 3 ? "Reminder: set up payouts so your sales reach your bank" : "Last reminder: finish payout setup (5 minutes)";
      const body = `Hi ${first},\n\nYour items can sell right now: buyers see Buy now and pay by card. To get that money in your bank, finish payout setup once: name, address, bank account. It's handled by Stripe and takes about 5 minutes.\n\n${site()}/app/money\n\nIf something sells before you finish, we hold your money safely and send it the moment you're done.`;
      await send(p.email, subj, body, { profile_id: p.id, kind: `payout_setup_${step}` }); n++; left--;
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
    const { data: sellers } = await d.from("profiles").select("id, email, full_name, username, referral_code, role, marketing_opt_out, completed_sales").in("role", ["consignor"]).not("email", "is", null).limit(1000);
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
        ["sold_25", total >= 25, "First $25. It's real now.", `Hi ${first},\n\nYou've turned $${Math.round(total)} of stuff that was just sitting there into money in the bank. Small, but it's the proof: this works. Next box: ${site()}/pile`],
        ["sold_50", total >= 50, "$50 sold", `Hi ${first},\n\n$${Math.round(total)} so far. Paste-able, if you want: "Sold $${Math.round(total)} of stuff from my garage this week without writing a single listing. ${site()}"`],
        ["sold_100", total >= 100, "You've sold $100 of stuff", `Hi ${first},\n\nYou've cleared $${Math.round(total)} of things that were just sitting there. Paste-able: "Turned $${Math.round(total)} of stuff I wasn't using into cash this month. ${site()}"`],
        ["sold_500", total >= 500, "$500. That's a real dent.", `Hi ${first},\n\n$${Math.round(total)} sold. That's a car payment, from a pile. Keep going: ${site()}/pile`],
        ["sold_1000", total >= 1000, "$1,000 sold. You're a reseller now.", `Hi ${first},\n\nOver a thousand dollars sold through Next Owner Market. If you haven't yet, the Year page in your app has it all added up for tax time: ${site()}/app/taxes`],
      ];
      for (const [key, hit, subj, body] of checks) {
        if (!hit || left <= 0) continue;
        const { data: have } = await d.from("milestones").select("key").eq("profile_id", p.id).eq("key", key).maybeSingle();
        if (have) continue;
        await d.from("milestones").insert({ profile_id: p.id, key });
        await send(p.email, subj, body + `\n\nInvite a friend who sells: you both get a month of Pro free. Your link: ${site()}/signup?ref=${p.referral_code || ""}`, { profile_id: p.id, kind: `milestone_${key}` }); n++; left--;
        try { const { textSeller } = await import("@/lib/sms"); const { data: sp } = await d.from("profiles").select("sms_gateway, alert_orders").eq("id", p.id).single(); if (sp) await textSeller(sp, "order", `NOM: ${subj}`); } catch { /* optional */ }
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


// ---------------------------------------------------------------- buyer weekly "new near you"
const buyerDigest: Automation = {
  key: "buyer_digest", name: "Weekly 'new near you' for buyers", schedule: "weekly (Thursday)", sort_order: 35,
  what: "Every Thursday, each account with a ZIP gets the newest items within 100 miles (up to 8, with photos), plus one shipped item. Only if something new exists; never twice for the same week.",
  why: "Thursday evening is when people shop for the weekend. Buyers who get a weekly nudge come back; buyers who don't, forget the site exists.",
  async run() {
    const d = db(); const day = new Date().getUTCDay(); if (day !== 4 && process.env.FORCE_DIGEST !== "1") return { skipped: "not Thursday" };
    let left = await budget(); let n = 0;
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: people } = await d.from("profiles").select("id, email, full_name, zip, lat, lng, marketing_opt_out").not("email", "is", null).not("lat", "is", null).limit(2000);
    const { data: fresh } = await d.from("items").select("sku, title, price, lat, lng, city, state, shipping_ok, item_photos(url, is_primary)").eq("status", "active").gte("listed_at", since).not("lat", "is", null).limit(500);
    if (!fresh?.length) return { skipped: "nothing new this week" };
    const { milesBetween } = await import("@/lib/geo");
    for (const p of people || []) {
      if (left <= 0) break;
      if (p.marketing_opt_out) continue;
      const weekKey = `digest_${new Date().toISOString().slice(0, 10)}`;
      if (await alreadySent(p.id, "buyer_digest", null)) { const { data: last } = await d.from("email_log").select("sent_at").eq("profile_id", p.id).eq("kind", "buyer_digest").order("sent_at", { ascending: false }).limit(1).maybeSingle(); if (last && Date.now() - new Date(last.sent_at).getTime() < 6 * 86400_000) continue; }
      const near = fresh.map((i) => ({ i, mi: milesBetween(Number(p.lat), Number(p.lng), Number(i.lat), Number(i.lng)) })).filter((x) => x.mi <= 100).sort((a, b) => a.mi - b.mi).slice(0, 8);
      const ships = fresh.filter((i) => i.shipping_ok && !near.some((x) => x.i.sku === i.sku)).slice(0, 2);
      if (!near.length && !ships.length) continue;
      const lines = [...near.map((x) => `• ${x.i.title} — $${Math.round(Number(x.i.price))} · ${Math.round(x.mi)} mi (${x.i.city}, ${x.i.state})\n  ${site()}/item/${x.i.sku}`), ...ships.map((i) => `• ${i.title} — $${Math.round(Number(i.price))} · ships\n  ${site()}/item/${i.sku}`)];
      await send(p.email, `New near ${p.zip}: ${near[0]?.i.title?.slice(0, 40) || ships[0]?.title?.slice(0, 40)}${lines.length > 1 ? ` and ${lines.length - 1} more` : ""}`, `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nNew this week near you:\n\n${lines.join("\n\n")}\n\nEverything: ${site()}/?zip=${p.zip}\n\nPay by card; your money's held until you have it.`, { profile_id: p.id, kind: "buyer_digest" }); n++; left--; void weekKey;
    }
    return { emails_sent: n, budget_left: left };
  },
};

// ---------------------------------------------------------------- seller weekly report
const sellerReport: Automation = {
  key: "seller_report", name: "Seller weekly report", schedule: "weekly (Monday)", sort_order: 36,
  what: "Every Monday, each seller with live items gets their week: views, saves, messages, offers, sales and money, plus the one thing to do next (drop a price, answer a message, list the drafts).",
  why: "A seller who sees '84 people looked at your stuff this week' opens the app. It's the habit loop.",
  async run() {
    const d = db(); const day = new Date().getUTCDay(); if (day !== 1 && process.env.FORCE_DIGEST !== "1") return { skipped: "not Monday" };
    let left = await budget(); let n = 0; const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: sellers } = await d.from("profiles").select("id, email, full_name, marketing_opt_out").in("role", ["consignor"]).not("email", "is", null).limit(2000);
    for (const p of sellers || []) {
      if (left <= 0) break; if (p.marketing_opt_out) continue;
      const { data: items } = await d.from("items").select("id, title, view_count, save_count, status").eq("owner_id", p.id).in("status", ["active", "reserved", "draft"]);
      const live = (items || []).filter((i) => i.status !== "draft"); if (!live.length) continue;
      const { data: last } = await d.from("email_log").select("sent_at").eq("profile_id", p.id).eq("kind", "seller_report").order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.sent_at).getTime() < 6 * 86400_000) continue;
      const [{ count: msgs }, { count: offers }, { data: sold }] = await Promise.all([
        d.from("conversations").select("id", { count: "exact", head: true }).eq("seller_profile_id", p.id).gte("last_message_at", since),
        d.from("offers").select("id", { count: "exact", head: true }).eq("seller_id", p.id).gte("created_at", since),
        d.from("orders").select("amount").eq("seller_id", p.id).in("status", ["paid", "released"]).gte("paid_at", since),
      ]);
      const views = live.reduce((a, i) => a + (i.view_count || 0), 0), saves = live.reduce((a, i) => a + (i.save_count || 0), 0);
      const money = (sold || []).reduce((a, o) => a + Number(o.amount), 0);
      const drafts = (items || []).filter((i) => i.status === "draft").length;
      const top = [...live].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
      const next = (msgs || 0) > 0 ? `Answer your ${msgs} message${msgs === 1 ? "" : "s"}: ${site()}/app/inbox` : drafts > 0 ? `List your ${drafts} draft${drafts === 1 ? "" : "s"}: ${site()}/app?status=draft` : top && (top.view_count || 0) >= 10 ? `"${top.title.slice(0, 40)}" is getting looks; try a small price drop: ${site()}/app/items/${top.id}` : `Do the next box: ${site()}/pile`;
      await send(p.email, `Your week: ${views} views, ${sold?.length || 0} sale${(sold?.length || 0) === 1 ? "" : "s"}`, `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nYour ${live.length} live item${live.length === 1 ? "" : "s"} this week:\n• ${views} views (all time)\n• ${saves} saved\n• ${msgs || 0} message${(msgs || 0) === 1 ? "" : "s"}, ${offers || 0} offer${(offers || 0) === 1 ? "" : "s"}\n• ${sold?.length || 0} sold, $${Math.round(money)}\n\nOne thing to do: ${next}`, { profile_id: p.id, kind: "seller_report" }); n++; left--;
    }
    return { emails_sent: n, budget_left: left };
  },
};

// ---------------------------------------------------------------- win-back + Pro offer
const winback: Automation = {
  key: "winback_and_pro", name: "Win-back at 30 days quiet; Pro offer when free credits run out", schedule: "daily", sort_order: 37,
  what: "Two emails. (1) A seller who hasn't signed in for 30 days gets one 'your items are still here' note with their live count. (2) The day someone uses their last free AI lookup, one email explaining exactly what Pro gives for $15. Each once.",
  why: "Quiet users are the cheapest ones to bring back. And the moment the free credits end is the moment Pro makes sense; later it's forgotten.",
  async run() {
    const d = db(); let left = await budget(); let n = 0;
    const { data: quiet } = await d.from("profiles").select("id, email, full_name, marketing_opt_out, last_seen_at, created_at").in("role", ["consignor"]).not("email", "is", null).lt("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()).limit(1000);
    for (const p of quiet || []) {
      if (left <= 0) break; if (p.marketing_opt_out) continue;
      const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : new Date(p.created_at).getTime();
      if (Date.now() - seen < 30 * 86400_000) continue;
      if (await alreadySent(p.id, "winback_30")) continue;
      const { count: live } = await d.from("items").select("id", { count: "exact", head: true }).eq("owner_id", p.id).eq("status", "active");
      await send(p.email, live ? `Your ${live} item${live === 1 ? "" : "s"} are still listed` : "Still have that pile?", live ? `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nIt's been a month. Your ${live} item${live === 1 ? " is" : "s are"} still live and buyers are still seeing ${live === 1 ? "it" : "them"}. Two minutes in the app keeps ${live === 1 ? "it" : "them"} fresh: check messages, drop a price, add a photo. ${site()}/app` : `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nA month ago you signed up to deal with some stuff. If it's still there, the smallest start is one photo: ${site()}/worth. No pressure; it'll be here.`, { profile_id: p.id, kind: "winback_30" }); n++; left--;
    }
    const { data: zero } = await d.from("profiles").select("id, email, full_name, marketing_opt_out, plan, role").eq("ai_credits", 0).eq("plan", "free").not("email", "is", null).limit(500);
    for (const p of zero || []) {
      if (left <= 0) break; if (p.marketing_opt_out || p.role === "admin" || p.role === "staff") continue;
      if (await alreadySent(p.id, "pro_offer")) continue;
      await send(p.email, "You used your free lookups. Here's what Pro is.", `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nYou've used the three free AI lookups, which means you've got the hang of it. Pro is $15 a month and gets you:\n\n• Unlimited What's it worth?, Sort the pile, Buy or pass, and AI-written listings\n• Copy-and-paste versions for all nine marketplaces (eBay, Poshmark, Mercari, OfferUp, Craigslist, Vinted, Depop, Etsy, plus Facebook which is free for everyone)\n• Video on listings; unlimited live listings\n\nListing in the store stays free on any plan. Cancel any time. ${site()}/pro\n\nIf you'd rather keep going free, you still can: write listings yourself, and Facebook copy is always included.`, { profile_id: p.id, kind: "pro_offer" }); n++; left--;
    }
    return { emails_sent: n, budget_left: left };
  },
};

// ---------------------------------------------------------------- Facebook Page auto-post
const facebookPage: Automation = {
  key: "facebook_page", name: "Post to the Facebook Page", schedule: "daily", sort_order: 55,
  what: "If a Facebook Page token is set (Operations → Outside the site → Facebook Page), posts up to 3 new items a day (photo, price, link) and the weekly blog post to the Page. Nothing is posted twice.",
  why: "The Page is the top of the local funnel. Posting by hand every day is the first thing that stops happening.",
  async run() {
    const d = db();
    const [{ data: row }, { data: bizRow }] = await Promise.all([d.from("settings").select("value").eq("key", "facebook").maybeSingle(), d.from("settings").select("value").eq("key", "business").maybeSingle()]);
    const biz = (bizRow?.value as { facebook_page_id?: string; facebook_page_token?: string }) || {};
    const cfg = { ...((row?.value as { posted?: string[] }) || {}), page_id: biz.facebook_page_id, page_token: biz.facebook_page_token };
    if (!cfg.page_id || !cfg.page_token) return { skipped: "no Facebook Page token set (Settings)" };
    const posted = new Set(cfg.posted || []);
    const { data: fresh } = await d.from("items").select("sku, title, price, city, state, item_photos(url, is_primary)").eq("status", "active").order("listed_at", { ascending: false }).limit(20);
    let n = 0; const errors: string[] = [];
    for (const i of fresh || []) {
      if (n >= 3) break; if (posted.has(i.sku)) continue;
      const ph = (i.item_photos as { url: string; is_primary: boolean }[]) || []; const photo = (ph.find((p) => p.is_primary) || ph[0])?.url;
      const msg = `${i.title} — $${Math.round(Number(i.price))}${i.city ? ` · ${i.city}, ${i.state}` : ""}\nPay by card, money held until you have it.\n${site()}/item/${i.sku}`;
      try {
        const r = await fetch(`https://graph.facebook.com/v19.0/${cfg.page_id}/${photo ? "photos" : "feed"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(photo ? { url: photo, caption: msg, access_token: cfg.page_token } : { message: msg, access_token: cfg.page_token }) });
        if (r.ok) { posted.add(i.sku); n++; } else errors.push(`${i.sku}: ${(await r.text()).slice(0, 120)}`);
      } catch (e) { errors.push(String(e)); }
    }
    const { data: post } = await d.from("posts").select("slug, title").not("published_at", "is", null).order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (post && !posted.has(`post:${post.slug}`)) {
      try { const r = await fetch(`https://graph.facebook.com/v19.0/${cfg.page_id}/feed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `${post.title}\n${site()}/blog/${post.slug}`, access_token: cfg.page_token }) }); if (r.ok) posted.add(`post:${post.slug}`); else errors.push("post: " + (await r.text()).slice(0, 120)); } catch (e) { errors.push(String(e)); }
    }
    await d.from("settings").upsert({ key: "facebook", value: { posted: [...posted].slice(-500) } });
    return { items_posted: n, errors: errors.slice(0, 3) };
  },
};

// ---------------------------------------------------------------- health checks + integrations status
const health: Automation = {
  key: "health", name: "Health check of every outside service", schedule: "daily", sort_order: 1,
  what: "Tests each key and feed the site depends on: Stripe, Resend (email), Anthropic (AI), Shippo (labels), Facebook Page, sitemap, Google feed, IndexNow key file. Writes OK / missing / error next to each on the Operations page and emails staff if something that was working breaks.",
  why: "If email silently stops or the AI key expires, nobody notices until a customer complains. This notices first.",
  async run() {
    const d = db(); const out: Record<string, string> = {}; const s = site();
    const set = async (key: string, status: string, note?: string) => { out[key] = status; await d.from("integrations").update({ status, status_note: note || null, checked_at: new Date().toISOString() }).eq("key", key); };
    await set("stripe", process.env.STRIPE_SECRET_KEY ? "ok" : "missing", process.env.STRIPE_SECRET_KEY ? "key present" : "STRIPE_SECRET_KEY not set");
    await set("anthropic", process.env.ANTHROPIC_API_KEY ? "ok" : "missing");
    await set("shippo", process.env.SHIPPO_API_KEY ? "ok" : "missing", process.env.SHIPPO_API_KEY ? "live rates and labels on" : "built-in estimate in use; labels can't be bought in-app until the key is added");
    if (process.env.RESEND_API_KEY) { try { const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } }); await set("resend", r.ok ? "ok" : "error", r.ok ? "email service answering" : `HTTP ${r.status}`); } catch (e) { await set("resend", "error", String(e)); } } else await set("resend", "missing");
    const { data: fb } = await d.from("settings").select("value").eq("key", "business").maybeSingle(); const cfg = (fb?.value as { facebook_page_token?: string; facebook_page_id?: string }) || {};
    if (cfg.facebook_page_token && cfg.facebook_page_id) { try { const r = await fetch(`https://graph.facebook.com/v19.0/${cfg.facebook_page_id}?fields=name&access_token=${encodeURIComponent(cfg.facebook_page_token)}`, { signal: AbortSignal.timeout(10000) }); await set("facebook", r.ok ? "ok" : "error", r.ok ? "auto-posting on" : "token rejected; repeat the Connect the Facebook Page steps"); } catch (e) { await set("facebook", "error", String(e).slice(0, 80)); } } else await set("facebook", "manual", "no Page token; posting is by hand");
    for (const [key, path] of [["sitemap", "/sitemap.xml"], ["google_feed", "/feed/google.xml"]] as const) { try { const r = await fetch(s + path, { signal: AbortSignal.timeout(15000) }); await set(key, r.ok ? "ok" : "error", r.ok ? `${Math.round(Number(r.headers.get("content-length") || 0) / 1024)} KB` : `HTTP ${r.status}`); } catch (e) { await set(key, "error", String(e).slice(0, 100)); } }
    try { const { INDEXNOW_KEY } = await import("@/lib/indexnow"); const r = await fetch(`${s}/${INDEXNOW_KEY}.txt`, { signal: AbortSignal.timeout(10000) }); await set("indexnow", r.ok ? "ok" : "error"); } catch { await set("indexnow", "error"); }
    for (const k of ["search_console", "merchant_center", "business_profile", "bing", "vercel", "supabase", "github", "reddit", "producthunt", "creators"]) await d.from("integrations").update({ checked_at: new Date().toISOString() }).eq("key", k).eq("status", "manual");
    const broken = Object.entries(out).filter(([, v]) => v === "error").map(([k]) => k);
    if (broken.length) { try { const { alertStaff } = await import("@/lib/alert"); await alertStaff("Something outside the site is broken", `Health check failed: ${broken.join(", ")}. See Operations → Outside the site.`, "/app/ops"); } catch { /* ok */ } }
    return out;
  },
};

// ---------------------------------------------------------------- weekly ops digest to staff
const opsDigest: Automation = {
  key: "ops_digest", name: "Weekly Operations digest to staff", schedule: "weekly (Monday)", sort_order: 95,
  what: "Every Monday, the owner (and the alert address) gets the week's numbers, what every automation did, anything unhealthy, and the human tasks that are due, in one email.",
  why: "So nobody has to remember to go look. If the email says 'all fine,' it's all fine.",
  async run() {
    const d = db(); const day = new Date().getUTCDay(); if (day !== 1 && process.env.FORCE_DIGEST !== "1") return { skipped: "not Monday" };
    const { data: biz } = await d.from("settings").select("value").eq("key", "business").maybeSingle();
    const b = (biz?.value as { alert_to?: string; contact_email?: string }) || {};
    const to = (b.alert_to || b.contact_email || "").split(",").map((x) => x.trim()).filter((x) => x.includes("@"));
    if (!to.length) return { skipped: "no alert email set in Settings" };
    const { data: stats } = await d.rpc("ops_stats").then((r) => r, () => ({ data: null }));
    const st = (stats as Record<string, number>) || {};
    const { data: autos } = await d.from("automations").select("name, enabled, last_run_at, last_result").order("sort_order");
    const { data: ints } = await d.from("integrations").select("name, status, status_note").neq("status", "ok").neq("status", "manual");
    const { data: tasks } = await d.from("ops_tasks").select("title, frequency, done_at").order("sort_order");
    const due = (tasks || []).filter((t) => !t.done_at || (t.frequency === "weekly" && Date.now() - new Date(t.done_at).getTime() > 6 * 86400_000) || (t.frequency === "monthly" && Date.now() - new Date(t.done_at).getTime() > 28 * 86400_000));
    const text = `Next Owner Market, week of ${new Date().toLocaleDateString()}\n\nNUMBERS\n• New accounts this week: ${st.signups_7d ?? 0} (total ${st.signups_total ?? 0})\n• Listed this week: ${st.items_7d ?? 0} (live now ${st.items_live ?? 0})\n• Sold last 30 days: $${Math.round(st.gmv_30d ?? 0)} · our cut $${Math.round(st.commission_30d ?? 0)}\n• Paying Pro: ${st.pro_paying ?? 0} · sellers with payouts: ${st.sellers_with_payouts ?? 0} of ${st.sellers ?? 0}\n• Waiting on you: ${st.pending_review ?? 0} listings to approve, ${st.pending_sellers ?? 0} sellers, ${st.disputes_open ?? 0} problems, ${st.reports_open ?? 0} reports\n• Public valuations: ${st.valuations_public ?? 0} · automatic emails sent: ${st.emails_7d ?? 0}\n\nWHAT RAN BY ITSELF\n${(autos || []).map((a) => `• ${a.enabled ? "✓" : "○"} ${a.name}: ${a.last_result ? Object.entries(a.last_result).filter(([k]) => k !== "ms").map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ") : "not yet"}`).join("\n")}\n\n${ints?.length ? `NEEDS ATTENTION\n${ints.map((i) => `• ${i.name}: ${i.status}${i.status_note ? ` (${i.status_note})` : ""}`).join("\n")}\n\n` : "HEALTH: everything answering.\n\n"}HUMAN TASKS DUE\n${due.length ? due.map((t) => `• ${t.title} (${t.frequency})`).join("\n") : "• none"}\n\nOperations page: ${site()}/app/ops`;
    let n = 0; for (const t of to) { if (await send(t, `Next Owner Market: week of ${new Date().toLocaleDateString()}`, text, { kind: "ops_digest" })) n++; }
    return { emails_sent: n, tasks_due: due.length };
  },
};


// ---------------------------------------------------------------- payouts-ready callback
const payoutsReady: Automation = {
  key: "payouts_ready_notice", name: "Tell sellers when payout setup opens", schedule: "daily", sort_order: 6,
  what: "If anyone tried Set up payouts and got the 'opening soon' message, this checks each morning whether Stripe Connect is working now (by creating and deleting a test account). The moment it is, every one of those sellers gets one email: 'Payouts are open, here's the button.'",
  why: "The first thing a new seller hits must not be a dead end. This closes the loop without anyone remembering who was waiting.",
  async run() {
    const d = db();
    const { data: waiting } = await d.from("profiles").select("id, email, full_name").not("payout_setup_requested_at", "is", null).eq("stripe_payouts_ready", false).is("stripe_account_id", null).not("email", "is", null);
    if (!process.env.STRIPE_SECRET_KEY) return { stripe_connect: "no Stripe key set", waiting: waiting?.length || 0 };
    const { stripe } = await import("@/lib/stripe");
    try { const a = await stripe().accounts.create({ type: "express", capabilities: { transfers: { requested: true } }, metadata: { probe: "1" } }); await stripe().accounts.del(a.id); }
    catch (e) { return { stripe_connect: "BLOCKED: " + (e instanceof Error ? e.message : String(e)).slice(0, 140), waiting: waiting?.length || 0 }; }
    if (!waiting?.length) return { stripe_connect: "working: sellers can set up payouts now", waiting: 0 };
    let n = 0; let left = await budget();
    for (const p of waiting) {
      if (left <= 0) break;
      if (await alreadySent(p.id, "payouts_open")) continue;
      await send(p.email, "Payouts are open: set yours up (2 minutes)", `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nYou tried to set up payouts and it wasn't ready yet. It is now.\n\nPayouts → Set up payouts: ${site()}/app/money\n\nName, address, bank account, done. After that, buyers see Buy now on your items and every sale lands in your bank on its own. Sorry for the wait.`, { profile_id: p.id, kind: "payouts_open" }); n++; left--;
      await d.from("profiles").update({ payout_setup_requested_at: null }).eq("id", p.id);
    }
    return { stripe_connect: "working: sellers can set up payouts now", waiting: waiting.length, emails_sent: n };
  },
};

const heldPayouts: Automation = {
  key: "held_payouts", name: "Send held seller money", schedule: "daily", sort_order: 7,
  what: "When a seller sells before setting up payouts, their money is held. Each morning this sends everything owed to sellers who have finished setup, reminds the rest every 3 days how much is waiting, and tells staff about anything held 60+ days.",
  why: "Every listing can take Buy now from day one. The seller's money waits safely, and a 'You have $55 waiting' email is the best reason there is to finish payout setup.",
  async run() {
    const d = db();
    const { data: owed } = await d.from("orders").select("id, seller_id, seller_due, payout_pending_since").eq("payout_pending", true).limit(1000);
    if (!owed?.length) return { held_orders: 0 };
    const { payPendingFor } = await import("@/lib/orders");
    const bySeller = new Map<string, { total: number; oldest: string }>();
    for (const o of owed) { const g = bySeller.get(o.seller_id) || { total: 0, oldest: o.payout_pending_since || new Date().toISOString() }; g.total += Number(o.seller_due || 0); if ((o.payout_pending_since || "") < g.oldest) g.oldest = o.payout_pending_since || g.oldest; bySeller.set(o.seller_id, g); }
    let sentSellers = 0, sentTotal = 0, reminded = 0; const old: string[] = []; let left = await budget();
    for (const [sid, g] of bySeller) {
      const r = await payPendingFor(sid);
      if (r.paid) {
        sentSellers++; sentTotal += r.total;
        const { data: p } = await d.from("profiles").select("email, full_name").eq("id", sid).single();
        if (p?.email && left > 0) { await send(p.email, `$${r.total.toFixed(2)} is on its way to your bank`, `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nPayouts are set up, so the money we were holding for you, $${r.total.toFixed(2)}, has been sent. It usually reaches your bank in 2 business days.\n\nFrom now on every sale goes straight through.`, { profile_id: sid, kind: "payout_sent" }); left--; }
        continue;
      }
      const days = (Date.now() - new Date(g.oldest).getTime()) / 86400_000;
      if (days >= 60) old.push(`${sid}: $${g.total.toFixed(2)}, ${Math.floor(days)} days`);
      const { data: last } = await d.from("email_log").select("sent_at").eq("profile_id", sid).in("kind", ["payout_waiting", "payout_waiting_reminder"]).order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (left > 0 && (!last || Date.now() - new Date(last.sent_at).getTime() >= 3 * 86400_000)) {
        const { data: p } = await d.from("profiles").select("email, full_name").eq("id", sid).single();
        if (p?.email) { await send(p.email, `$${g.total.toFixed(2)} is waiting for you`, `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nYou've sold items on Next Owner Market and $${g.total.toFixed(2)} is being held for you. We can't send it until payouts are set up.\n\nIt takes about 5 minutes: ${site()}/app/money\n\nThe moment you finish, it's sent to your bank automatically.`, { profile_id: sid, kind: "payout_waiting_reminder" }); reminded++; left--; }
      }
    }
    if (old.length) { const { alertStaff } = await import("@/lib/alert"); await alertStaff("Seller money held 60+ days", `These sellers sold but never set up payouts. Decide: keep reminding, contact them, or refund. ${old.join("; ")}`, "/app/ops"); }
    return { held_orders: owed.length, sellers_owed: bySeller.size, sent_to: sentSellers, sent_total: Math.round(sentTotal * 100) / 100, reminders: reminded, held_60_days: old.length };
  },
};

export const AUTOMATIONS: Automation[] = [health, heldMoney, payoutsReady, heldPayouts, welcome, nudges, milestones, buyerDigest, sellerReport, winback, reviews, weeklyBlog, facebookPage, priceDrops, comps, feedPing, opsDigest, backups];

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

/** Sample text of every automatic email, so a new person knows what customers receive. */
export const EMAIL_SAMPLES: { kind: string; when: string; subject: string; body: string }[] = [
  { kind: "Welcome day 1", when: "1 day after sign-up", subject: "Start with one box", body: "Welcome to Next Owner Market. Here's the only tip that matters: don't look at the whole pile. Pick one box. Photograph it, go to /pile, tap Sort it…" },
  { kind: "Welcome day 3", when: "3 days after sign-up, if nothing listed", subject: "What's the first thing you'd sell worth?", body: "Think of the first thing you'd get rid of if it were easy… Take one photo and open /worth. Thirty seconds later you'll know what it's worth…" },
  { kind: "Welcome day 7", when: "7 days after sign-up", subject: "Two things that sell your items faster / The smallest possible start", body: "Copy them to Facebook Marketplace… make sure payouts are set up… (or, if nothing listed) one item, one photo, /worth. You don't have to sell it. Just see the number." },
  { kind: "Nudge: views, no messages", when: "10+ views, 0 messages, once per item", subject: "N people looked at \"your item\"", body: "N people have looked at your listing and nobody's asked about it yet. That usually means the price is a little high… Try dropping it $X (about 10%)." },
  { kind: "Nudge: saves", when: "2+ saves, once per item", subject: "N people saved your item", body: "N buyers have saved your listing. They're waiting for something: usually a small price drop. When you lower the price, every one of them gets an email about it." },
  { kind: "Nudge: drafts", when: "drafts older than 3 days, at most every 2 weeks", subject: "N drafts waiting to go live", body: "You've got N listings written and sitting in Drafts. They can't sell from there. Open My items → Drafts, give each a quick read, tap List it." },
  { kind: "Nudge: payouts", when: "live listing but no payouts, at most weekly", subject: "Buyers can't hit Buy on your items yet", body: "Until payouts are set up, buyers only see 'Message the seller' instead of Buy now. It's five minutes: name, address, bank account…" },
  { kind: "Milestones", when: "first listing · 10 listings · first sale · third sale · $25 · $50 · $100 · $500 · $1,000, each once (+ a text if they turned texts on)", subject: "e.g. You made your first sale 🎉", body: "First sale done and paid… Here's a line you can paste: 'Sold my first thing on Next Owner Market…' Invite a friend who sells: you both get a month of Pro free." },
  { kind: "Review request", when: "1 day after an order completes, both sides", subject: "How did it go?", body: "Your order is complete. One tap to rate the other person… Ratings show on profiles so the next buyer or seller knows who they're dealing with." },
  { kind: "Buyer weekly digest", when: "Thursdays, accounts with a ZIP, if there's something new within 100 miles", subject: "New near 23220: …", body: "New this week near you: • item — $ · 12 mi … Everything: /?zip=…" },
  { kind: "Seller weekly report", when: "Mondays, sellers with live items", subject: "Your week: 84 views, 1 sale", body: "Your 6 live items this week: views, saved, messages, offers, sold… One thing to do: …" },
  { kind: "Win-back", when: "30 days without signing in, once", subject: "Your N items are still listed / Still have that pile?", body: "It's been a month… Two minutes in the app keeps them fresh." },
  { kind: "Pro offer", when: "the day free credits hit zero, once", subject: "You used your free lookups. Here's what Pro is.", body: "Pro is $15 a month: unlimited lookups and listings, all nine marketplaces, video… Listing stays free on any plan." },
  { kind: "Price drop", when: "an item someone saved gets cheaper", subject: "Price drop: item", body: "Dropped from $X to $Y. Grab it before someone else does." },
  { kind: "Order emails (always sent)", when: "payment, shipping, problems", subject: "Order confirmed / You made a sale / etc.", body: "Transactional; not affected by the tips opt-out." },
  { kind: "Staff digest", when: "Mondays, to the alert address", subject: "Next Owner Market: week of …", body: "Numbers, what ran, what's broken, human tasks due." },
];
