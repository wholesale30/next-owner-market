"use client";

/** "Missing a part? Find it." Shows the part, what it costs, what the item sells for with it, and buttons that search Amazon and eBay for it. */
export type PartView = { part: string; part_number: string | null; why: string; price_low: number; price_high: number; value_with_low: number; value_with_high: number; amazon: string; ebay: string; affiliate: boolean; net_with_low?: number; net_with_high?: number; verdict_with?: "buy" | "maybe" | "pass" };
const m = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const V = { buy: { t: "BUY", c: "var(--ok)" }, maybe: { t: "MAYBE", c: "var(--accent)" }, pass: { t: "PASS", c: "var(--danger)" } };

export default function PartsBox({ parts, nowLow, nowHigh, compact = false }: { parts?: PartView[] | null; nowLow?: number; nowHigh?: number; compact?: boolean }) {
  if (!parts?.length) return null;
  return (
    <div className={compact ? "space-y-2" : "card p-3 space-y-3"} style={compact ? {} : { borderColor: "var(--accent)", borderWidth: 2 }}>
      {!compact && <p className="font-bold">🔧 Missing a part? Find it</p>}
      {parts.map((p, i) => {
        const gain = nowHigh != null ? Math.round(p.value_with_high - nowHigh - p.price_high) : null;
        return (
          <div key={i} className="space-y-1 text-sm" style={compact ? { borderTop: "1px dashed var(--line)", paddingTop: 6 } : {}}>
            <p className="font-semibold">🔧 Missing: {p.part}{p.part_number ? ` (${p.part_number})` : ""}</p>
            <p className="muted">{p.why}</p>
            <p>Part costs about <b>{m(p.price_low)}–{m(p.price_high)}</b>. With it, this sells for about <b>{m(p.value_with_low)}–{m(p.value_with_high)}</b>{nowLow != null && nowHigh != null ? ` (vs ${m(nowLow)}–${m(nowHigh)} as-is)` : ""}.</p>
            {p.verdict_with && p.net_with_low != null && p.net_with_high != null
              ? <p className="font-semibold">With the part you&apos;d keep {m(p.net_with_low)}–{m(p.net_with_high)}: <span style={{ color: V[p.verdict_with].c }}>{V[p.verdict_with].t}</span></p>
              : gain != null && gain > 0 && <p className="font-semibold" style={{ color: "var(--ok)" }}>Adding it could make you about {m(gain)} more.</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a href={p.amazon} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-secondary justify-center text-center" style={{ minHeight: 44 }}>🛒 Find it on Amazon</a>
              <a href={p.ebay} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-secondary justify-center text-center" style={{ minHeight: 44 }}>Find it on eBay</a>
            </div>
          </div>
        );
      })}
      {parts.some((p) => p.affiliate) && <p className="text-xs muted">We may earn a small commission if you buy through these links. It doesn&apos;t change your price.</p>}
    </div>
  );
}
