import Link from "next/link";
import NavLink from "./NavLink";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";
import { Wordmark } from "@/components/Logo";
import { ScreenHint } from "@/components/Help";

/** Today and 3 days out, as YYYY-MM-DD in Eastern time (for the to-do badge). */
function nyDays() {
  const f = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const now = Date.now();
  return { today: f(now), soon: f(now + 3 * 86400_000) };
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "buyer") redirect("/account");
  const staff = profile.role === "admin" || profile.role === "staff";
  let unread = 0;
  const supabase = await createClient();
  if (staff) {
    const { count } = await supabase.from("conversations").select("id", { count: "exact", head: true }).eq("unread_for_staff", true).neq("status", "closed");
    unread = count || 0;
  } else {
    const { count } = await supabase.from("conversations").select("id", { count: "exact", head: true }).eq("seller_profile_id", profile.id).eq("unread_for_seller", true).neq("status", "closed");
    unread = count || 0;
  }
  let pendingPeople = 0, pendingReview = 0, todoNow = 0, newFeedback = 0;
  if (staff) {
    const { today, soon } = nyDays();
    const { data: td } = await supabase.from("todos").select("priority, due_date, snooze_until").is("done_at", null);
    todoNow = (td || []).filter((t) => !(t.snooze_until && t.snooze_until > today) && (t.priority === "urgent" || (t.due_date && t.due_date <= soon))).length;
    pendingReview = (await supabase.from("items").select("id", { count: "exact", head: true }).eq("status", "pending_review")).count || 0;
    newFeedback = (await supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new")).count || 0;
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "consignor").eq("approved", false);
    pendingPeople = count || 0;
  }
  let offq = supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "pending").gt("expires_at", new Date().toISOString());
  if (!staff) offq = offq.eq("seller_id", profile.id);
  const openOffers = (await offq).count || 0;
  let oq = supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "disputed"]);
  if (!staff) oq = oq.eq("seller_id", profile.id);
  const openOrders = (await oq).count || 0;

  supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id).then(() => {}, () => {});
  type L = { href: string; label: string };
  // Main row: only what people use every day. Everything else lives under More, in plain groups.
  const main: L[] = staff
    ? [
        { href: "/app", label: "📦 Inventory" },
        { href: "/app/items/new", label: "➕ Add" },
        { href: "/lookups", label: "📂 Lookups" },
        { href: "/app/inbox", label: unread ? `💬 Inbox (${unread})` : "💬 Inbox" },
        { href: "/app/orders", label: openOrders ? `🛒 Orders (${openOrders})` : "🛒 Orders" },
        { href: "/app/review", label: pendingReview ? `✅ Review (${pendingReview})` : "✅ Review" },
        { href: "/app/todo", label: todoNow ? `📝 To-do (${todoNow})` : "📝 To-do" },
        { href: "/app/ops", label: "🎛 Operations" },
        { href: "/app/feedback", label: newFeedback ? `💡 Ideas (${newFeedback} new)` : "💡 Ideas" },
      ]
    : [
        { href: "/app/items/new", label: "➕ Sell" },
        { href: "/app", label: "📦 My stuff" },
        { href: "/lookups", label: "📂 Lookups" },
        { href: "/app/inbox", label: unread ? `💬 Messages (${unread})` : "💬 Messages" },
        { href: "/app/money", label: "💵 Money" },
        { href: "/feedback?from=/app", label: "💡 Ideas & problems" },
      ];
  const more: { group: string; links: L[] }[] = staff
    ? [
        { group: "Selling", links: [{ href: "/app/snap", label: "📷 Snap a pile" }, { href: "/app/offers", label: openOffers ? `💸 Offers (${openOffers})` : "💸 Offers" }, { href: "/app/requests", label: "🔎 Wanted list" }, { href: "/app/pickups", label: "📅 Pickups" }, { href: "/app/bins", label: "🗄 Bins" }, { href: "/tools", label: "✨ AI tools" }] },
        { group: "Store & people", links: [{ href: "/app/people", label: pendingPeople ? `👤 People (${pendingPeople} waiting)` : "👤 People" }, { href: "/app/blast", label: "📧 Email" }, { href: "/app/blog", label: "✍️ Blog" }, { href: "/app/invites", label: "🎁 Invites" }, { href: "/", label: "🏪 See the store" }] },
        { group: "Run the business", links: [{ href: "/app/money", label: "💵 Money" }, { href: "/app/taxes", label: "📊 Year summary" }, { href: "/app/trash", label: "🗑 Deleted" }, { href: "/app/settings", label: "⚙️ Settings" }, { href: "/account/profile", label: "🙂 Profile" }, { href: "/help", label: "❓ Help" }] },
      ]
    : [
        { group: "Selling", links: [{ href: "/app/orders", label: openOrders ? `🛒 Orders (${openOrders})` : "🛒 Orders" }, { href: "/app/offers", label: openOffers ? `💸 Offers (${openOffers})` : "💸 Offers" }, { href: "/tools", label: "✨ AI tools" }, { href: "/app/snap", label: "📷 List a whole pile" }] },
        { group: "You", links: [{ href: "/account/profile", label: "🙂 Profile & alerts" }, { href: "/app/taxes", label: "📊 Year summary" }, { href: "/pro", label: "⭐ Pro" }, { href: "/", label: "🏪 See the store" }, { href: "/help", label: "❓ Help" }] },
      ];
  const urgent = staff && todoNow ? { href: "/app/todo", text: `📝 ${todoNow} thing${todoNow === 1 ? "" : "s"} on your to-do list need${todoNow === 1 ? "s" : ""} you. Tap to see.` } : !staff && (openOrders || openOffers) ? (openOrders ? { href: "/app/orders", text: `🛒 ${openOrders === 1 ? "Someone bought something!" : `${openOrders} orders to handle`} Tap to see what to do.` } : { href: "/app/offers", text: `💸 ${openOffers === 1 ? "You have an offer" : `${openOffers} offers`} waiting. Tap to answer.` }) : null;

  return (
    <div className="flex-1 flex flex-col">
      <header className="no-print sticky top-0 z-10 topbar">
        <div className="max-w-3xl mx-auto px-3 h-14 flex items-center justify-between gap-2">
          <Link href="/app" aria-label="Home"><Wordmark compact /></Link>
          <div className="flex items-center gap-1.5">
            <Link href="/help" className="navbtn" aria-label="Help">?</Link>
            <details className="relative">
              <summary className="navbtn list-none cursor-pointer">☰ More{!staff && (openOrders || openOffers) ? " •" : ""}</summary>
              <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl p-3 space-y-3 z-30" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)" }}>
                {more.map((g) => (
                  <div key={g.group} className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide muted">{g.group}</p>
                    {g.links.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-2 py-2 text-base font-semibold hover:opacity-80" style={{ background: "var(--line)" }}>{l.label}</Link>)}
                  </div>
                ))}
                <SignOutButton />
              </div>
            </details>
          </div>
        </div>
        <nav className={`max-w-3xl mx-auto px-2 pb-2 ${staff ? "flex gap-1 overflow-x-auto" : "grid grid-cols-4 gap-1"}`}>
          {main.map((n) => (
            <NavLink key={n.href} href={n.href} className="navbtn text-center justify-center" style={{ minHeight: staff ? 36 : 44, fontSize: staff ? ".85rem" : ".9rem" }}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {urgent && <Link href={urgent.href} className="block text-center font-semibold px-4 py-2" style={{ background: "var(--ok)", color: "#fff" }}>{urgent.text}</Link>}
      {!profile.approved && !staff && (
        <div className="text-sm px-4 py-2 text-center" style={{ background: "var(--accent)", color: "#fff" }}>
          Your account is pending approval. You can add items now; they go live once we approve.
        </div>
      )}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4"><ScreenHint />{children}</main>
    </div>
  );
}
