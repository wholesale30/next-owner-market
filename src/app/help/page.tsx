import Link from "next/link";
import StoreHeader from "../StoreHeader";
import AskBox from "./AskBox";
import { TOPICS } from "@/lib/help";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Help" };

export default async function HelpPage() {
  const supabase = await createClient();
  const [{ data: biz }, { data: { user } }] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string; contact_email?: string; contact_phone?: string }) || { name: "Next Owner Market" };
  const groups: { title: string; who: "seller" | "buyer" | "all" }[] = [{ title: "Selling", who: "seller" }, { title: "Buying", who: "buyer" }, { title: "Shipping, pickup and safety", who: "all" }];
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">Help</h1>
          <p className="muted text-sm">Short answers, no jargon. Ask your own question at the top.</p>
        </div>
        <AskBox />
        {groups.map((g) => (
          <section key={g.who} className="space-y-2">
            <h2 className="font-bold text-lg">{g.title}</h2>
            {TOPICS.filter((t) => t.who === g.who).map((t) => (
              <details key={t.id} className="card p-3">
                <summary className="font-semibold cursor-pointer">{t.q}</summary>
                <div className="pt-2 space-y-1 text-sm">{t.a.map((p, i) => <p key={i}>{p}</p>)}</div>
              </details>
            ))}
          </section>
        ))}
        <div className="card p-4 text-sm space-y-1">
          <p className="font-semibold">Still stuck?</p>
          <p>{business.contact_email ? <>Email <a className="underline" href={`mailto:${business.contact_email}`}>{business.contact_email}</a>. </> : null}{business.contact_phone ? <>Call or text {business.contact_phone}. </> : null}Or <Link href="/looking-for" className="underline">send us a note</Link>.</p>
        </div>
      </main>
    </div>
  );
}
