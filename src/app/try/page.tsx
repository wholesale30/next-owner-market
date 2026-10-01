import type { Metadata } from "next";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import TryClient from "./TryClient";

export const metadata: Metadata = {
  title: "Try it free: snap a photo, get a ready-to-post listing",
  description: "Pick one photo. In about 30 seconds the AI writes the title, description and price, plus ready-to-paste versions for Facebook, eBay, OfferUp, Mercari, Poshmark and 4 more. No account needed.",
};

export default async function TryPage() {
  const sb = await createClient();
  const [{ data: { user } }, { data: biz }] = await Promise.all([sb.auth.getUser(), sb.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-xl mx-auto px-4 py-6">
        <TryClient signedIn={!!user} />
      </main>
    </div>
  );
}
