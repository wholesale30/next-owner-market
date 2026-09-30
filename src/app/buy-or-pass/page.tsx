import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import BuyPassClient from "./BuyPassClient";
import ToolGuide from "@/components/ToolGuide";

export const metadata = { title: "Buy or Pass: is this thrift find worth flipping?", description: "Point your phone at anything in a thrift store or yard sale. See what it resells for, the fees, shipping, and your profit. Buy or pass, in 10 seconds." };

export default async function BuyPassPage() {
  const supabase = await createClient();
  const [me, { data: biz }] = await Promise.all([getProfile(), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!me} />
      <section className="hero"><div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight">Buy or pass?</h1>
        <p className="opacity-90">In the thrift store, at the yard sale. One photo, what you&apos;d pay, and you get: resale range, fees, shipping, profit. Buy or pass.</p>
      </div></section>
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <BuyPassClient meId={me?.id || null} />
        <ToolGuide
          intro={[
            "You're standing in a thrift store holding a lamp with a $12 tag, thinking: could I sell this for $40? This answers that before you reach the register. One photo and the price they're asking, and it tells you what the thing resells for, which site it sells best on, what that site's fees and shipping will eat, and what's left for you. Then a straight answer: BUY, MAYBE, or PASS.",
            "It's built for beginners, so the fee math is shown, not hidden. You'll learn the rules of each marketplace just by using it.",
          ]}
          steps={[
            { title: "Photograph the item", body: "The whole thing, plus the label or model number if there is one. One to four photos." },
            { title: "Type what they're asking", body: "The price on the tag. Optional note: works, missing the cord, has the box." },
            { title: "Tap Buy or pass?", body: "You get the resale range, the best place to sell, that place's fees, shipping if it ships, and your profit range. BUY means the low end still clears about $15 after everything." },
            { title: "Bought it? List it", body: "Tap Bought it, and What's it worth? writes the listing. Your cost is already known, so your profit shows up on the Year page." },
          ]}
          examples={[
            { title: "Vintage Pyrex bowl, $4 tag", result: "Resells $25–$45 on eBay. Fees and shipping about $12. Profit $9–$29. BUY." },
            { title: "Cuisinart food processor, $18 tag, no blade", result: "Resells $20–$35 local. Missing blade hurts. Profit $2–$17. MAYBE; check for the blade in the box." },
            { title: "Particleboard bookshelf, $25", result: "Resells $15–$30 local only, heavy, slow. PASS." },
          ]}
          faq={[
            { q: "Where do the fees come from?", a: "A fee table we keep current for eBay, Mercari, Poshmark, Facebook Marketplace, and our own store. It's shown under every result so you can check our math. Marketplaces change fees; we re-check them regularly." },
            { q: "How accurate is the resale range?", a: "Good for common stuff (tools, kitchen, electronics, brand-name goods). Weaker for vintage, pottery, and toys, where a maker's mark can change everything. Look at the confidence and the warning line." },
            { q: "What does MAYBE mean?", a: "It could clear $15 if everything goes right, but the low end doesn't. Worth it if you can negotiate the price down or you already know the item." },
            { q: "Does it cost anything?", a: "Three free lookups, then Pro for unlimited ($15/month), which also includes unlimited AI listings and nine marketplace copies." },
          ]}
          related={[{ href: "/worth", label: "What's it worth?" }, { href: "/pile", label: "Sort the pile" }, { href: "/sell-on", label: "How to sell on each marketplace" }]}
        />
      </main>
    </div>
  );
}
