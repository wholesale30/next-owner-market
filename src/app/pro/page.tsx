import { createClient } from "@/lib/supabase/server";
import StoreHeader from "../StoreHeader";
import StartSelling from "../StartSelling";

export const metadata = { title: "Next Owner Pro: photos in, listings out", description: "Upload a pile of photos. The AI sorts them into items, cleans the backgrounds, writes every listing, and gives you ready-to-paste versions for eBay, Facebook, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, and Etsy. $15/month." };

export default async function ProPage() {
  const supabase = await createClient();
  const [{ data: biz }, { data: plans }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "plans").maybeSingle(),
  ]);
  const business = (biz?.value as { name: string; tagline?: string }) || { name: "Next Owner Market" };
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  const p = (plans?.value as { pro_monthly: number; pro_features: string[] }) || { pro_monthly: 15, pro_features: [] };
  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="text-center space-y-3 pt-4">
          <h1 className="text-3xl font-extrabold leading-tight">Photograph the pile.<br />Get the listings.</h1>
          <p className="text-lg muted">Upload 40 photos of 40 different things. The AI sorts them into items, cuts each one onto a clean background, writes the title, description, specs and price, and hands you ready-to-paste listings for nine marketplaces.</p>
          <StartSelling signedIn={!!user} role={me?.role || null} className="btn btn-primary text-lg w-full" label={me?.role && me.role !== "buyer" ? "Go to my listings" : "Start free: 3 AI listings on us"} />
          <p className="text-xs muted">No card to start. Pro is ${p.pro_monthly}/month, cancel any time.</p>
        </section>

        <section className="grid grid-cols-1 gap-3">
          {[
            ["🖼 Dump a batch", "Pick a pile of photos from your gallery. The AI figures out which photos are the same item. Fix any with one tap."],
            ["✨ Listings written for you", "Title, description, brand, model, condition, specs, tags, a price range, and a warning if it's recalled or not allowed."],
            ["🎯 Clean backgrounds", "Every item cut out onto a plain background, on your phone, free. Listings that look like a store's."],
            ["📋 Nine marketplaces, one tap each", "Facebook Marketplace, eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, Etsy. Each copy is trimmed to that site's rules, with a plain-English how-to-post guide."],
            ["🏷 QR tags", "Print a tag, stick it on the item. Scan it and the listing opens. Track a garage or a warehouse."],
            ["🛒 Your own store with card checkout", "Buyers pay by card, Apple Pay, or Google Pay. Money is held until hand-off. No more no-shows, no Zelle screenshots."],
          ].map(([h, t]) => (
            <div key={h} className="card p-4"><p className="font-bold">{h}</p><p className="text-sm muted">{t}</p></div>
          ))}
        </section>

        <section className="card p-4 space-y-2">
          <div className="flex items-baseline justify-between"><p className="font-bold text-lg">Free</p><p className="font-bold">$0</p></div>
          <ul className="text-sm space-y-1"><li>✔ 3 AI-written listings to try it</li><li>✔ 10 live listings in the store</li><li>✔ Card checkout, held payments, QR tags</li><li>✔ Messaging, pickup scheduling</li></ul>
          <div className="flex items-baseline justify-between pt-3 border-t" style={{ borderColor: "var(--line)" }}><p className="font-bold text-lg">Pro</p><p className="font-bold">${p.pro_monthly}/month</p></div>
          <ul className="text-sm space-y-1">{p.pro_features.map((f) => <li key={f}>✔ {f}</li>)}<li>✔ Invite a seller who goes Pro: you both get a month free</li></ul>
          <StartSelling signedIn={!!user} role={me?.role || null} className="btn btn-primary w-full mt-2" label={me?.role && me.role !== "buyer" ? "Go to my listings" : "Start free"} />
        </section>

        <section className="text-sm muted space-y-2">
          <p><b>Compared to the crosslisting apps:</b> List Perfectly charges $69+/month for AI listings. Vendoo and Voolist don&apos;t have a store or payments. None of them sort a pile of photos into items or clean the backgrounds.</p>
          <p><b>Selling through the store</b> pays a commission on the sale price only (15% self-listed), on any plan. Stripe fees are included; nothing else is added.</p>
        </section>
        <p className="text-center text-xs muted">Built by a 30-year surplus dealer in Virginia who got tired of listing one thing at a time.</p>
      </main>
    </div>
  );
}
