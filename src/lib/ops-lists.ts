import { createClient as createAdmin } from "@supabase/supabase-js";

/** Behind every number on the Operations page: the actual people and things it counts. Staff-only (caller checks). */
type Row = { line: string; href?: string };
const d = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "");
const $ = (n?: number | null) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
type P = { id: string; email: string | null; full_name: string | null; username: string | null; role: string; plan: string | null; comped: boolean | null; approved: boolean | null; stripe_payouts_ready: boolean | null; created_at: string; city: string | null; state: string | null };
const who = (p: Partial<P> | null | undefined) => (p ? [p.full_name, p.username ? `@${p.username}` : null, p.email].filter(Boolean).join(" · ") : "?");

export async function opsLists(): Promise<Record<string, Row[]>> {
  const db = d();
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const month = new Date(Date.now() - 30 * 86400_000).toISOString();
  const pcols = "id, email, full_name, username, role, plan, comped, approved, stripe_payouts_ready, created_at, city, state";
  const icols = "id, sku, title, price, status, created_at, view_count, owner:profiles!items_owner_id_fkey(full_name, username, email)";
  const ocols = "id, amount, status, paid_at, released_at, commission_amount, item_id, buyer_id";
  const [profiles, items, orders, disputes, vals, piles, bps, posts, threads, reports, subs, emails, favs, invites] = await Promise.all([
    db.from("profiles").select(pcols).order("created_at", { ascending: false }).limit(1000),
    db.from("items").select(icols).neq("status", "archived").order("created_at", { ascending: false }).limit(1000),
    db.from("orders").select(ocols).in("status", ["paid", "released", "disputed"]).order("paid_at", { ascending: false }).limit(500),
    db.from("disputes").select("id, reason, created_at, order_id").eq("status", "open").limit(200),
    db.from("valuations").select("slug, title, created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(300),
    db.from("pile_scans").select("created_at, name, owner_id, total_low, total_high").order("created_at", { ascending: false }).limit(300),
    db.from("buy_pass_scans").select("created_at, what, verdict, paid, owner_id").order("created_at", { ascending: false }).limit(300),
    db.from("posts").select("slug, title, published_at").not("published_at", "is", null).order("published_at", { ascending: false }).limit(300),
    db.from("threads").select("id, title, created_at").eq("hidden", false).order("created_at", { ascending: false }).limit(300),
    db.from("reports").select("id, reason, kind, target_id, created_at").is("handled_at", null).limit(200),
    db.from("subscribers").select("email, name, source, created_at").eq("unsubscribed", false).not("email", "is", null).order("created_at", { ascending: false }).limit(1000),
    db.from("email_log").select("to_email, kind, subject, sent_at, ok").gte("sent_at", week).order("sent_at", { ascending: false }).limit(500),
    db.from("favorites").select("created_at, item_id, profile_id").order("created_at", { ascending: false }).limit(500),
    db.from("invites").select("code, uses, label, created_at").gt("uses", 0).limit(200),
  ]);
  const P = (profiles.data || []) as unknown as P[];
  const prow = (p: P) => ({ line: `${who(p)} · ${p.role === "consignor" ? "seller" : p.role}${p.plan === "pro" ? (p.comped ? " · free Pro" : " · Pro") : ""}${p.city ? ` · ${p.city}, ${p.state || ""}` : ""} · joined ${day(p.created_at)}`, href: "/app/people" });
  type I = { id: string; sku: string; title: string; price: number; status: string; created_at: string; view_count: number | null; owner: Partial<P> | null };
  const I = (items.data || []) as unknown as I[];
  const irow = (i: I) => ({ line: `${i.title} · ${$(i.price)} · ${i.status.replace("_", " ")} · ${who(i.owner)} · ${day(i.created_at)}${i.view_count ? ` · ${i.view_count} views` : ""}`, href: `/app/items/${i.id}` });
  const pById = new Map(P.map((p) => [p.id, p])); const iById = new Map(I.map((i) => [i.id, i]));
  type O = { id: string; amount: number; status: string; paid_at: string | null; released_at: string | null; commission_amount: number | null; item_id: string | null; buyer_id: string | null };
  const O = (orders.data || []) as unknown as O[];
  const orow = (o: O) => ({ line: `${iById.get(o.item_id || "")?.title || "item"} · ${$(o.amount)} · ${o.status} · buyer ${who(pById.get(o.buyer_id || ""))} · ${day(o.paid_at)}${o.commission_amount ? ` · our cut ${$(o.commission_amount)}` : ""}`, href: `/account/orders/${o.id}` });
  const sellers = P.filter((p) => ["consignor", "admin", "staff"].includes(p.role));
  const src: Record<string, string> = { signup: "made an account", store: "store signup box", message: "messaged a seller", pickup: "booked a pickup" };
  return {
    signups_total: P.map(prow),
    signups_7d: P.filter((p) => p.created_at > week).map(prow),
    sellers: sellers.map(prow),
    sellers_with_payouts: P.filter((p) => p.stripe_payouts_ready).map(prow),
    pro: P.filter((p) => p.plan === "pro").map(prow),
    pro_paying: P.filter((p) => p.plan === "pro" && !p.comped).map(prow),
    pending_sellers: P.filter((p) => p.role === "consignor" && !p.approved).map(prow),
    items_live: I.filter((i) => ["active", "reserved"].includes(i.status)).map(irow),
    items_7d: I.filter((i) => i.created_at > week).map(irow),
    drafts: I.filter((i) => ["draft", "pending_review"].includes(i.status)).map(irow),
    pending_review: I.filter((i) => i.status === "pending_review").map(irow),
    views_7d: [...I].filter((i) => i.view_count).sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).map(irow),
    orders_paid: O.map(orow),
    orders_open: O.filter((o) => ["paid", "disputed"].includes(o.status)).map(orow),
    gmv: O.filter((o) => o.status !== "disputed").map(orow),
    gmv_30d: O.filter((o) => o.status !== "disputed" && (o.paid_at || "") > month).map(orow),
    commission_30d: O.filter((o) => o.status === "released" && (o.released_at || "") > month).map(orow),
    disputes_open: (disputes.data || []).map((x) => ({ line: `${x.reason || "problem"} · opened ${day(x.created_at)}`, href: `/account/orders/${x.order_id}` })),
    valuations_public: (vals.data || []).map((v) => ({ line: `${v.title} · ${day(v.created_at)}`, href: `/valued/${v.slug}` })),
    pile_scans: (piles.data || []).map((x) => ({ line: `${x.name || "pile"} · worth ${$(x.total_low)}–${$(x.total_high)} · ${who(pById.get(x.owner_id))} · ${day(x.created_at)}` })),
    buypass_scans: (bps.data || []).map((x) => ({ line: `${x.what || "item"} · ${x.verdict || ""}${x.paid != null ? ` · asking ${$(x.paid)}` : ""} · ${who(pById.get(x.owner_id))} · ${day(x.created_at)}` })),
    posts_live: (posts.data || []).map((x) => ({ line: `${x.title} · ${day(x.published_at)}`, href: `/blog/${x.slug}` })),
    threads: (threads.data || []).map((x) => ({ line: `${x.title} · ${day(x.created_at)}`, href: `/community/${x.id}` })),
    reports_open: (reports.data || []).map((x) => ({ line: `${x.kind || "post"} · ${x.reason || "flagged"} · ${day(x.created_at)}`, href: x.kind === "thread" ? `/community/${x.target_id}` : undefined })),
    subscribers: (subs.data || []).map((s) => ({ line: `${s.email}${s.name ? ` · ${s.name}` : ""} · ${src[s.source || ""] || s.source || ""} · ${day(s.created_at)}` })),
    emails_7d: (emails.data || []).map((e) => ({ line: `${day(e.sent_at)} · ${e.to_email} · ${e.subject || e.kind}${e.ok === false ? " · FAILED" : ""}` })),
    favorites: (favs.data || []).map((x) => ({ line: `${iById.get(x.item_id)?.title || "item"} · saved by ${who(pById.get(x.profile_id))} · ${day(x.created_at)}`, href: `/app/items/${x.item_id}` })),
    invites_used: (invites.data || []).map((x) => ({ line: `${x.code} · used ${x.uses}×${x.label ? ` · ${x.label}` : ""}` })),
  };
}
