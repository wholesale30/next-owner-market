import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import BuyPassClient from "./BuyPassClient";

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
      </main>
    </div>
  );
}
