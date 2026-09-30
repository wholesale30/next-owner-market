import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import PileClient from "./PileClient";

export const metadata = { title: "Sort the Pile: what to keep, sell, donate, toss", description: "Photograph a box, a shelf, a garage corner. Get every item listed with what it's worth and whether to keep, sell, donate, or toss it. Free to try." };

export default async function PilePage() {
  const supabase = await createClient();
  const [me, { data: biz }] = await Promise.all([getProfile(), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!me} />
      <section className="hero"><div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight">Sort the pile.</h1>
        <p className="opacity-90">A box from the attic, a shelf, a whole garage corner. Photograph it. We list every item, what it&apos;s worth, and whether to keep it, sell it, donate it, or toss it. Then list the good ones in one tap.</p>
      </div></section>
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <PileClient meId={me?.id || null} role={me?.role || null} />
      </main>
    </div>
  );
}
