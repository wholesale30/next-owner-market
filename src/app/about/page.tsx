import Link from "next/link";
import { getBusiness } from "@/lib/business";
import { PolicyPage, S } from "../PolicyPage";

export const metadata = { title: "About us", description: "Who we are: a Richmond, Virginia seller of used, surplus and vintage goods, and a local marketplace." };

export default async function AboutPage() {
  const b = await getBusiness();
  return (
    <PolicyPage business={b} title="About us">
      <S h="Who we are">
        <p>{b.name} is a small business{b.location ? ` in ${b.location}` : ""}. We sell used, surplus and vintage goods: electronics, audio gear, tools, home goods and more, much of it from our own warehouse. We also run a marketplace where local people and businesses sell their things, and free tools that help anyone figure out what something is worth and list it.</p>
        <p>Started by Shayne, who runs it day to day. <Link href="/why" className="underline">Why we built this</Link>.</p>
      </S>
      <S h="Who sells each item">
        <ul className="list-disc pl-5 space-y-1">
          <li>Items with no seller name on the page are sold, packed and shipped by {b.name}.</li>
          <li>Items from other sellers say <b>&quot;Sold by&quot;</b> with their name on the page.</li>
          <li>Either way, you pay through our secure checkout (Stripe), and we hold your payment until you have the item. See <Link href="/returns" className="underline">returns and refunds</Link>.</li>
        </ul>
      </S>
      <S h="Honest descriptions">
        <p>Used items are described as they are. If nobody has tested something, the listing says it&apos;s untested. Damage is listed and shown in the photos. If an item isn&apos;t as described, you get your money back.</p>
      </S>
      <S h="Reach us">
        <p>{b.contact_phone ? `Call or text ${b.contact_phone}` : ""}{b.contact_phone && b.contact_email ? ", or email " : ""}{b.contact_email || ""}. <Link href="/contact" className="underline">Contact page</Link>.</p>
      </S>
    </PolicyPage>
  );
}
