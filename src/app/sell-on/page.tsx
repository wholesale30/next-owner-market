import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import { HOWTO } from "@/lib/howto";
import ToolPitch from "@/components/ToolPitch";

export const metadata = { title: "How to sell on eBay, Poshmark, Mercari, Facebook and more (beginner guides)", description: "Step-by-step, plain-English guides to listing on nine marketplaces, written for people who've never sold online. Plus a free AI that writes the listing for you." };

export default async function SellOnIndex() {
  const supabase = await createClient();
  const [{ data: biz }, { data: { user } }] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div><h1 className="text-2xl font-extrabold">How to sell on…</h1><p className="muted text-sm">Beginner guides for nine marketplaces: what the app asks for, what the words mean, where the buttons are. No experience needed.</p></div>
        <ul className="grid grid-cols-2 gap-2">
          {Object.entries(HOWTO).map(([k, h]) => <li key={k}><Link href={`/sell-on/${k}`} className="card p-3 block"><p className="font-bold">{h.app}</p><p className="text-xs muted line-clamp-2">{h.bestFor}</p></Link></li>)}
        </ul>
        <ToolPitch />
      </main>
    </div>
  );
}
