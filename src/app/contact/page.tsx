import Link from "next/link";
import { getBusiness } from "@/lib/business";
import { PolicyPage, S } from "../PolicyPage";

export const metadata = { title: "Contact us", description: "Phone, text and email for Next Owner Market in Richmond, Virginia." };

export default async function ContactPage() {
  const b = await getBusiness();
  const tel = (b.contact_phone || "").replace(/[^0-9]/g, "");
  return (
    <PolicyPage business={b} title="Contact us">
      <div className="card p-4 space-y-3">
        <p className="text-base font-semibold">{b.name}</p>
        {b.address ? <p>{b.address}</p> : b.location ? <p>{b.location}</p> : null}
        <div className="grid gap-2">
          {tel && <a href={`tel:${tel}`} className="btn btn-primary" style={{ minHeight: 48 }}>📞 Call {b.contact_phone}</a>}
          {tel && <a href={`sms:${tel}`} className="btn btn-secondary" style={{ minHeight: 48 }}>💬 Text {b.contact_phone}</a>}
          {b.contact_email && <a href={`mailto:${b.contact_email}`} className="btn btn-secondary" style={{ minHeight: 48 }}>✉️ {b.contact_email}</a>}
        </div>
        <p className="muted">We usually reply within one business day.</p>
      </div>
      <S h="About an order">
        <p>Open your order (Account → My orders) and tap <b>Report a problem</b>. Your payment stays on hold until it&apos;s sorted out. You can also call, text or email us with your item number.</p>
      </S>
      <S h="More">
        <ul className="list-disc pl-5 space-y-1">
          <li><Link href="/returns" className="underline">Returns and refunds</Link></li>
          <li><Link href="/shipping" className="underline">Shipping and pickup</Link></li>
          <li><Link href="/about" className="underline">About us</Link></li>
          <li><Link href="/feedback?from=/contact" className="underline">Ideas, or something not working on the site</Link></li>
        </ul>
      </S>
    </PolicyPage>
  );
}
