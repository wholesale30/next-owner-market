import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import { allowanceFor } from "@/lib/usage";
import { countLookups, getLookup } from "@/lib/lookups";
import { FINDER_FEE } from "@/lib/find";
import ToolGuide from "@/components/ToolGuide";
import FindClient, { type FindOut } from "./FindClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Find it for less: the right part at the lowest price",
  description: "Need a part, a bulb, a filter or a replacement anything? Tell us or snap a photo. We find the exact part, the lowest prices at Amazon, Walmart, Home Depot and more, and show you how to put it in yourself.",
};

export default async function FindPage({ searchParams }: PageProps<"/find">) {
  const sp = (await searchParams) as { open?: string; q?: string };
  const supabase = await createClient();
  const [me, { data: biz }] = await Promise.all([getProfile(), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const a = me ? allowanceFor(me) : null;
  const [saved, nSaved] = me ? await Promise.all([sp.open ? getLookup(sp.open, me.id) : Promise.resolve(null), countLookups(me.id)]) : [null, 0];
  const initial = saved && saved.tool === "find" ? ({ ...(saved.result as FindOut), lookup_id: saved.id } as FindOut) : null;
  const startQ = typeof sp.q === "string" ? sp.q.slice(0, 300) : "";
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!me} />
      <section className="hero">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">Find it for less</h1>
          <p className="opacity-90">Need a part, a bulb, a filter? Tell us or snap a photo. We find the exact one, the lowest price, and how to put it in yourself.</p>
        </div>
      </section>
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <FindClient meId={me?.id || null} plan={a?.kind || null} initial={initial} startQ={startQ} feeText={FINDER_FEE.text} key={initial?.lookup_id || "new"} />
        {me && nSaved > 0 && <Link href="/lookups" className="card p-3 flex items-center justify-between font-semibold" style={{ minHeight: 52 }}><span>📂 My saved lookups ({nSaved})</span><span className="muted text-sm">See them ›</span></Link>}
        <ToolGuide
          intro={[
            "The dealer wanted $750 for the EGR valve on a 2012 Prius. The same part was $80 on Amazon, and it went in with basic hand tools. That's what this is for.",
            "Tell it what you need, in your own words or with a photo of the old part or its label. It works out the exact part, checks real stores right now, shows you the lowest prices side by side, what a shop would charge, and whether you can do the job yourself.",
          ]}
          steps={[
            { title: "Say what you need", body: "Type it, tap the mic and say it, or add a photo of the old part or its label. Brand, model or year helps." },
            { title: "Tap Find it for less", body: "It checks Amazon, Walmart, Home Depot, Lowe's, eBay and specialty stores. About 20 seconds." },
            { title: "Pick a store", body: "Cheapest first. Each one opens right at that store. Check the specs list so you get the right one." },
            { title: "Do it yourself, or let us", body: "See the tools, the steps and a how-to video. Too much hassle? Tap Find it for me and we'll track it down." },
          ]}
          examples={[
            { title: "2012 Prius EGR valve", result: "Aftermarket on eBay about $77, genuine Toyota about $180. Shops charge $770 to $920 installed. Medium job, 2 to 3 hours." },
            { title: "LED bulb for a 500W halogen work light", result: "R7S 118mm 50W LED, $15 to $40. Measure the old bulb first: 118mm, not 78mm. 5 minute swap." },
            { title: "Dyson V8 battery", result: "Genuine and well rated third party batteries side by side, with the screws you need and a 10 minute swap." },
          ]}
          faq={[
            { q: "Are these real prices?", a: "Yes. It searches stores live every time. Prices change fast, so the store's own page has the final price." },
            { q: "Does it cost anything?", a: "Your first find is free with no account. After that each find is one AI use (free accounts start with some, Pro gets 300 a month)." },
            { q: "What's Find it for me?", a: FINDER_FEE.text },
            { q: "Do you make money from the links?", a: "Some store links may pay us a small commission at no cost to you. It never changes the order: cheapest good option is always first." },
          ]}
          related={[{ href: "/worth", label: "What's it worth?" }, { href: "/buy-or-pass", label: "Buy or pass?" }, { href: "/looking-for", label: "Looking for something?" }]}
        />
      </main>
    </div>
  );
}
