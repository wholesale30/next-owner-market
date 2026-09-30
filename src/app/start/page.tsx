import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Start with one box: how to sell your stuff when it's overwhelming", description: "A plain-English path from 'I have too much stuff' to 'I sold it.' One box at a time, no experience needed." };

const STEPS = [
  { n: 1, title: "Pick one box. Just one.", body: "Not the garage. Not the attic. One box, one shelf, one corner. The whole trick to a big job is making it small. You'll do the next box tomorrow.", tip: "If you can't pick, take the one closest to the door." },
  { n: 2, title: "Photograph it.", body: "Open the box and take 3–6 photos: one wide shot of everything, then closer shots so labels and model numbers are readable. Don't stage anything. Don't clean anything yet.", tip: "Phone flat, good light, that's it." },
  { n: 3, title: "Let the site sort it.", body: "Go to Sort the pile, pick those photos from your gallery, tap Sort it. In about a minute you'll see every item, what it's worth, and a label: Sell, Keep, Donate, or Toss, with a one-line reason.", tip: "Disagree with a label? Tap a different one. You know your stuff.", link: "/pile", linkLabel: "Open Sort the pile" },
  { n: 4, title: "List the ones marked Sell.", body: "Tap 'List N items.' Each one becomes a listing with the photo, a title, a description, and a price already written. Open each one, read it over, fix anything, tap List. You just listed a box without typing a word.", tip: "Prices are a range for a reason. Middle of the range is a fine place to start." },
  { n: 5, title: "Set up how you get paid (once, 5 minutes).", body: "Payouts in your app → Set up payouts. Name, address, bank account. It's handled by Stripe, the same company behind Amazon and Shopify payments. After this, every sale lands in your bank on its own.", tip: "Until this is done, buyers can message you but can't hit Buy.", link: "/app/money", linkLabel: "Set up payouts" },
  { n: 6, title: "Put it on Facebook too (and the others, if you want).", body: "On each listing there's a row of tabs: Facebook, eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, Etsy. Tap one, tap Copy, open that app, paste. Each has a 'How to post' guide that says exactly what to tap, written for someone who's never done it.", tip: "Facebook is free for everyone. The other eight come with Pro.", link: "/sell-on", linkLabel: "See the how-to guides" },
  { n: 7, title: "When it sells, hand it over the safe way.", body: "Pickup: the buyer shows you a 6-digit code on their phone. Type it into the order, tap Release, money's yours. Shipping: tap Buy label on the order, print it, tape it on, drop it off. Tracking is automatic.", tip: "Never hand anything over without the code. Never ship without the label from here. That's what protects you." },
  { n: 8, title: "Do the next box.", body: "That's the whole method. One box a day is thirty boxes a month. The pile you couldn't look at is gone by spring, and you got paid for it.", tip: "Check your Year page in January; it adds up everything for your taxes." },
];

export default async function StartPage() {
  const supabase = await createClient();
  const [{ data: biz }, { data: { user } }] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const jsonLd = { "@context": "https://schema.org", "@type": "HowTo", name: "How to sell your stuff when it's overwhelming: start with one box", step: STEPS.map((s) => ({ "@type": "HowToStep", position: s.n, name: s.title, text: s.body })) };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero"><div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight">Start with one box.</h1>
        <p className="opacity-90">Too much stuff, no idea where to start? This is the path. Eight steps, plain English, no experience needed. Most people finish step 4 in under ten minutes.</p>
      </div></section>
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {STEPS.map((s) => (
          <div key={s.n} className="card p-4 flex gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-lg" style={{ background: "var(--brand)", color: "#fff" }}>{s.n}</div>
            <div className="space-y-1 min-w-0">
              <p className="font-bold text-lg leading-tight">{s.title}</p>
              <p className="text-sm">{s.body}</p>
              <p className="text-xs muted">💡 {s.tip}</p>
              {s.link && <Link href={s.link} className="btn btn-secondary mt-1">{s.linkLabel} →</Link>}
            </div>
          </div>
        ))}
        <div className="card p-4 text-center space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-bold text-lg">Ready? Box, photos, go.</p>
          <Link href="/pile" className="btn btn-primary w-full text-lg">Sort my first box</Link>
          <p className="text-xs muted">Free. Three AI lookups on us; $15/month for unlimited when you&apos;re rolling. <Link href="/why" className="underline">Why we built this</Link>.</p>
        </div>
      </main>
    </div>
  );
}
