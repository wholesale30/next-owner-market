import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Why we built this", description: "Three warehouses, 400 pallets, and no idea where to start. Next Owner Market exists because 'I know this stuff is worth money but I don't know how to sell it' is the most common feeling in America. We built the way out." };

export default async function WhyPage() {
  const supabase = await createClient();
  const [{ data: biz }, { data: { user } }] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <section className="hero"><div className="max-w-2xl mx-auto px-4 pt-8 pb-6 space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] opacity-80">Why we built this</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">It&apos;s not that you don&apos;t know it&apos;s worth money.<br />It&apos;s that you don&apos;t know where to start.</h1>
      </div></section>
      <main className="max-w-2xl mx-auto p-4 space-y-6 text-[17px] leading-relaxed">
        <article className="space-y-4">
          <p>I&apos;ve been in surplus for thirty years. Right now I have three warehouses, 25,000 square feet each, and somewhere between 350 and 400 pallets of stuff in them. Tools, stereo gear, lamps, parts, kitchen things, boxes I haven&apos;t opened in years. All of it worth something. All of it sitting there.</p>
          <p>For a long time I couldn&apos;t make myself start. Not because I didn&apos;t know how to sell things; I&apos;ve sold things my whole life. It was the size of it. Four hundred pallets, and every single item needs a photo, a title, a description, a price, and then you do it again on the next site, and the next. Look at that mountain long enough and you stop looking. You get depressed about it. You tell yourself you&apos;ll get to it.</p>
          <p>That&apos;s the feeling this site was built to kill.</p>
          <p>And I know I&apos;m not the only one. Maybe for you it&apos;s not a warehouse. It&apos;s a garage. An attic. A basement. A storage unit you&apos;re paying $180 a month for. A parent&apos;s house after they&apos;re gone, full of sixty years of things, and you standing in the doorway not knowing whether to call a dumpster or a dealer. You know there&apos;s money in there. You don&apos;t want to give it away or throw it out. And you have no idea how to go about it, so it sits. That&apos;s where hoarding comes from, most of the time: not from loving stuff, from being overwhelmed by it.</p>
          <p>So we built the tool I needed. You take pictures. It tells you what the thing is, what it&apos;s worth, and whether to sell it, keep it, donate it, or toss it. If it&apos;s worth selling, it writes the listing for you: title, description, price. It gives you a copy for eBay, Facebook, Poshmark, Mercari, and the rest, and it tells you exactly which buttons to press on each one, in plain words, because most people have never done it and the apps assume you have. And it lists it in our store, for free, where buyers pay by card and the money is held until you hand the thing over, so nobody gets burned.</p>
          <p>The first time I ran it on a shelf and watched it write nine listings while I stood there, something changed. I wasn&apos;t depressed about the warehouse anymore. I was energized. I could see the end of it. That&apos;s the whole point. Not the AI, not the marketplace. The feeling that you can actually do this.</p>
          <p>Everything here is written for the person who&apos;s never sold anything online. If a word needs explaining, there&apos;s a ? next to it. If a screen needs a hint, it&apos;s at the top. If you&apos;d rather talk than type, there&apos;s a mic. You don&apos;t need to know what a SKU is. You need a phone and a box.</p>
          <p>And if you&apos;re on the other side of it, the buyer, you get something too: real stuff, from real people, at what it&apos;s actually worth, with your money protected until it&apos;s in your hands. Good deals from people who were finally able to let go.</p>
          <p className="font-semibold">Start with one box. That&apos;s all it takes to feel it.</p>
          <p className="muted">— Shayne, Next Owner Market</p>
        </article>
        <div className="grid grid-cols-1 gap-2">
          <Link href="/start" className="btn btn-primary text-lg">Start with one box</Link>
          <div className="flex gap-2"><Link href="/pile" className="btn btn-secondary flex-1">Sort the pile</Link><Link href="/worth" className="btn btn-secondary flex-1">What&apos;s it worth?</Link></div>
        </div>
      </main>
    </div>
  );
}
