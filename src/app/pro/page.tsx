import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StoreHeader from "../StoreHeader";
import StartSelling from "../StartSelling";
import PlanButton from "./PlanButton";
import UsesMeter from "@/components/UsesMeter";
import { ALLOW_SELECT, allowanceFor } from "@/lib/usage";

export const metadata = { title: "Next Owner Pro: photos in, listings out", description: "Upload a pile of photos. The AI sorts them into items, cleans the backgrounds, writes every listing, and gives you ready-to-paste versions for eBay, Facebook, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, and Etsy. $15/month." };

export default async function ProPage() {
  const supabase = await createClient();
  const [{ data: biz }, { data: plans }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "plans").maybeSingle(),
  ]);
  const business = (biz?.value as { name: string; tagline?: string }) || { name: "Next Owner Market" };
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select(`${ALLOW_SELECT}`).eq("id", user.id).maybeSingle() : { data: null };
  const a = me ? allowanceFor(me) : null;
  const p = (plans?.value as { pro_monthly: number; pro_features: string[] }) || { pro_monthly: 15, pro_features: [] };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="text-center space-y-3 pt-4">
          <h1 className="text-3xl font-extrabold leading-tight">Photograph the pile.<br />Get the listings.</h1>
          <p className="text-lg muted">Upload 40 photos of 40 different things. The AI sorts them into items, writes the title, description, specs and price, and hands you ready-to-paste listings for nine marketplaces, each with a how-to. And it&apos;s listed in this store at the same time, <b>free</b>: no listing fee, ever. We only get paid when your item sells here.</p>
          <StartSelling signedIn={!!user} role={me?.role || null} className="btn btn-primary text-lg w-full" label={me?.role && me.role !== "buyer" ? "Go to my listings" : "Start free: 3 AI listings on us"} />
          <p className="text-sm"><a href="#plans" className="underline font-semibold">See plans and prices</a></p>
          <p className="text-xs muted">No card to start. Pro is ${p.pro_monthly}/month, cancel any time. <Link href="/why" className="underline">Why we built this</Link> · <Link href="/start" className="underline">Start with one box</Link></p>
        </section>


        <section className="grid grid-cols-1 gap-3">
          {[
            ["🖼 Dump a batch", "Pick a pile of photos from your gallery. The AI figures out which photos are the same item. Fix any with one tap."],
            ["✨ Listings written for you", "Title, description, brand, model, condition, specs, tags, a price range, and a warning if it's recalled or not allowed."],
            ["🎯 Clean backgrounds", "Every item cut out onto a plain background, on your phone, free. Listings that look like a store's."],
            ["📋 Nine marketplaces, one tap each", "Facebook Marketplace, eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, Etsy. Each copy is trimmed to that site's rules, with a plain-English how-to-post guide."],
            ["🏷 QR tags", "Print a tag, stick it on the item. Scan it and the listing opens. Track a garage or a warehouse."],
            ["🛒 Your own store with card checkout", "Buyers pay by card, Apple Pay, or Google Pay. Money is held until hand-off. No more no-shows, no Zelle screenshots."],
          ].map(([h, t]) => (
            <div key={h} className="card p-4"><p className="font-bold">{h}</p><p className="text-sm muted">{t}</p></div>
          ))}
        </section>

        <section id="plans" className="space-y-3 scroll-mt-4">
          <h2 className="text-2xl font-extrabold text-center">Pick what fits</h2>
          {a && a.kind !== "staff" && a.kind !== "comped" && <UsesMeter a={a} back="/pro" />}
          {a && (a.kind === "staff" || a.kind === "comped") && <p className="card p-3 text-sm text-center">✓ Everything is free for you.</p>}
          <p className="text-sm muted text-center">An <b>AI use</b> is one listing written, one lookup, one pile sorted, or one extra Buy or Pass check. Listing in our store is always free.</p>

          <div className="card p-4 space-y-1">
            <div className="flex items-baseline justify-between"><p className="font-bold text-lg">Free</p><p className="font-bold">$0</p></div>
            <p className="text-sm">3 AI uses to try it, 5 Buy or Pass checks a day, 10 live listings, card checkout, QR tags, messaging.</p>
            {!user && <StartSelling signedIn={false} role={null} className="btn btn-secondary w-full mt-1" label="Start free" />}
          </div>

          <div className="card p-4 space-y-1" style={{ borderColor: "var(--ok)", borderWidth: 2 }}>
            <div className="flex items-baseline justify-between"><p className="font-bold text-lg">Thrift Pro</p><p className="font-bold">$3.99/mo</p></div>
            <p className="text-sm">For thrift shoppers: up to <b>30 checks a day</b> on Buy or Pass and What&apos;s it worth. Other thrift apps charge $10 a week.</p>
            {a?.kind !== "thrift" && a?.kind !== "staff" && a?.kind !== "comped" && <PlanButton plan="thrift" label="Get Thrift Pro" />}
          </div>

          <div className="card p-4 space-y-2" style={{ borderColor: "var(--brand)", borderWidth: 3 }}>
            <div className="flex items-baseline justify-between"><p className="font-bold text-lg">Pro <span className="pill pill-active text-xs align-middle">Most popular</span></p><p className="font-bold">${p.pro_monthly}/mo</p></div>
            <ul className="text-sm space-y-1">{p.pro_features.map((f) => <li key={f}>✔ {f}</li>)}<li>✔ Invite a seller who goes Pro: you both get a month free</li></ul>
            {a?.kind !== "pro" && a?.kind !== "power" && a?.kind !== "staff" && a?.kind !== "comped" && <PlanButton plan="pro" label={`⭐ Go Pro: $${p.pro_monthly} a month`} primary />}
            {a?.kind === "pro" && <p className="text-sm font-semibold text-center" style={{ color: "var(--ok)" }}>✓ You&apos;re on Pro</p>}
          </div>

          <div className="card p-4 space-y-1">
            <div className="flex items-baseline justify-between"><p className="font-bold text-lg">Power Seller</p><p className="font-bold">$39/mo</p></div>
            <p className="text-sm">Everything in Pro with <b>1,000 AI uses a month</b>. For resellers, estates and warehouses listing every day.</p>
            {a?.kind === "power" ? <p className="text-sm font-semibold text-center" style={{ color: "var(--ok)" }}>✓ You&apos;re a Power Seller</p> : a?.kind !== "staff" && a?.kind !== "comped" && <PlanButton plan="power" label={a?.kind === "pro" ? "Move up to Power Seller" : "Get Power Seller"} />}
            {a?.kind === "pro" && <p className="text-xs muted text-center">Your $15 Pro stops automatically, so you&apos;re never billed twice.</p>}
          </div>

          <div className="card p-4 space-y-2">
            <p className="font-bold text-lg">Need a few more this month?</p>
            <p className="text-sm">Add AI uses any time. One payment, nothing monthly, and they <b>never expire</b>.</p>
            <div className="grid grid-cols-2 gap-2">
              <PlanButton pack={100} label="100 for $6.99" />
              <PlanButton pack={300} label="300 for $14.99" />
            </div>
          </div>
          <p className="text-xs muted text-center">Cancel any plan in one tap. No trial tricks.</p>
        </section>

        <section className="text-sm muted space-y-2">
          <p><b>Compared to the crosslisting apps:</b> List Perfectly charges $69+/month for AI listings. Vendoo and Voolist don&apos;t have a store or payments. None of them sort a pile of photos into items or clean the backgrounds.</p>
          <p><b>Selling through the store</b> pays a commission on the sale price only (15% self-listed), on any plan. Stripe fees are included; nothing else is added.</p>
        </section>
        <p className="text-center text-xs muted">Built by a 30-year surplus dealer in Virginia who got tired of listing one thing at a time.</p>
      </main>
    </div>
  );
}
