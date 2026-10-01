import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";
import CopyCode from "./CopyCode";

export const metadata = { title: "Put What's it worth? on your website (free widget)", description: "Add a free 'What's it worth?' button to your blog, estate-sale site, or reseller page. One line of code." };

export default async function EmbedPage() {
  const supabase = await createClient();
  const [{ data: biz }, { data: { user } }] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.auth.getUser()]);
  const business = (biz?.value as { name: string }) || { name: "Next Owner Market" };
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const iframe = `<iframe src="${site}/embed/worth" width="100%" height="230" style="border:0;max-width:440px" title="What's it worth? by Next Owner Market" loading="lazy"></iframe>`;
  const link = `<a href="${site}/worth">What's my stuff worth? Free photo valuation by Next Owner Market</a>`;
  return (
    <div className="flex-1">
      <StoreHeader business={business} signedIn={!!user} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div><h1 className="text-2xl font-extrabold">Put &quot;What&apos;s it worth?&quot; on your site</h1><p className="muted text-sm">Free. Good for estate-sale companies, reseller blogs, YouTubers, senior-move managers, church rummage pages, anyone whose readers have stuff. Your visitors get a free valuation; you get a useful tool on your page.</p></div>
        <div className="card p-4"><iframe src={`${site}/embed/worth`} width="100%" height="230" style={{ border: 0, maxWidth: 440 }} title="preview" /></div>
        <CopyCode label="The widget (paste into any page that allows HTML)" code={iframe} />
        <CopyCode label="Or just a link" code={link} />
        <div className="card p-4 text-sm space-y-1"><p className="font-semibold">How to add it</p><p><b>WordPress:</b> edit the page → add a &quot;Custom HTML&quot; block → paste. <b>Squarespace / Wix:</b> add an &quot;Embed&quot; or &quot;Code&quot; element → paste. <b>Shopify:</b> Online store → Pages → edit → the &lt;&gt; button → paste. <b>Blogger:</b> HTML view → paste.</p></div>
      </main>
    </div>
  );
}
