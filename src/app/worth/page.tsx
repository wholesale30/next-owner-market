import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import WorthClient from "./WorthClient";
import ToolGuide from "@/components/ToolGuide";
import { allowanceFor } from "@/lib/usage";

export const metadata = { title: "What's it worth?", description: "Take a photo of anything in your house and find out what it's worth and where to sell it. Free." };

export default async function WorthPage() {
  const supabase = await createClient();
  const [me, { data: biz }] = await Promise.all([getProfile(), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const a = me ? allowanceFor(me) : null;
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
        <WorthClient meId={me?.id || null} role={me?.role || null} credits={!a || a.left == null ? null : a.left} plan={a?.kind || null} />
        <ToolGuide
          intro={[
            "Everybody has a thing they've wondered about. The stereo in the basement. Grandma's lamp. The drill in the garage with the dead battery. Is it worth anything? Is it worth the trouble of selling? This page answers that in about thirty seconds, from a photo, for free.",
            "It works like an appraiser who's seen a million garage sales: it reads the labels and model numbers in your photo, figures out what the item is and roughly when it was made, and tells you what it sells for used, right now, as a range. Then it tells you where it sells best, what would raise the price, and whether it's worth shipping or should stay local. If you decide to sell, one tap turns the answer into a finished listing.",
          ]}
          steps={[
            { title: "Take a few photos", body: "One of the whole item, then close-ups of any label, model number, or damage. Up to six. Phone flat, decent light. You don't need to clean it first." },
            { title: "Add a note if you have one", body: "\"Works,\" \"missing the lid,\" \"was my dad's.\" Talk instead of typing if you like; tap the mic." },
            { title: "Tap What's it worth?", body: "You get what it is, a low-to-high value, why, where it sells best, and any warning (recalls, fakes, hard to ship)." },
            { title: "Sell it, or don't", body: "List it now makes the listing for you: photos, title, description, price. Or just know, and walk away smarter. Your call." },
          ]}
          examples={[
            { title: "1978 Pioneer SX-780 stereo receiver, works", result: "Worth about $150–$260. Best on eBay (ships fine, national buyers). Clean the faceplate and show it powered on for the top of the range." },
            { title: "Craftsman 19.2V drill, no charger", result: "Worth about $15–$30. Facebook Marketplace, local pickup. Find the charger and it doubles." },
            { title: "Box of mixed Christmas decorations", result: "About $10–$25 as a lot. Donate or sell as one bundle; not worth listing one by one." },
          ]}
          faq={[
            { q: "Is this a real appraisal?", a: "No. It's an estimate from photos, the way an experienced dealer would eyeball it. It's good enough to decide whether to sell and roughly what to ask. For jewelry, art, coins, or anything possibly rare, it will tell you to get a specialist, and you should." },
            { q: "Why a range instead of one number?", a: "Because that's the truth. The same item sells for different amounts depending on the day, the buyer, the photos, and whether it's local or shipped. The low end is a quick sale; the high end is patience and a good listing." },
            { q: "Does it cost anything?", a: "Your first three lookups are free with a free account. After that, Pro is $15 a month for 300 AI uses (lookups and AI-written listings) plus the copy-and-paste versions for nine marketplaces. Fixing an answer with Something wrong? is free twice per lookup. Listing in our store is free on any plan." },
            { q: "What happens to my photos?", a: "They're stored so the result can be saved to your account. Nothing is public unless you tick \"share it,\" and even then there's no name on it." },
            { q: "What if it's wrong?", a: "Take a clearer photo of the label or add a note about what it is. It reads what it can see. And it's honest: if it can't tell, it says so with a lower confidence." },
            { q: "I have a whole pile, not one thing", a: "Use Sort the pile instead. Photograph the box or shelf and it lists every item with what it's worth and whether to sell, keep, donate, or toss it." },
          ]}
          related={[{ href: "/pile", label: "Sort the pile" }, { href: "/buy-or-pass", label: "Buy or pass?" }, { href: "/valued", label: "What things are worth (real examples)" }, { href: "/start", label: "Start with one box" }]}
        />
      </main>
    </div>
  );
}
