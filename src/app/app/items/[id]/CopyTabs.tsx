"use client";

import { useState } from "react";
import Link from "next/link";
import CopyBlock from "./CopyBlock";
import type { HowTo } from "@/lib/howto";

export type CopyTab = { key: string; label: string; short: string; text: string; title?: string; howto?: HowTo; locked?: boolean };

export default function CopyTabs({ tabs, isPro }: { tabs: CopyTab[]; isPro: boolean }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const t = tabs.find((x) => x.key === active) || tabs[0];
  if (!t) return null;
  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((x) => (
          <button key={x.key} type="button" className={`pill px-3 py-2 whitespace-nowrap ${x.key === t.key ? "pill-active" : ""}`} onClick={() => setActive(x.key)}>{x.locked ? "🔒 " : ""}{x.short}</button>
        ))}
      </div>
      <p className="text-xs muted">{tabs.length} marketplaces. Tap one, tap Copy, open that app, paste. Save the photos above to your phone first (press and hold).</p>
      {t.locked ? (
        <div className="card p-4 text-sm space-y-2" style={{ borderColor: "var(--brand)" }}>
          <p className="font-semibold">🔒 {t.label} is part of Pro</p>
          <p className="muted">Ready-to-paste versions for eBay, OfferUp, Craigslist, Mercari, Poshmark, Vinted, Depop, and Etsy, each with a step-by-step how-to, plus unlimited AI listings. $15/month.</p>
          {!isPro && <Link href="/app/money" className="btn btn-primary">Upgrade to Pro</Link>}
        </div>
      ) : (
        <CopyBlock key={t.key} label={t.label} text={t.text} title={t.title} howto={t.howto} />
      )}
    </div>
  );
}
