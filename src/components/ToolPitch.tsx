import Link from "next/link";

/** The "why this site exists" strip: sells the AI listing tool to sellers wherever buyers land. */
export default function ToolPitch({ compact = false }: { compact?: boolean }) {
  return (
    <section className="card p-4 space-y-3" style={{ borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 6%, var(--surface))" }}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">✨</span>
        <div className="space-y-1">
          <p className="font-extrabold text-lg leading-tight">New: the AI writes your listings. For every site.</p>
          <p className="text-sm">Take photos of anything. It figures out what it is, writes the title, description and price, and hands you copy-and-paste versions for <b>Facebook, eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop and Etsy</b>, with a how-to for each one. It lists here at the same time, <b>free</b>: no listing fee, we only get paid when it sells.</p>
        </div>
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="card p-2"><p className="text-xl">📷</p><p className="font-semibold">Photos in</p><p className="muted">Even a whole pile at once</p></div>
          <div className="card p-2"><p className="text-xl">✍️</p><p className="font-semibold">Listings out</p><p className="muted">9 marketplaces + your store</p></div>
          <div className="card p-2"><p className="text-xl">💳</p><p className="font-semibold">Get paid</p><p className="muted">Card checkout, money held safe</p></div>
        </div>
      )}
      <div className="flex gap-2">
        <Link href="/pro" className="btn btn-primary flex-1">Try it free: 3 listings</Link>
        <Link href="/worth" className="btn btn-secondary">What&apos;s it worth?</Link>
      </div>
      <p className="text-xs muted text-center">Then $15/month for unlimited. Cancel any time.</p>
    </section>
  );
}
