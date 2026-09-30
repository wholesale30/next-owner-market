import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import PileClient from "./PileClient";
import ToolGuide from "@/components/ToolGuide";

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
        <ToolGuide
          intro={[
            "This is for the garage you can't look at. The attic. The storage unit. The parent's house. A warehouse, if that's your life. You know there's money in there and you don't want to throw it away, but the size of the job has kept you from starting. Sort the pile makes the job small: one box, one shelf, one corner at a time.",
            "Photograph the box. It lists every item it can identify, what each one is worth, and a plain label: Sell (worth listing), Keep (worth more to you than the market), Donate (usable, not worth your time), or Toss (broken or worthless). Anything that might be valuable gets flagged for an expert. Then the Sell ones become listings in one tap, already written. Do the next box tomorrow.",
          ]}
          steps={[
            { title: "Pick one box, shelf, or corner", body: "Not the whole room. Small enough to photograph well. You'll get faster with every box." },
            { title: "Photograph it", body: "A wide shot first, then closer ones so labels are readable. Up to ten photos. Spread things out a little if they're stacked." },
            { title: "Tap Sort it", body: "About a minute later: every item, a value range, a label, and a one-line reason. A total at the top for what's sellable." },
            { title: "Fix what it got wrong", body: "Tap a different label on anything you disagree with. You know your stuff; it's making a first pass." },
            { title: "List the Sell ones", body: "One tap makes a draft listing for each, with the photo, a title, a description, and a price. Open each, read it, tap List. Done with the box." },
          ]}
          examples={[
            { title: "A shelf in Dad's garage (7 photos)", result: "14 items found. Sell: table saw ($120–$200), two Craftsman tool sets, a Coleman lantern. Keep: his hand-made level. Donate: 6 coffee mugs, extension cords. Toss: a cracked shop vac. Sellable total: about $310–$520." },
            { title: "Two boxes from the attic", result: "Sell: a Pyrex bowl set ($40–$80), a Fisher-Price record player. Donate: a bag of kids' clothes. Toss: a water-damaged photo album (⚠ keep the photos)." },
          ]}
          faq={[
            { q: "How many items can it find in one go?", a: "Up to about 25 per scan. For a big shelf, take more photos from closer; for a whole room, do it in sections." },
            { q: "What do the labels mean?", a: "Sell: worth listing, usually $15 and up. Keep: sentimental or worth more to a person than the market pays. Donate: usable but not worth your time to list. Toss: broken, unsafe, or worthless. You can change any of them." },
            { q: "It marked something Toss that I know is valuable", a: "Tap Sell. It's working from a photo; you have the history. If it's possibly rare, it should have flagged it for an expert; if it didn't, take a close-up and run that item alone through What's it worth?" },
            { q: "Does listing them cost anything?", a: "No. Listing in the store is free on any plan; we only get paid when something sells. The scan itself uses one AI lookup (three free, then Pro for unlimited)." },
            { q: "I'm cleaning out a parent's house. Where do I start?", a: "Start with one box, the one nearest the door. Read Start with one box: it's the eight-step path, written for exactly this." },
            { q: "Can I just donate or toss it all?", a: "You can, and for some boxes that's the right call; it'll tell you. But most garages have a few hundred dollars hiding in them, and this finds it in a minute." },
          ]}
          related={[{ href: "/start", label: "Start with one box" }, { href: "/worth", label: "What's it worth? (one item)" }, { href: "/why", label: "Why we built this" }]}
        />
      </main>
    </div>
  );
}
