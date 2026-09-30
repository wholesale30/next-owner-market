import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "../../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import { HOWTO, GLOSSARY } from "@/lib/howto";
import ToolPitch from "@/components/ToolPitch";

export function generateStaticParams() { return Object.keys(HOWTO).map((app) => ({ app })); }

export async function generateMetadata({ params }: PageProps<"/sell-on/[app]">): Promise<Metadata> {
  const { app } = await params;
  const h = HOWTO[app];
  if (!h) return {};
  return { title: `How to sell on ${h.app} (step by step, for beginners)`, description: `Never sold on ${h.app}? Here's exactly what to tap, what it asks for at signup, what the fees are, and a free AI that writes your ${h.app} listing from photos.` };
}

export default async function SellOnPage({ params }: PageProps<"/sell-on/[app]">) {
  const { app } = await params;
  const h = HOWTO[app];
  if (!h) notFound();
  const supabase = await createClient();
  const [{ data: biz }, { data: { user } }] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const jsonLd = { "@context": "https://schema.org", "@type": "HowTo", name: `How to sell on ${h.app}`, description: h.bestFor, step: h.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })) };
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <p className="text-sm muted"><Link href="/sell-on" className="underline">How to sell on…</Link> › {h.app}</p>
        <h1 className="text-3xl font-extrabold leading-tight">How to sell on {h.app}</h1>
        <p className="text-sm"><b>Best for:</b> {h.bestFor}<br /><b>Fees:</b> {h.fees}</p>
        <div className="card p-4 space-y-3 text-sm">
          <p className="font-semibold text-base">The short version</p>
          <p>Take a few photos, write a title and description, set a price, pick shipping or pickup, tap Post. That&apos;s every marketplace. The rest of this page is where the buttons are on {h.app} and what the words mean. <b>Don&apos;t want to write it?</b> <Link href="/pro" className="underline">Our AI writes it from the photos</Link> and gives you a ready-to-paste {h.app} version.</p>
        </div>
        {h.firstTime && <section className="card p-4 space-y-2"><h2 className="font-bold text-lg">Never used {h.app}?</h2><ul className="list-disc pl-5 text-sm space-y-1">{h.firstTime.map((b, i) => <li key={i}>{b}</li>)}</ul></section>}
        <section className="card p-4 space-y-2"><h2 className="font-bold text-lg">Before you start</h2><ul className="list-disc pl-5 text-sm space-y-1">{h.before.map((b, i) => <li key={i}>{b.replace("from the copy above", "from your listing").replace("Save the item's photos to your phone (press and hold a photo above → Save).", "Have your photos on your phone.")}</li>)}</ul></section>
        <section className="card p-4 space-y-2"><h2 className="font-bold text-lg">Step by step</h2><ol className="list-decimal pl-5 text-sm space-y-2">{h.steps.map((b, i) => <li key={i}>{b.replace(/paste (the|it) .*?from the copy( above)?/i, "paste your title").replace("paste the rest of the copy", "paste your description").replace("paste the copy above", "paste your description")}</li>)}</ol></section>
        <section className="card p-4 space-y-2"><h2 className="font-bold text-lg">Tips from people who sell there every day</h2><ul className="list-disc pl-5 text-sm space-y-1">{h.tips.map((b, i) => <li key={i}>{b}</li>)}</ul></section>
        <details className="card p-4"><summary className="font-bold cursor-pointer">Words {h.app} uses, in plain English</summary><ul className="pt-2 text-sm space-y-1">{GLOSSARY.map(([w, d]) => <li key={w}><b>{w}:</b> {d}</li>)}</ul></details>
        <ToolPitch />
        <p className="text-xs muted">Other guides: {Object.entries(HOWTO).filter(([k]) => k !== app).map(([k, x], i, arr) => <span key={k}><Link href={`/sell-on/${k}`} className="underline">{x.app}</Link>{i < arr.length - 1 ? " · " : ""}</span>)}</p>
        <p className="text-xs muted">{h.app} is a trademark of its owner; we&apos;re not affiliated. Apps move buttons around; if a step looks different, the next one is usually right there. Guide at {site}/sell-on/{app}.</p>
      </main>
    </div>
  );
}
