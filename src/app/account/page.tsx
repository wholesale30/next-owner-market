import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import StoreHeader from "../StoreHeader";
import AccountClient from "./AccountClient";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");
  const supabase = await createClient();
  const [{ data: favs }, { data: searches }, { data: cats }, { data: biz }, { data: bids }, { data: notes }] = await Promise.all([
    supabase.from("favorites").select("item_id, items(id, sku, title, price, status, item_photos(url, is_primary))").eq("profile_id", profile.id),
    supabase.from("saved_searches").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").is("parent_id", null).order("sort_order"),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.from("bids").select("amount, created_at, auctions(id, current_bid, current_bidder_id, status, ends_at, items(sku, title))").eq("bidder_id", profile.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("subject, body, related_item_id, created_at, items(sku)").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const business = (biz?.value as { name: string; tagline?: string }) || { name: "Next Owner Market" };
  const staff = profile.role !== "buyer";

  // one row per auction, latest bid
  const seen = new Set<string>();
  const myAuctions = (bids || []).filter((b) => {
    const a = b.auctions as unknown as { id: string } | null;
    if (!a || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-3xl mx-auto p-4 space-y-5">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold">Hi{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1><p className="muted text-sm">{profile.email}</p></div>
          {staff && <Link href="/app" className="btn btn-secondary">Go to inventory</Link>}
        </div>

        <AccountClient searches={searches || []} categories={cats || []} />

        {notes?.length ? (
          <section className="space-y-2">
            <h2 className="font-semibold">Alerts</h2>
            {notes.map((n, i) => {
              const it = n.items as unknown as { sku: string } | null;
              return (
                <Link key={i} href={it ? `/item/${it.sku}` : "/"} className="card p-3 text-sm block">
                  <p className="font-semibold">{n.subject}</p>
                  <p className="muted">{n.body}</p>
                </Link>
              );
            })}
          </section>
        ) : null}

        {myAuctions.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">My bids</h2>
            {myAuctions.map((b, i) => {
              const a = b.auctions as unknown as { id: string; current_bid: number; current_bidder_id: string; status: string; ends_at: string; items: { sku: string; title: string } };
              const winning = a.current_bidder_id === profile.id;
              return (
                <Link key={i} href={`/item/${a.items.sku}`} className="card p-3 text-sm flex justify-between">
                  <span className="truncate">{a.items.title}</span>
                  <span className="shrink-0 ml-2">{money(a.current_bid)} • {a.status === "live" ? (winning ? "winning" : "outbid") : winning ? "won" : "lost"}</span>
                </Link>
              );
            })}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Saved items</h2>
          {!favs?.length && <p className="muted text-sm">Tap ♡ on any item to save it here.</p>}
          <ul className="grid grid-cols-2 gap-2">
            {favs?.map((f) => {
              const it = f.items as unknown as { id: string; sku: string; title: string; price: number; status: string; item_photos: { url: string; is_primary: boolean }[] } | null;
              if (!it) return null;
              const photo = it.item_photos?.find((p) => p.is_primary) || it.item_photos?.[0];
              return (
                <li key={f.item_id}>
                  <Link href={`/item/${it.sku}`} className="card overflow-hidden block">
                    <div className="aspect-square" style={{ background: "var(--line)" }}>{photo && <img src={photo.url} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="p-2"><p className="font-bold">{money(it.price)}{it.status === "sold" && <span className="pill pill-sold ml-1">sold</span>}</p><p className="text-sm line-clamp-2">{it.title}</p></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
