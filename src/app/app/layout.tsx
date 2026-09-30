import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";
import { Wordmark } from "@/components/Logo";
import { ScreenHint } from "@/components/Help";

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
  let pendingPeople = 0, pendingReview = 0;
  if (staff) {
    pendingReview = (await supabase.from("items").select("id", { count: "exact", head: true }).eq("status", "pending_review")).count || 0;
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "consignor").eq("approved", false);
    pendingPeople = count || 0;
  }
  let offq = supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "pending").gt("expires_at", new Date().toISOString());
  if (!staff) offq = offq.eq("seller_id", profile.id);
  const openOffers = (await offq).count || 0;
  let oq = supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "disputed"]);
  if (!staff) oq = oq.eq("seller_id", profile.id);
  const openOrders = (await oq).count || 0;

  const nav = staff
    ? [
        { href: "/app", label: "Inventory" },
        { href: "/app/items/new", label: "+ Add" },
        { href: "/app/snap", label: "📷 Snap" },
        { href: "/app/inbox", label: unread ? `💬 Inbox (${unread})` : "💬 Inbox" },
        { href: "/app/orders", label: openOrders ? `🛒 Orders (${openOrders})` : "🛒 Orders" },
        { href: "/app/offers", label: openOffers ? `💸 Offers (${openOffers})` : "💸 Offers" },
        { href: "/app/review", label: pendingReview ? `✅ Review (${pendingReview})` : "Review" },
        { href: "/app/requests", label: "Wanted" },
        { href: "/app/pickups", label: "Pickups" },
        { href: "/app/bins", label: "Bins" },
        { href: "/app/money", label: "Money" },
        { href: "/app/blast", label: "📧 Email" },
        { href: "/app/people", label: pendingPeople ? `👤 People (${pendingPeople} waiting)` : "People" },
      ]
    : [
        { href: "/app", label: "My items" },
        { href: "/app/items/new", label: "+ Add" },
        { href: "/app/inbox", label: unread ? `💬 Inbox (${unread})` : "💬 Inbox" },
        { href: "/app/orders", label: openOrders ? `🛒 Orders (${openOrders})` : "🛒 Orders" },
        { href: "/app/offers", label: openOffers ? `💸 Offers (${openOffers})` : "💸 Offers" },
        { href: "/app/money", label: "Payouts" },
      ];

  return (
    <div className="flex-1 flex flex-col">
      <header className="no-print sticky top-0 z-10 topbar">
        <div className="max-w-3xl mx-auto px-3 h-16 flex items-center justify-between gap-2">
          <Link href="/app" aria-label="Home"><Wordmark compact /></Link>
          <div className="flex items-center gap-1.5">
            <Link href="/help" className="navbtn" aria-label="Help">?</Link>
            <Link href="/account/profile" className="navbtn">Profile</Link>
            <Link href="/" className="navbtn">Store</Link>
            <SignOutButton />
          </div>
        </div>
        <nav className="max-w-3xl mx-auto px-2 flex gap-1 overflow-x-auto pb-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="navbtn" style={{ minHeight: 36, fontSize: ".85rem" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {!profile.approved && !staff && (
        <div className="text-sm px-4 py-2 text-center" style={{ background: "var(--accent)", color: "#fff" }}>
          Your account is pending approval. You can add items now; they go live once we approve.
        </div>
      )}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4"><ScreenHint />{children}</main>
    </div>
  );
}
