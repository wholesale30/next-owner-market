import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import type { Item } from "@/lib/types";
import StoreHeader from "./StoreHeader";
import SubscribeBox from "./SubscribeBox";

export const revalidate = 60;

export default async function StorePage({ searchParams }: PageProps<"/">) {
  const { q, cat, sort } = (await searchParams) as { q?: string; cat?: string; sort?: string };
  const supabase = await createClient();

  const [{ data: categories }, { data: biz }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, parent_id").order("sort_order"),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const business = (biz?.value as { name: string; tagline?: string; location?: string; contact_phone?: string; contact_email?: string }) || { name: "Next Owner Market" };

  let query = supabase
    .from("items")
    .select("id, sku, title, price, status, tested, serviced, shipping_ok, local_pickup_ok, listed_at, category_id, item_photos(url, is_primary, sort_order), categories(name, slug)")
    .in("status", ["active", "reserved"])
    .limit(120);
  if (q) query = query.textSearch("search", q, { type: "websearch" });
  if (cat) {
    const c = categories?.find((x) => x.slug === cat);
    if (c) {
      const ids = [c.id, ...(categories || []).filter((x) => x.parent_id === c.id).map((x) => x.id)];
      query = query.in("category_id", ids);
    }
  }
  if (sort === "low") query = query.order("price", { ascending: true });
  else if (sort === "high") query = query.order("price", { ascending: false });
  else query = query.order("listed_at", { ascending: false, nullsFirst: false });

  const { data: items } = await query;
  const topCats = (categories || []).filter((c) => !c.parent_id);

  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <form className="flex gap-2">
          <input className="input" name="q" placeholder="Search: turntable, drill, lamp, Technics…" defaultValue={q || ""} />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <button className="btn btn-primary">Search</button>
        </form>

        <div className="flex gap-1 overflow-x-auto pb-1">
          <Link href="/" className={`pill px-3 py-2 whitespace-nowrap ${!cat ? "pill-active" : ""}`}>All</Link>
          {topCats.map((c) => (
            <Link key={c.id} href={`/?cat=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`pill px-3 py-2 whitespace-nowrap ${cat === c.slug ? "pill-active" : ""}`}>{c.name}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="muted">{items?.length || 0} items</span>
          <div className="flex gap-1">
            {[["new", "Newest"], ["low", "$ low"], ["high", "$ high"]].map(([k, l]) => (
              <Link key={k} href={`/?${new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { cat } : {}), sort: k }).toString()}`} className={`pill ${(sort || "new") === k ? "pill-active" : ""}`}>{l}</Link>
            ))}
          </div>
        </div>

        {!items?.length && (
          <div className="card p-8 text-center space-y-2">
            <p className="font-semibold">Nothing listed here yet.</p>
            <p className="muted text-sm">New items go up every day. Tell us what you&apos;re hunting for and we&apos;ll find it.</p>
            <Link href="/looking-for" className="btn btn-primary">I&apos;m looking for something</Link>
          </div>
        )}

        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(items as unknown as Item[] | null)?.map((it) => {
            const photo = [...(it.item_photos || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
            return (
              <li key={it.id}>
                <Link href={`/item/${it.sku}`} className="card overflow-hidden block h-full">
                  <div className="aspect-square" style={{ background: "var(--line)" }}>
                    {photo && <img src={photo.url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="font-bold">{money(it.price)}{it.status === "reserved" && <span className="pill ml-2">On hold</span>}</p>
                    <p className="text-sm leading-tight line-clamp-2">{it.title}</p>
                    <p className="text-xs muted">
                      {[it.tested && "Tested", it.serviced && "Serviced", it.shipping_ok && "Ships"].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-8"><SubscribeBox /></div>
        <div className="card p-5 text-center space-y-2">
          <h2 className="font-bold text-lg">Looking for something specific?</h2>
          <p className="muted text-sm">We source surplus across the country. Tell us what you want and we&apos;ll hunt it down.</p>
          <Link href="/looking-for" className="btn btn-primary">Tell us what you need</Link>
        </div>
        <div className="card p-5 text-center space-y-2">
          <h2 className="font-bold text-lg">Have stuff to sell?</h2>
          <p className="muted text-sm">We test, photograph, list, and sell it for you. You get paid when it sells.</p>
          <Link href="/pro" className="btn btn-secondary">Sell with us</Link>
        </div>
        <footer className="text-center text-xs muted py-6">
          {business.name}{business.location ? ` • ${business.location}` : ""}{business.contact_phone ? ` • ${business.contact_phone}` : ""}
          {" • "}<Link href="/login" className="underline">Staff sign in</Link>
        </footer>
      </main>
    </div>
  );
}
