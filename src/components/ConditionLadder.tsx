"use client";

/**
 * As-is vs cleaned up vs tested. Shows only the steps that apply, biggest payoff last.
 * The as-is price stays the headline everywhere; this shows what 10 minutes of work adds.
 */
type Step = { low: number; high: number; net_low?: number; net_high?: number; verdict?: string } | null;
export type LadderView = {
  looks_dirty?: boolean; needs_test?: boolean; clean_tip: string | null; test_tip: string | null;
  cleaned_low?: number | null; cleaned_high?: number | null; tested_low?: number | null; tested_high?: number | null; both_low?: number | null; both_high?: number | null;
  cleaned?: Step; tested?: Step; both?: Step; // Buy or Pass sends these (with profit and verdict)
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const V: Record<string, { t: string; c: string }> = { buy: { t: "BUY", c: "var(--ok)" }, maybe: { t: "MAYBE", c: "var(--accent)" }, pass: { t: "PASS", c: "var(--danger)" } };

export default function ConditionLadder({ l, nowLow, nowHigh, nowVerdict, profit }: { l: LadderView | null | undefined; nowLow: number; nowHigh: number; nowVerdict?: string; profit?: { low: number; high: number } }) {
  if (!l) return null;
  const pick = (s: Step | undefined, lo?: number | null, hi?: number | null): Step => s ?? (lo != null && hi != null ? { low: lo, high: hi } : null);
  const cleaned = pick(l.cleaned, l.cleaned_low, l.cleaned_high);
  const tested = pick(l.tested, l.tested_low, l.tested_high);
  const both = pick(l.both, l.both_low, l.both_high);
  if (!cleaned && !tested && !both) return null;
  const nowLabel = [cleaned || both ? "dusty" : null, tested || both ? "untested" : null].filter(Boolean).join(", ");
  const row = (icon: string, label: string, s: Step, tip?: string | null) => s && (
    <div className="border-t pt-2 space-y-0.5" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{icon} {label}</span>
        <span className="whitespace-nowrap"><b>{money(s.low)}–{money(s.high)}</b> <span style={{ color: "var(--ok)" }}>+{money(Math.max(0, s.high - nowHigh))}</span></span>
      </div>
      {s.net_low != null && s.net_high != null && s.verdict && <p className="text-sm">You&apos;d keep {money(s.net_low)}–{money(s.net_high)} · <b style={{ color: V[s.verdict]?.c }}>{V[s.verdict]?.t}</b></p>}
      {tip && <p className="text-xs muted">How: {tip}</p>}
    </div>
  );
  return (
    <div className="card p-4 space-y-2">
      <p className="font-bold">💡 Worth more with a little work</p>
      <div className="flex items-baseline justify-between gap-2">
        <span>As it is now <span className="muted text-sm">({nowLabel})</span></span>
        <span className="whitespace-nowrap"><b>{money(nowLow)}–{money(nowHigh)}</b></span>
      </div>
      {profit && nowVerdict && <p className="text-sm -mt-1">You&apos;d keep {money(profit.low)}–{money(profit.high)} · <b style={{ color: V[nowVerdict]?.c }}>{V[nowVerdict]?.t}</b></p>}
      {row("🧽", "Cleaned up", cleaned, l.clean_tip)}
      {row("🔌", "Tested and working", tested, l.test_tip)}
      {row("✨", "Both", both)}
      {(tested || both) && <p className="text-xs muted pt-1">&quot;Working&quot; means if it powers on and works. Tested it already? Tell it below in <b>Something wrong?</b> (&quot;it works&quot;) and the price updates.</p>}
    </div>
  );
}
