import type { Metadata } from "next";
import Link from "next/link";
import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI selling tools: list one item, list a whole box, what's it worth",
  description: "Free AI tools for selling your stuff: write a listing from one photo for 9 sites, list a whole box at once, find out what something is worth, and decide if a thrift find is worth buying.",
};

export default async function ToolsPage() {
  const sb = await createClient();
  const [{ data: { user } }, { data: biz }] = await Promise.all([sb.auth.getUser(), sb.from("settings").select("value").eq("key", "business").maybeSingle()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const tools = [
    { href: user ? "/app/items/new" : "/try", icon: "📸", name: "List one item", what: "Pick a photo. The AI writes the title, description and price, plus ready-to-paste versions for Facebook, eBay and 7 more sites.", tag: "Start here", main: true },
    { href: "/pile", icon: "📦", name: "List a whole box", what: "Photos of a shelf, a box, a table of stuff. It sorts every item into sell, keep, donate or toss, with a value for each, and lists the ones worth selling." },
    { href: "/worth", icon: "💰", name: "What's it worth?", what: "One item, the deep look: what it is, the year, a realistic price range, why, and where it sells best." },
    { href: "/buy-or-pass", icon: "🛒", name: "Should I buy it?", what: "At a thrift store or yard sale? Snap it and see what it resells for after fees, and a clear buy or pass. First one free, no account; then 5 free every day." },
    { href: "/sell-on", icon: "🧭", name: "How to post on each app", what: "Step-by-step, screen by screen, for Facebook, eBay, OfferUp, Mercari, Poshmark and the rest. Written for first-timers." },
    { href: "/start", icon: "😮‍💨", name: "Overwhelmed? Start with one box", what: "Garage, attic, a parent's house: eight small steps that get you from stuck to your first sale." },
    { href: "/valued", icon: "📚", name: "What things are worth", what: "Real items people valued with the tool. Browse to get a feel for prices." },
  ];
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">AI tools that do the work</h1>
          <p className="muted">Never sold online before? Tap <b>List one item</b>. Everything is explained as you go.</p>
        </div>
        <ul className="space-y-3">
          {tools.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="card p-4 flex gap-3 items-start" style={t.main ? { borderColor: "var(--brand)", borderWidth: 2 } : undefined}>
                <span className="text-4xl leading-none">{t.icon}</span>
                <span className="space-y-1">
                  <span className="flex items-center gap-2"><span className="text-lg font-bold">{t.name}</span>{t.tag && <span className="pill pill-active">{t.tag}</span>}</span>
                  <span className="block text-sm muted">{t.what}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="card p-4 space-y-2">
          <p className="font-bold">Free vs Pro</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="font-semibold">Free</p><ul className="muted space-y-1"><li>✔ 1 try, no account</li><li>✔ 3 AI listings with an account</li><li>✔ Facebook copy-and-paste</li><li>✔ List in our store, always free</li></ul></div>
            <div><p className="font-semibold">Pro · $15/month</p><ul className="muted space-y-1"><li>✔ 300 AI uses a month</li><li>✔ All 9 sites, ready to paste</li><li>✔ List a whole box</li><li>✔ Cancel any time</li></ul></div>
          </div>
          <Link href="/pro" className="btn btn-secondary w-full">See Pro</Link>
        </div>
      </main>
    </div>
  );
}
