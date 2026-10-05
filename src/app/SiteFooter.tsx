"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Contact and policy links on every public page (Google checks for these). Hidden inside the seller app. */
export default function SiteFooter() {
  const path = usePathname() || "/";
  if (path === "/" || path.startsWith("/app") || path.startsWith("/embed/")) return null;
  return (
    <footer className={`text-center text-xs muted py-6 px-4 space-x-2 ${path.startsWith("/item/") ? "pb-28" : ""}`}>
      <Link href="/contact" className="underline">Contact</Link>
      <Link href="/about" className="underline">About</Link>
      <Link href="/returns" className="underline">Returns</Link>
      <Link href="/shipping" className="underline">Shipping</Link>
      <Link href="/terms" className="underline">Terms</Link>
      <Link href="/privacy" className="underline">Privacy</Link>
    </footer>
  );
}
