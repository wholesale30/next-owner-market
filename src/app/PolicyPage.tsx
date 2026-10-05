import StoreHeader from "./StoreHeader";
import type { Business } from "@/lib/business";

/** Shared layout for Contact, About, Returns and Shipping: plain, readable, phone-first. */
export function PolicyPage({ business, title, updated, children }: { business: Business; title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <StoreHeader business={business} />
      <main className="max-w-3xl mx-auto p-4 space-y-6 text-sm">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="muted">{business.name}{business.location ? ` · ${business.location}` : ""}{updated ? ` · Updated ${updated}` : ""}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export function S({ h, children }: { h: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="font-semibold text-lg">{h}</h2>{children}</section>;
}
