import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { BP_FREE_DAILY, since } from "@/lib/thrift";
import BuyPassClient from "../buy-or-pass/BuyPassClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Thrift store scanner: check it before you buy it (free)",
  description: "Shopping Goodwill or any thrift store? Snap the item, type the tag price, and get BUY or PASS with the profit after eBay, Mercari, Poshmark or Facebook fees. Free, no app, no account.",
};

export default async function ThriftPage({ searchParams }: PageProps<"/thrift">) {
  const [sp, me] = await Promise.all([searchParams, getProfile()]);
  const weekAgo = since(7 * 86400_000);
  const { count } = await admin().from("buy_pass_scans").select("id", { count: "exact", head: true }).gte("created_at", weekAgo);
  const ref = typeof sp.ref === "string" ? sp.ref.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) : "";
  return (
    <div className="flex-1">
      <StoreHeader business={{ name: "Next Owner Market" }} signedIn={!!me} />
      <section className="hero"><div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight">In the thrift store? Check it before you buy it.</h1>
        <p className="opacity-90 text-lg">Snap it. Type the price on the tag. Get <b>BUY</b> or <b>PASS</b> and what you&apos;d really keep after fees, before you reach the register.</p>
        <p className="opacity-90 text-sm">Free · no app to download · no account for your first one · works in the aisle</p>
      </div></section>
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <BuyPassClient meId={me?.id || null} refCode={(me as { referral_code?: string } | null)?.referral_code || null} inRef={ref} />
        {(count || 0) >= 20 && <p className="text-center text-sm muted">{(count || 0).toLocaleString()} finds checked this week</p>}

        <div className="card p-4 space-y-2">
          <p className="font-bold text-lg">Why it&apos;s free when other thrift apps charge $10 a week</p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li><b>We earn when you sell, not when you scan.</b> Buy it, tap one button, and the AI writes the listing for our store (free to list) plus eBay, Facebook, Mercari and more.</li>
            <li><b>{BP_FREE_DAILY} free checks every day</b> with a free account. No card, no trial that bills you, no weekly plan.</li>
            <li><b>Real profit, not just a price.</b> Fees and shipping for each place to sell, side by side, and the most you should pay.</li>
            <li><b>Honest when it isn&apos;t sure.</b> Every answer says how sure it is and what to check (fakes, recalls, missing parts).</li>
          </ul>
        </div>

        <div className="card p-4 space-y-2 text-sm">
          <p className="font-bold text-lg">Thrift tips that pay</p>
          <p><b>Go Monday or Tuesday</b> for fresh stock; Saturday is the most crowded. <b>Watch the color tag:</b> many stores put one tag color at half off each week, often starting Monday.</p>
          <p><b>Flip the item over.</b> Maker&apos;s marks, model numbers and &quot;Made in&quot; labels change the price more than anything. Photograph them.</p>
          <p><b>Check before you carry it.</b> Big, heavy and fragile things sell local only. The answer tells you when shipping kills the profit.</p>
        </div>

        <div className="card p-4 space-y-2 text-sm">
          <p className="font-bold">Questions</p>
          <p><b>Does it work at Goodwill, Salvation Army, Savers, yard sales?</b> Anywhere. It only needs a photo and a price.</p>
          <p><b>Do I have to download an app?</b> No. It&apos;s a web page. After your first check you can put it on your home screen and it opens like an app.</p>
          <p><b>What if I buy it?</b> Tap &quot;I bought it: list it now.&quot; Your photo, the price and what you paid are filled in.</p>
          <p><b>See what others found:</b> <Link href="/valued" className="underline">Everyone&apos;s finds</Link>.</p>
          <p><b>More tools:</b> <Link href="/worth" className="underline">What&apos;s it worth?</Link> for things at home, <Link href="/pile" className="underline">Sort the pile</Link> for a whole box at once.</p>
        </div>
        <p className="text-xs muted text-center">Not affiliated with Goodwill Industries International or any thrift store. Estimates, not guarantees.</p>
      </main>
    </div>
  );
}
