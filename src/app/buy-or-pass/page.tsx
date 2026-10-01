import { redirect } from "next/navigation";
import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient, getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { BP_FREE_DAILY, claimScan, listFromScan, since } from "@/lib/thrift";
import BuyPassClient from "./BuyPassClient";
import ToolGuide from "@/components/ToolGuide";

export const dynamic = "force-dynamic";
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const metadata = { title: "Buy or Pass: is this thrift find worth flipping?", description: "Point your phone at anything in a thrift store or yard sale. See what it resells for, the fees, shipping, and your profit. Buy or pass, in 10 seconds." };

export default async function BuyPassPage({ searchParams }: PageProps<"/buy-or-pass">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [me, { data: biz }] = await Promise.all([getProfile(), supabase.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const claim = typeof sp.claim === "string" ? sp.claim : null;
  if (me && claim) {
    await claimScan(me.id, claim);
    if (sp.list === "1") { const r = await listFromScan(me, claim); if (r.item_id) redirect(`/app/items/${r.item_id}/edit`); }
  }
  const d = admin();
  const weekAgo = since(7 * 86400_000);
  const [{ count: weekChecks }, mine, myPages] = await Promise.all([
    d.from("buy_pass_scans").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    me ? d.from("buy_pass_scans").select("id, what, verdict, net_low, net_high, paid, bought, item_id, photo_url, created_at").eq("owner_id", me.id).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: null }),
    me ? d.from("valuations").select("id", { count: "exact", head: true }).eq("owner_id", me.id) : Promise.resolve({ count: 0 }),
  ]);
  const pages = myPages.count || 0;
  const finds = mine.data || [];
  const unlimited = !!me && (me.plan === "pro" || !!me.thrift_pro || me.role === "admin" || me.role === "staff");
  const today = finds.filter((f) => f.created_at > since(86400_000)).length;
  const freeLeft = me && !unlimited ? Math.max(0, BP_FREE_DAILY - today) : null;
  const buys = finds.filter((f) => f.verdict === "buy");
  const found = buys.reduce((a, f) => a + Number(f.net_low || 0), 0);
  const avoided = finds.filter((f) => f.verdict === "pass" && f.paid).reduce((a, f) => a + Number(f.paid || 0), 0);
  // Flipper badge: starts partly done (the first check counts) so finishing feels close
  const badge = Math.min(10, finds.length + 1);
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!me} />
      <section className="hero"><div className="max-w-2xl mx-auto px-4 pt-6 pb-5 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight">Buy or pass?</h1>
        <p className="opacity-90">In the thrift store, at the yard sale. One photo, what you&apos;d pay, and you get: resale range, fees, shipping, profit. Buy or pass.</p>
      </div></section>
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {!!finds.length && (
          <div className="card p-3 space-y-2">
            <div className="flex justify-between items-baseline"><p className="font-bold">Your finds</p><p className="text-xs muted">{finds.length} checked</p></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xl font-extrabold" style={{ color: "var(--ok)" }}>{money(found)}</p><p className="text-xs muted">profit spotted</p></div>
              <div><p className="text-xl font-extrabold">{buys.length}</p><p className="text-xs muted">BUYs found</p></div>
              <div><p className="text-xl font-extrabold">{money(avoided)}</p><p className="text-xs muted">not wasted on PASSes</p></div>
            </div>
            <p className="text-sm">📣 {pages ? <>Your shares made <b>{pages}</b> page{pages === 1 ? "" : "s"} people can find on Google. Keep sharing!</> : "Share a find and it gets its own page on Google."}</p>
            {badge < 10 ? <div><p className="text-xs font-semibold">🏅 Flipper badge: {badge} of 10 checks</p><div className="h-2 rounded-full mt-1" style={{ background: "var(--line)" }}><div className="h-2 rounded-full" style={{ width: `${badge * 10}%`, background: "var(--ok)" }} /></div></div> : <p className="text-sm font-semibold">🏅 Flipper badge earned. You check before you buy.</p>}
            <details><summary className="text-xs underline cursor-pointer">See them</summary>
              <div className="space-y-1 pt-2">{finds.slice(0, 30).map((f) => <div key={f.id} className="flex items-center gap-2 text-sm">{f.photo_url && <img src={f.photo_url} alt="" className="w-9 h-9 rounded object-cover" />}<span className="flex-1 truncate">{f.what}</span><b style={{ color: f.verdict === "buy" ? "var(--ok)" : f.verdict === "pass" ? "var(--danger)" : "var(--accent)" }}>{String(f.verdict).toUpperCase()}</b>{f.item_id ? <Link href={`/app/items/${f.item_id}/edit`} className="text-xs underline">listing</Link> : null}</div>)}</div>
            </details>
          </div>
        )}
        <BuyPassClient meId={me?.id || null} refCode={(me as { referral_code?: string } | null)?.referral_code || null} freeLeft={freeLeft} inRef={typeof sp.ref === "string" ? sp.ref.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) : ""} />
        {(weekChecks || 0) >= 20 && <p className="text-center text-sm muted">{(weekChecks || 0).toLocaleString()} finds checked this week</p>}
        <ToolGuide
          intro={[
            "You're standing in a thrift store holding a lamp with a $12 tag, thinking: could I sell this for $40? This answers that before you reach the register. One photo and the price they're asking, and it tells you what the thing resells for, which site it sells best on, what that site's fees and shipping will eat, and what's left for you. Then a straight answer: BUY, MAYBE, or PASS.",
            "It's built for beginners, so the fee math is shown, not hidden. You'll learn the rules of each marketplace just by using it.",
          ]}
          steps={[
            { title: "Photograph the item", body: "The whole thing, plus the label or model number if there is one. One to four photos." },
            { title: "Type what they're asking", body: "The price on the tag. Optional note: works, missing the cord, has the box." },
            { title: "Tap Buy or pass?", body: "You get the resale range, the best place to sell, that place's fees, shipping if it ships, and your profit range. BUY means the low end still clears about $15 after everything." },
            { title: "Bought it? List it now", body: "Tap I bought it. It becomes a listing with your photo, the price, and what you paid already filled in, so your profit shows up on the Year page." },
          ]}
          examples={[
            { title: "Vintage Pyrex bowl, $4 tag", result: "Resells $25–$45 on eBay. Fees and shipping about $12. Profit $9–$29. BUY." },
            { title: "Cuisinart food processor, $18 tag, no blade", result: "Resells $20–$35 local. Missing blade hurts. Profit $2–$17. MAYBE; check for the blade in the box." },
            { title: "Particleboard bookshelf, $25", result: "Resells $15–$30 local only, heavy, slow. PASS." },
          ]}
          faq={[
            { q: "Where do the fees come from?", a: "A fee table we keep current for eBay, Mercari, Poshmark, Facebook Marketplace, and our own store. It's shown under every result so you can check our math. Marketplaces change fees; we re-check them regularly." },
            { q: "How accurate is the resale range?", a: "Good for common stuff (tools, kitchen, electronics, brand-name goods). Weaker for vintage, pottery, and toys, where a maker's mark can change everything. Look at the confidence and the warning line." },
            { q: "What does MAYBE mean?", a: "It could clear $15 if everything goes right, but the low end doesn't. Worth it if you can negotiate the price down or you already know the item." },
            { q: "Does it cost anything?", a: `Your first check is free with no account. With a free account you get ${BP_FREE_DAILY} free checks every day, forever, with no card. Pro is unlimited and also writes unlimited listings for nine marketplaces. No trial tricks: cancel in one tap.` },
            { q: "Why is this free when other thrift apps charge $10 a week?", a: "We make money when you sell, not when you scan. If you buy it, one tap turns the photo into a listing on our store (free to list) and on eBay, Facebook and more." },
          ]}
          related={[{ href: "/worth", label: "What's it worth?" }, { href: "/pile", label: "Sort the pile" }, { href: "/sell-on", label: "How to sell on each marketplace" }]}
        />
      </main>
    </div>
  );
}
