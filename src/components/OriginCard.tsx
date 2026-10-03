/**
 * "📋 About it": made by, made in, year, sold new for (and in today's money), new today.
 * Only rows we know are shown, and it says how we know.
 */
export type OriginView = {
  maker: string | null; made_in: string | null; year_made: string | null;
  original_price: number | null; original_price_year: number | null; new_today: number | null; new_today_note: string | null;
  how_known: "label" | "model_records" | "estimate"; today_dollars?: number | null;
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const HOW: Record<string, string> = { label: "Read from the label in your photo", model_records: "Known for this model", estimate: "Best estimate from the photo; a model number or label photo makes it exact" };

export default function OriginCard({ o, fallbackNew }: { o: OriginView | null | undefined; fallbackNew?: number | null }) {
  if (!o && !fallbackNew) return null;
  const rows: [string, string][] = [];
  if (o?.maker) rows.push(["Made by", o.maker]);
  if (o?.made_in) rows.push(["Made in", o.made_in]);
  if (o?.year_made) rows.push(["Year made", o.year_made]);
  if (o?.original_price) rows.push(["Sold new for", `${money(o.original_price)}${o.original_price_year ? ` in ${o.original_price_year}` : ""}${o.today_dollars ? ` (about ${money(o.today_dollars)} in today's money)` : ""}`]);
  const nt = o?.new_today ?? fallbackNew ?? null;
  if (nt) rows.push(["New today", `${money(nt)}${o?.new_today_note ? `, ${o.new_today_note}` : ""}`]);
  else if (o?.new_today_note) rows.push(["New today", o.new_today_note]);
  if (!rows.length) return null;
  return (
    <div className="card p-4 space-y-1">
      <p className="font-bold">📋 About it</p>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-sm border-t pt-1" style={{ borderColor: "var(--line)" }}>
          <span className="muted shrink-0">{k}</span><span className="text-right font-semibold">{v}</span>
        </div>
      ))}
      {o && <p className="text-xs muted pt-1">{HOW[o.how_known] || HOW.estimate}</p>}
    </div>
  );
}
