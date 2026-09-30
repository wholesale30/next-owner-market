import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export default function StoreHeader({ business, signedIn = false }: { business: { name: string; tagline?: string }; signedIn?: boolean }) {
  return (
    <header className="topbar sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-3 h-16 flex items-center justify-between gap-1">
        <Link href="/" aria-label={business.name}><Wordmark /></Link>
        <nav className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <Link href="/worth" className="navbtn">Worth?</Link>
          <Link href="/community" className="navbtn">Community</Link>
          <Link href="/pro" className="navbtn">Sell</Link>
          <Link href="/help" className="navbtn" aria-label="Help">?</Link>
          <Link href={signedIn ? "/account" : "/login"} className="navbtn navbtn-solid">{signedIn ? "Account" : "Sign in"}</Link>
        </nav>
      </div>
    </header>
  );
}
