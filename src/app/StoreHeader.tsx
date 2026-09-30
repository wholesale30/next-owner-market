import Link from "next/link";

export default function StoreHeader({ business }: { business: { name: string; tagline?: string } }) {
  return (
    <header className="border-b" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">{business.name}</Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/looking-for" className="muted">Wanted</Link>
          <Link href="/pro" className="muted">Sell</Link>
          <Link href="/account" className="muted">Account</Link>
        </nav>
      </div>
      {business.tagline && <p className="text-center text-xs muted pb-2">{business.tagline}</p>}
    </header>
  );
}
