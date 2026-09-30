import StoreHeader from "../StoreHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Privacy Policy" };

function S({ h, children }: { h: string; children: React.ReactNode }) { return <section className="space-y-2"><h2 className="font-semibold text-lg">{h}</h2>{children}</section>; }

export default async function PrivacyPage() {
  const supabase = await createClient();
  const { data: biz } = await supabase.from("settings").select("value").eq("key", "business").maybeSingle();
  const business = (biz?.value as { name: string; address?: string; contact_email?: string }) || { name: "Next Owner Market" };
  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-3xl mx-auto p-4 space-y-6 text-sm">
        <div><h1 className="text-2xl font-bold">Privacy Policy</h1><p className="muted">Next Owner Market · Last updated September 30, 2026 · {business.name}{business.address ? `, ${business.address}` : ""}{business.contact_email ? ` · ${business.contact_email}` : ""}</p></div>
        <S h="What we collect">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Account:</b> name, email, phone, city/state/ZIP, password (stored hashed; we can&apos;t read it).</li>
            <li><b>Listings and orders:</b> what you list, buy, offer, message, rate, and report.</li>
            <li><b>Shipping address</b> when you choose shipping at checkout; shown only to that order&apos;s seller.</li>
            <li><b>Payment and identity details are collected by Stripe</b>, our payment processor, under Stripe&apos;s privacy policy. We never see card numbers, bank accounts, or ID documents.</li>
            <li><b>Photos and video</b> you upload for listings.</li>
            <li><b>Technical:</b> IP address and device/browser type in server logs, kept briefly for security.</li>
          </ul>
        </S>
        <S h="How we use it">
          <ul className="list-disc pl-5 space-y-1">
            <li>Run the marketplace: show listings, process orders, hold and release payments, deliver messages, resolve problems.</li>
            <li>Send transactional email and texts: order updates, replies, pickup codes, alerts you set up, password resets.</li>
            <li>Send &quot;new arrivals&quot; marketing email only to people who signed up, bought, messaged, or asked us to find something. Every one has an unsubscribe link.</li>
            <li>Write listings with AI: photos you upload are sent to an AI service (Anthropic) to draft the listing. They are not used to train models.</li>
            <li>Prevent fraud: seller verification through Stripe, ratings, and staff review.</li>
          </ul>
        </S>
        <S h="What other people see">
          <ul className="list-disc pl-5 space-y-1">
            <li>Buyers see a seller&apos;s display name, city/state, rating, and sales count. Never email, phone, or street address.</li>
            <li>Sellers see a buyer&apos;s first name, city/state, and rating. A shipping address only after payment, only for that order.</li>
            <li>Phone numbers and emails typed into listings or messages are removed automatically.</li>
            <li>Staff can see contact details to mediate problems.</li>
          </ul>
        </S>
        <S h="Who we share it with">
          <p>Only the services that run the site: Stripe (payments and payouts), Supabase (database and file storage), Vercel (hosting), Resend (email), Anthropic (AI listing writer), and Shippo (shipping labels, if used). Each sees only what it needs. We never sell your information and never share your list with anyone.</p>
        </S>
        <S h="Your choices">
          <ul className="list-disc pl-5 space-y-1">
            <li>Unsubscribe from marketing email with the link in any message.</li>
            <li>Edit your name, phone, and location in your account.</li>
            <li>Ask us to delete your account and data by emailing {business.contact_email || "us"}; order and payout records are kept as long as tax law requires.</li>
          </ul>
        </S>
        <S h="Kids">
          <p>The site is for adults 18 and over. We don&apos;t knowingly collect information from anyone younger.</p>
        </S>
        <S h="Changes">
          <p>If this policy changes in a way that matters, we&apos;ll say so on the site. Questions: {business.contact_email || "use the contact on the store page"}.</p>
        </S>
      </main>
    </div>
  );
}
