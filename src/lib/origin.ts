/**
 * "About it": who made it, where, what year, what it sold for new, what it costs new today (Oct 3, 2026).
 * Same AI call as the lookup. Each fact says how it's known (read off a label, from the model's records, or an estimate).
 */
export type Origin = {
  maker: string | null;
  made_in: string | null;              // country, e.g. "Japan", "USA", "China"
  year_made: string | null;            // "1987", "1985–1989", "about 2015"
  original_price: number | null;       // what it sold for new, in that year's dollars
  original_price_year: number | null;
  new_today: number | null;            // price new today, or of its direct replacement
  new_today_note: string | null;       // e.g. "replaced by the XR-2 at about $249"
  how_known: "label" | "model_records" | "estimate";
};

const n = { type: ["number", "null"] };
const s = { type: ["string", "null"] };
export const ORIGIN_SCHEMA = {
  type: "object",
  description: "About the item. Use null for anything you can't reasonably know; never invent a precise number you don't know.",
  properties: {
    maker: { ...s, description: "brand / manufacturer" },
    made_in: { ...s, description: "country of manufacture if a label shows it or it's well known for this model, else null" },
    year_made: { ...s, description: "year or year range it was made, e.g. '1987' or '1985-1989' or 'about 2015'" },
    original_price: { ...n, description: "what it sold for new when it came out (MSRP / typical retail), in that year's US dollars" },
    original_price_year: { ...n, description: "the year that original price is from" },
    new_today: { ...n, description: "what it costs new today in US dollars; if discontinued, the closest current replacement's price" },
    new_today_note: { ...s, description: "one short line, e.g. 'still sold' or 'discontinued; the Lasko 1128 replaces it at about $90'" },
    how_known: { type: "string", enum: ["label", "model_records", "estimate"], description: "label = read from a sticker/plate in the photo; model_records = known for this exact model; estimate = best guess from the look" },
  },
  required: ["maker", "made_in", "year_made", "original_price", "original_price_year", "new_today", "new_today_note", "how_known"],
} as const;

export const ORIGIN_PROMPT = " Also fill origin: who made it, where it was made (read 'Made in' labels), what year it was made, what it sold for new when it came out and in what year, and what it costs new today (or its replacement). Read date codes, model plates and copyright years in the photos. Use null rather than guess wildly.";

/** Pile items: just the two most useful facts, to keep big piles fast. */
export const PILE_ORIGIN_FIELDS = {
  year_made: { type: ["string", "null"], description: "year or range it was made, if you can tell" },
  price_new: { type: ["number", "null"], description: "what it sold for new (or costs new today if still sold), USD" },
} as const;

// US CPI-U annual averages (BLS, 1982-84 = 100), every 5 years, then yearly. Used for "about $X in today's money".
const CPI: [number, number][] = [
  [1950, 24.1], [1955, 26.8], [1960, 29.6], [1965, 31.5], [1970, 38.8], [1975, 53.8], [1980, 82.4], [1985, 107.6],
  [1990, 130.7], [1995, 152.4], [2000, 172.2], [2005, 195.3], [2010, 218.1], [2015, 237.0], [2020, 258.8],
  [2021, 271.0], [2022, 292.7], [2023, 304.7], [2024, 313.7], [2025, 321.5],
];
function cpiAt(y: number) {
  if (y <= CPI[0][0]) return CPI[0][1];
  for (let i = 1; i < CPI.length; i++) {
    const [y1, c1] = CPI[i - 1], [y2, c2] = CPI[i];
    if (y <= y2) return c1 + ((c2 - c1) * (y - y1)) / (y2 - y1);
  }
  return CPI[CPI.length - 1][1];
}
/** The original price in today's dollars, rounded, or null when it isn't meaningful (recent or unknown). */
export function inTodaysDollars(price: number | null | undefined, year: number | null | undefined) {
  if (!price || !year || year < 1950 || year > 2023) return null;
  const v = (price * CPI[CPI.length - 1][1]) / cpiAt(year);
  return v > price * 1.1 ? Math.round(v / (v > 200 ? 10 : 1)) * (v > 200 ? 10 : 1) : null;
}

/** Tidy what the AI sent (it sometimes sends text for an object). */
export function cleanOrigin(o: unknown): (Origin & { today_dollars: number | null }) | null {
  let v = o;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  if (!v || typeof v !== "object") return null;
  const x = v as Partial<Origin>;
  const num = (z: unknown) => (z == null || !isFinite(Number(z)) || Number(z) <= 0 ? null : Math.round(Number(z)));
  const str = (z: unknown) => (z == null || String(z).trim() === "" || /^(unknown|n\/a|none|null)$/i.test(String(z).trim()) ? null : String(z).slice(0, 220));
  const out = {
    maker: str(x.maker), made_in: str(x.made_in), year_made: str(x.year_made),
    original_price: num(x.original_price), original_price_year: num(x.original_price_year),
    new_today: num(x.new_today), new_today_note: str(x.new_today_note),
    how_known: (["label", "model_records", "estimate"].includes(String(x.how_known)) ? x.how_known : "estimate") as Origin["how_known"],
  };
  if (!out.maker && !out.made_in && !out.year_made && !out.original_price && !out.new_today) return null;
  return { ...out, today_dollars: inTodaysDollars(out.original_price, out.original_price_year) };
}
