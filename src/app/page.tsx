import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import StoreHeader from "./StoreHeader";
import SubscribeBox from "./SubscribeBox";
import LocationBar from "./LocationBar";
import ToolPitch from "@/components/ToolPitch";
import { lookupZip } from "@/lib/geo";

export const revalidate = 60;

export const metadata = { title: "Next Owner Market: snap a photo, the AI writes your listing for 9 sites. Buy and sell used, surplus and vintage", description: "Try it free: one photo, and the AI writes your listing for Facebook, eBay, OfferUp and 6 more. Vintage audio, tools, electronics, furniture, vehicles and more from sellers across the country. Pay by card, pick up or ship. Sell free: photos in, listing out." };

export default async function StorePage({ searchParams }: PageProps<"/">) {
  const sp = (await searchParams) as { q?: string; cat?: string; sort?: string; state?: string; zip?: string; mi?: string };
  const { q, cat, sort } = sp;
  const supabase = await createClient();

  const [{ data: categories }, { data: biz }, { data: { user } }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, parent_id").order("sort_order"),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const business = (biz?.value as { name: string; tagline?: string; location?: string; zip?: string; address?: string; contact_phone?: string; contact_email?: string }) || { name: "Next Owner Market" };
  // buyer's location: ?zip= wins, then their profile ZIP
  let zip = (sp.zip || "").trim();
  if (!zip && user) { const { data: me } = await supabase.from("profiles").select("zip").eq("id", user.id).maybeSingle(); zip = me?.zip || ""; }
  const here = lookupZip(zip);
  const mi = sp.mi === "any" ? null : Number(sp.mi || (here ? 100 : 0)) || null;
  const state = (sp.state || "").toUpperCase().slice(0, 2);
  const store = lookupZip(business.zip || (business.address || "").match(/\b(\d{5})\b/)?.[1]);
  const storeState = store?.state || (business.location || "").match(/,\s*([A-Z]{2})/)?.[1] || null;

  let catIds: string[] | null = null;
  if (cat) { const c = categories?.find((x) => x.slug === cat); if (c) catIds = [c.id, ...(categories || []).filter((x) => x.parent_id === c.id).map((x) => x.id)]; }
  const { data: items } = await supabase.rpc("search_items", {
    p_q: q || null, p_category_ids: catIds, p_state: state || null,
    p_lat: here?.lat ?? null, p_lng: here?.lng ?? null, p_radius_mi: here ? mi : null,
    p_sort: sort === "sold" ? "sold" : sort || (here ? "near" : "new"), p_sold: sort === "sold",
    p_store_lat: store?.lat ?? null, p_store_lng: store?.lng ?? null, p_store_state: storeState, p_limit: 120,
  });
  type Row = { id: string; sku: string; title: string; price: number; status: string; tested: boolean; serviced: boolean; shipping_ok: boolean; local_pickup_ok: boolean; owner_id: string; city: string | null; state: string | null; distance_mi: number | null; photo_url: string | null; shipping_mode?: string | null };
  const rows = (items || []) as Row[];
  const { data: reviews } = await supabase.from("ratings").select("stars, comment, created_at, ratee_id").not("comment", "is", null).gte("stars", 4).order("created_at", { ascending: false }).limit(6);
  const reviewNames = reviews?.length ? (await supabase.from("seller_public").select("id, display_name").in("id", reviews.map((r) => r.ratee_id))).data || [] : [];
  const locOf = (it: Row) => it.state ? [it.city || (it.owner_id && !it.city ? (business.location || "").split(",")[0] : ""), it.state].filter(Boolean).join(", ") : business.location || "";
  const keep = (extra: Record<string, string>) => { const o: Record<string, string> = {}; for (const [k, v] of Object.entries({ q, cat, sort, state, zip, mi: sp.mi })) if (v) o[k] = String(v); return new URLSearchParams({ ...o, ...extra }).toString(); };
  const topCats = (categories || []).filter((c) => !c.parent_id);

  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <section className="hero">
        <div className="max-w-5xl mx-auto px-4 pt-7 pb-6 space-y-4">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">Snap a photo.<br />The AI writes your listing.</h1>
            <p className="text-base md:text-lg opacity-90">Title, description and price, plus ready-to-paste versions for Facebook, eBay and 7 more sites. About 30 seconds. Free to try, no account.</p>
          </div>
          <Link href={user ? "/app/items/new" : "/try"} className="btn btn-white w-full text-lg py-4 font-extrabold block text-center">📸 {user ? "List an item" : "Try it free: pick a photo"}</Link>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/worth", icon: "💰", label: "What's it worth?" },
              { href: "/thrift", icon: "🛒", label: "Thrift store? Buy or pass" },
              { href: "/pile", icon: "📦", label: "List a whole box" },
              { href: "/start", icon: "😮‍💨", label: "Overwhelmed? Start here" },
            ].map((t) => (
              <Link key={t.href} href={t.href} className="flex items-center gap-2 rounded-2xl px-2.5 font-bold text-[14px] min-[400px]:text-[15px] min-[440px]:text-base leading-tight text-left" style={{ minHeight: 64, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.55)", color: "#fff" }}>
                <span className="text-xl min-[400px]:text-2xl min-[440px]:text-3xl shrink-0">{t.icon}</span><span className="min-w-0">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-4 pt-4">
        <div className="card p-4">
          <p className="font-bold mb-2">How selling works</p>
          <ol className="grid grid-cols-3 gap-2 text-center text-xs">
            <li><p className="text-2xl">📸</p><p className="font-semibold">1. Snap it</p><p className="muted">One photo from your phone.</p></li>
            <li><p className="text-2xl">✨</p><p className="font-semibold">2. AI writes it</p><p className="muted">For 9 sites, ready to paste.</p></li>
            <li><p className="text-2xl">💵</p><p className="font-semibold">3. Get paid</p><p className="muted">Plus a free spot in our store.</p></li>
          </ol>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-4 pt-5 space-y-2">
        <h2 className="font-bold text-lg">Shopping? Find something near you</h2>
        <form className="flex gap-2">
          <input className="input" name="q" placeholder="Search: turntable, drill, lamp, Technics…" defaultValue={q || ""} />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <button className="btn btn-primary font-bold">Search</button>
        </form>
      </section>
      <main className="max-w-5xl mx-auto p-4 space-y-4">

        <LocationBar zip={zip} state={state} mi={sp.mi || (here ? "100" : "any")} here={here ? `${here.city}, ${here.state}` : null} params={{ q: q || "", cat: cat || "", sort: sort || "" }} />

        <div className="flex gap-1 overflow-x-auto pb-1">
          <Link href={`/?${keep({ cat: "" })}`.replace(/cat=&?/, "")} className={`pill px-3 py-2 whitespace-nowrap ${!cat ? "pill-active" : ""}`}>All</Link>
          {topCats.map((c) => (
            <Link key={c.id} href={q || state || zip ? `/?${keep({ cat: c.slug })}` : `/c/${c.slug}`} className={`pill px-3 py-2 whitespace-nowrap ${cat === c.slug ? "pill-active" : ""}`}>{c.name}</Link>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="muted">{rows.length} items{here ? ` near ${here.city}` : state ? ` in ${state}` : ""}</span>
          <div className="flex gap-1 overflow-x-auto">
            {[...(here ? [["near", "Nearest"]] : []), ["new", "Newest"], ["low", "$ low"], ["high", "$ high"], ["sold", "Sold"]].map(([k, l]) => (
              <Link key={k} href={`/?${keep({ sort: k })}`} className={`pill ${(sort || (here ? "near" : "new")) === k ? "pill-active" : ""}`}>{l}</Link>
            ))}
          </div>
        </div>

        {!rows.length && (
          <div className="card p-8 text-center space-y-2">
            <p className="font-semibold">Nothing listed here yet.</p>
            <p className="muted text-sm">New items go up every day. Tell us what you&apos;re hunting for and we&apos;ll find it.</p>
            <Link href="/looking-for" className="btn btn-primary">I&apos;m looking for something</Link>
          </div>
        )}

        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.map((it) => {
            const photo = it.photo_url ? { url: it.photo_url } : null;
            return (
              <li key={it.id}>
                <Link href={`/item/${it.sku}`} className="card overflow-hidden block h-full">
                  <div className="aspect-square" style={{ background: "var(--line)" }}>
                    {photo && <img src={photo.url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="font-bold">{money(it.price)}{it.status === "reserved" && <span className="pill ml-2">On hold</span>}{(it.status === "sold" || it.status === "shipped") && <span className="pill pill-sold ml-2">Sold</span>}</p>
                    <p className="text-sm leading-tight line-clamp-2">{it.title}</p>
                    <p className="text-xs muted">
                      {[locOf(it) ? `📍 ${locOf(it)}${it.distance_mi != null ? ` · ${Math.round(it.distance_mi)} mi` : ""}` : null, it.shipping_ok && (it.shipping_mode === "free" ? "🚚 Free shipping" : "🚚 Ships"), it.tested && "Tested"].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {reviews && reviews.length >= 2 && (
          <section className="space-y-2 mt-6">
            <h2 className="font-bold text-lg">What people are saying</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {reviews.map((r, i) => (
                <div key={i} className="card p-3 min-w-[260px] max-w-[300px] text-sm space-y-1">
                  <p style={{ color: "var(--accent)" }}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</p>
                  <p>&quot;{r.comment}&quot;</p>
                  <p className="text-xs muted">about @{reviewNames.find((n) => n.id === r.ratee_id)?.display_name || "a member"} · {new Date(r.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="card p-4 mt-6">
          <h2 className="font-bold text-lg mb-2">How it works</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div><p className="text-2xl">💳</p><p className="font-semibold">Pay by card</p><p className="muted text-xs">Apple Pay, Google Pay, Cash App, Affirm, Klarna too.</p></div>
            <div><p className="text-2xl">📸</p><p className="font-semibold">Sell yours</p><p className="muted text-xs">Snap photos. The AI writes the listing. Free to list.</p></div>
            <div><p className="text-2xl">🤝</p><p className="font-semibold">Pick up or ship</p><p className="muted text-xs">Pickup code or tracked label. Problem? Full refund.</p></div>
          </div>
        </section>
        <div className="mt-4"><SubscribeBox /></div>
        <div className="card p-5 text-center space-y-2">
          <h2 className="font-bold text-lg">Looking for something specific?</h2>
          <p className="muted text-sm">We source surplus across the country. Tell us what you want and we&apos;ll hunt it down.</p>
          <Link href="/looking-for" className="btn btn-primary">Tell us what you need</Link>
        </div>
        <div className="card p-5 text-center space-y-2" style={{ borderColor: "var(--brand)" }}>
          <h2 className="font-bold text-lg">Have stuff to sell?</h2>
          <p className="muted text-sm">Pick one photo. Watch the AI write the listing for Facebook, eBay and 7 more. Free to try, no account needed.</p>
          <Link href={user ? "/app/items/new" : "/try"} className="btn btn-primary">📸 Try it free</Link>
        </div>
        <footer className="text-center text-xs muted py-6">
          {business.name}{business.location ? ` • ${business.location}` : ""}{business.contact_phone ? ` • ${business.contact_phone}` : ""}
          {" • "}<Link href="/try" className="underline">Try it free</Link>{" • "}<Link href="/tools" className="underline">All tools</Link>{" • "}<Link href="/pro" className="underline">Pro</Link>{" • "}<Link href="/login" className="underline">Sign in</Link>
          {" • "}<Link href="/worth" className="underline">What&apos;s it worth?</Link>{" • "}<Link href="/pile" className="underline">Sort the pile</Link>{" • "}<Link href="/buy-or-pass" className="underline">Buy or pass?</Link>{" • "}<Link href="/thrift" className="underline">Thrift store scanner</Link>{" • "}<Link href="/valued" className="underline">What things are worth</Link>{" • "}<Link href="/start" className="underline">Start with one box</Link>{" • "}<Link href="/why" className="underline">Why we built this</Link>{" • "}<Link href="/embed" className="underline">Free widget for your site</Link>{" • "}<Link href="/looking-for" className="underline">Wanted</Link>{" • "}<Link href="/community" className="underline">Community</Link>{" • "}<Link href="/blog" className="underline">Blog</Link>{" • "}<Link href="/sell-on" className="underline">How to sell on eBay, Poshmark…</Link>{" • "}<Link href="/help" className="underline">Help</Link>{" • "}<Link href="/terms" className="underline">Terms</Link>{" • "}<Link href="/privacy" className="underline">Privacy</Link>
        </footer>
      </main>
    </div>
  );
}
