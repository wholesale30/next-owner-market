import { admin } from "@/lib/stripe";

/** "Missing a part? Find it." One shape for every lookup. The AI names the part; we build plain search links (never invented product links). */
export type MissingPart = { part: string; part_number: string | null; why: string; price_low: number; price_high: number; value_with_low: number; value_with_high: number };
export type PartWithLinks = MissingPart & { amazon: string; ebay: string; affiliate: boolean };

export const PART_SCHEMA = {
  type: "array",
  maxItems: 3,
  description: "Only parts that are MISSING, broken or worn out where an easy-to-buy replacement raises the value (filter, remote, power cord or adapter, charger, battery, blade, lid, bulb, belt, stylus/needle, cartridge, strap, knob, manual). Empty array if nothing is missing or it isn't worth it.",
  items: {
    type: "object",
    properties: {
      part: { type: "string", description: "a short search phrase for the replacement part, brand + model it fits + what it is, e.g. 'Hunter HP600 HEPA filter'. No notes, no parentheses, max 8 words" },
      part_number: { type: ["string", "null"], description: "just the part number, e.g. '30966', or null. No notes" },
      why: { type: "string", description: "one short sentence: what's missing or worn and why it matters to buyers" },
      price_low: { type: "number", description: "typical price of the replacement part, new or used, USD" },
      price_high: { type: "number" },
      value_with_low: { type: "number", description: "what the WHOLE item sells for with this part replaced" },
      value_with_high: { type: "number" },
    },
    required: ["part", "why", "price_low", "price_high", "value_with_low", "value_with_high"],
  },
} as const;

/** One part per item (Sort the pile lists up to 25 items, so keep it short). */
export const PILE_PART_SCHEMA = { ...PART_SCHEMA, maxItems: 1 } as const;

export const PART_PROMPT = " Also check for missing or worn-out parts: if a replacement part is easy to buy and would raise the price (a missing filter, remote, power cord, blade, lid, stylus, battery, charger), list it in missing_parts with the exact part to search for, its part number if you know it, the part's price, and what the whole item would sell for with it. Leave missing_parts empty if nothing is missing.";

let cache: { at: number; amazon?: string; ebay?: string } | null = null;
/** Affiliate IDs (set once Amazon Associates / eBay Partner Network approve us) live in settings 'business'. */
async function tags() {
  if (cache && Date.now() - cache.at < 300_000) return cache;
  const { data } = await admin().from("settings").select("value").eq("key", "business").maybeSingle();
  const v = (data?.value as { amazon_tag?: string; ebay_campid?: string }) || {};
  cache = { at: Date.now(), amazon: v.amazon_tag || process.env.AMAZON_TAG, ebay: v.ebay_campid || process.env.EBAY_CAMPID };
  return cache;
}

export async function withPartLinks(parts: MissingPart[] | null | undefined): Promise<PartWithLinks[]> {
  const list = (parts || []).filter((p) => p && p.part).slice(0, 3);
  if (!list.length) return [];
  const t = await tags();
  // keep searches clean even if the AI adds notes like "(confirm model on label)"
  const clean = (x: string | null | undefined) => String(x || "").replace(/\([^)]*\)/g, " ").replace(/\b(verify|confirm|check|likely|approx\.?|possibly)\b.*$/i, "").replace(/\s+/g, " ").trim();
  return list.map((raw) => {
    const p = { ...raw, part: clean(raw.part) || raw.part, part_number: clean(raw.part_number) || null };
    const q = [p.part, p.part_number && !p.part.includes(p.part_number) ? p.part_number : null].filter(Boolean).join(" ").slice(0, 100);
    const amazon = `https://www.amazon.com/s?k=${encodeURIComponent(q)}${t.amazon ? `&tag=${encodeURIComponent(t.amazon)}` : ""}`;
    const ebay = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}${t.ebay ? `&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${encodeURIComponent(t.ebay)}&toolid=10001&mkevt=1` : ""}`;
    return { ...p, amazon, ebay, affiliate: !!(t.amazon || t.ebay) };
  });
}
