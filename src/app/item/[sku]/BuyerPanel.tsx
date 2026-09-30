"use client";

import Link from "next/link";

export default function BuyerPanel({ sku, signedIn }: { sku: string; signedIn: boolean; itemId?: string; title?: string; canPickup?: boolean }) {
  if (signedIn) return null;
  return <p className="text-xs muted text-center"><Link href={`/signup?buyer=1&next=/item/${sku}`} className="underline">Create a free account</Link> to buy, message, save items, and get alerts.</p>;
}
