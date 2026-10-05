import Link from "next/link";
import { getBusiness } from "@/lib/business";
import { PolicyPage, S } from "../PolicyPage";

export const metadata = { title: "Returns and refunds", description: "Not as described, damaged or never arrived: full refund, including shipping. How to start a return." };

export default async function ReturnsPage() {
  const b = await getBusiness();
  return (
    <PolicyPage business={b} title="Returns and refunds" updated="October 5, 2026">
      <div className="card p-4 space-y-1">
        <p className="text-base font-semibold">The short version</p>
        <p>If an item isn&apos;t as described, arrives damaged, or never arrives, you get a <b>full refund, including shipping</b>. If we need it back, we send you a prepaid return label. You pay nothing to return it.</p>
      </div>
      <S h="Items that are shipped">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Report a problem within 3 days after delivery.</b> Open your order (Account → My orders) and tap <b>Report a problem</b>, or contact us. Your payment stays on hold while we sort it out.</li>
          <li><b>Not as described or damaged:</b> full refund of the item price and shipping. If we ask for the item back, we email a prepaid return label, and the refund is sent when the return is on its way.</li>
          <li><b>Never arrived:</b> full refund if tracking doesn&apos;t show it delivered.</li>
          <li><b>No problem reported within 3 days after delivery:</b> the sale is final and the seller is paid.</li>
        </ul>
      </S>
      <S h="Local pickup">
        <ul className="list-disc pl-5 space-y-1">
          <li>You get a pickup code when you pay. Look the item over first. Only give the code once you&apos;re happy with it.</li>
          <li>If it isn&apos;t as described, don&apos;t give the code. Report a problem on the order and you get a full refund.</li>
          <li>If pickup doesn&apos;t happen within 7 days, you&apos;re refunded automatically.</li>
          <li>Once you give the code, the sale is final.</li>
        </ul>
      </S>
      <S h="Changed your mind?">
        <p>Most items are used and one of a kind, so we don&apos;t take returns for a change of mind. Read the description and look at the photos, and ask us anything before you buy. We&apos;re happy to answer.</p>
      </S>
      <S h="How refunds are paid">
        <ul className="list-disc pl-5 space-y-1">
          <li>Refunds go back to the card you paid with. Most banks show it within 5–10 business days.</li>
          <li>There are no restocking fees and no return shipping fees.</li>
        </ul>
      </S>
      <S h="Items from other sellers">
        <p>The same rules apply. We hold your payment until you have the item, so if something&apos;s wrong, the refund comes from us.</p>
      </S>
      <S h="Questions">
        <p>{b.contact_phone ? `Call or text ${b.contact_phone}` : ""}{b.contact_phone && b.contact_email ? " or email " : ""}{b.contact_email || ""}. <Link href="/contact" className="underline">Contact us</Link> · <Link href="/shipping" className="underline">Shipping</Link> · <Link href="/terms" className="underline">Terms</Link></p>
      </S>
    </PolicyPage>
  );
}
