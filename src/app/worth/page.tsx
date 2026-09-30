import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import WorthClient from "./WorthClient";

export const metadata = { title: "What's it worth?", description: "Take a photo of anything in your house and find out what it's worth and where to sell it. Free." };

export default async function WorthPage() {
  const supabase = await createClient();
  const [me, { data: biz }] = await Promise.all([getProfile(), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const staff = me?.role === "admin" || me?.role === "staff";
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!me} />
      <section className="hero">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">What&apos;s it worth?</h1>
          <p className="opacity-90">Snap a photo of anything in your house. We tell you what it is, what it&apos;ll sell for, and where. No listing needed.</p>
        </div>
      </section>
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <WorthClient meId={me?.id || null} role={me?.role || null} credits={staff || me?.plan === "pro" ? null : me?.ai_credits ?? 3} />
      </main>
    </div>
  );
}
