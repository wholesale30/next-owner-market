import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

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
  }
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
        { href: "/app/review", label: "Review" },
        { href: "/app/requests", label: "Wanted" },
        { href: "/app/pickups", label: "Pickups" },
        { href: "/app/bins", label: "Bins" },
        { href: "/app/money", label: "Money" },
        { href: "/app/people", label: "People" },
      ]
    : [
        { href: "/app", label: "My items" },
        { href: "/app/items/new", label: "+ Add" },
        { href: "/app/orders", label: openOrders ? `🛒 Orders (${openOrders})` : "🛒 Orders" },
        { href: "/app/money", label: "Payouts" },
      ];

  return (
    <div className="flex-1 flex flex-col">
      <header className="no-print sticky top-0 z-10 border-b" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/app" className="font-bold">Next Owner</Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="muted">Store</Link>
            <SignOutButton />
          </div>
        </div>
        <nav className="max-w-3xl mx-auto px-2 flex gap-1 overflow-x-auto pb-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="pill whitespace-nowrap px-3 py-2">
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
      <main className="flex-1 max-w-3xl w-full mx-auto p-4">{children}</main>
    </div>
  );
}
