import Link from "next/link";
import { getBusiness } from "@/lib/business";
import { PolicyPage, S } from "../PolicyPage";

export const metadata = { title: "Shipping and pickup", description: "Where we ship, what it costs, how long it takes, and how local pickup works." };

export default async function ShippingPage() {
  const b = await getBusiness();
  return (
    <PolicyPage business={b} title="Shipping and pickup" updated="October 5, 2026">
      <div className="card p-4 space-y-1">
        <p className="text-base font-semibold">The short version</p>
        <p>We ship within the United States. You see the exact shipping cost at checkout before you pay. Items sold by {b.name} ship within 1–3 business days, and most arrive 2–8 business days after that. Local pickup is free.</p>
      </div>
      <S h="Where we ship">
        <p>Anywhere in the United States. We don&apos;t ship outside the US. Each item page says <b>🚚 Ships</b> or <b>📍 Pickup</b>, or both. Very large or heavy items are pickup only.</p>
      </S>
      <S h="What it costs">
        <ul className="list-disc pl-5 space-y-1">
          <li>Shipping is figured from the item&apos;s weight and size and your ZIP code. You see the exact amount at checkout, before you pay.</li>
          <li>Items marked <b>Free shipping</b> cost nothing to ship.</li>
          <li>The total at checkout is everything you pay: the item plus shipping. There are no other fees.</li>
        </ul>
      </S>
      <S h="How long it takes">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Items sold by {b.name}:</b> packed and shipped within 1–3 business days after you pay (Monday to Friday, not holidays).</li>
          <li><b>Items from other sellers:</b> the seller ships and adds tracking. Your payment stays on hold until it&apos;s delivered.</li>
          <li><b>Delivery:</b> ground shipping usually takes 2–8 business days, depending on distance. Faster options show at checkout when they&apos;re available.</li>
          <li>You get a tracking number by email when it ships.</li>
        </ul>
      </S>
      <S h="Local pickup">
        <ul className="list-disc pl-5 space-y-1">
          <li>Free. The item page shows the pickup area{b.location ? ` (ours is ${b.location})` : ""}.</li>
          <li>After you pay, you get a pickup code and set up a time with the seller.</li>
          <li>Look the item over, then give the code. If pickup doesn&apos;t happen within 7 days, you&apos;re refunded automatically.</li>
        </ul>
      </S>
      <S h="Damaged or lost in shipping">
        <p>Report it within 3 days after delivery and you get a full refund. See <Link href="/returns" className="underline">returns and refunds</Link>.</p>
      </S>
      <S h="Questions">
        <p><Link href="/contact" className="underline">Contact us</Link>{b.contact_phone ? `: call or text ${b.contact_phone}` : ""}.</p>
      </S>
    </PolicyPage>
  );
}
