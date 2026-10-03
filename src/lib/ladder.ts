/**
 * "What it's worth as-is vs cleaned up vs tested" (Oct 2, 2026). Same AI call as the lookup, a few more fields.
 * The main price everywhere stays the honest as-is price; this shows what a little work adds.
 */
export type Ladder = {
  looks_dirty: boolean;           // photos show dust, grime, stains that a wipe-down would fix
  needs_test: boolean;            // it plugs in / has batteries / moving parts, and nobody said it works
  clean_tip: string | null;       // one short how-to, e.g. "damp cloth, soft brush in the vents"
  test_tip: string | null;        // one short how-to, e.g. "plug it in, run each speed for a minute"
  cleaned_low: number | null; cleaned_high: number | null;   // as-is but cleaned
  tested_low: number | null; tested_high: number | null;     // as-is but tested and working
  both_low: number | null; both_high: number | null;         // cleaned AND tested working
};

const num = { type: ["number", "null"] };
export const LADDER_SCHEMA = {
  type: "object",
  description: "What a little work adds. Main value_low/high (or resale) is AS-IS, as it looks in the photos and untested unless the owner said it works.",
  properties: {
    looks_dirty: { type: "boolean", description: "true only if the photos show dust, grime, stains or tarnish a normal cleaning would remove" },
    needs_test: { type: "boolean", description: "true if it's electric, battery, mechanical or has parts that must work, AND the owner hasn't said it works or it's untested" },
    clean_tip: { type: ["string", "null"], description: "if looks_dirty: one short plain how-to for this item (what to use, what to avoid). Else null" },
    test_tip: { type: ["string", "null"], description: "if needs_test: one short plain way to check it works. Else null" },
    cleaned_low: num, cleaned_high: num, tested_low: num, tested_high: num, both_low: num, both_high: num,
  },
  required: ["looks_dirty", "needs_test", "clean_tip", "test_tip", "cleaned_low", "cleaned_high", "tested_low", "tested_high", "both_low", "both_high"],
} as const;

export const LADDER_PROMPT = " Price the item AS-IS: dirty if it looks dirty, untested if nobody said it works (buyers pay less for untested electronics and dusty items). Then fill condition_ladder: if it looks dirty, what it would sell for cleaned up; if it needs testing, what it would sell for tested and working; and both together. Leave a step null if it doesn't apply. Be realistic: cleaning usually adds a little, a verified working test often adds a lot for electronics.";

/** Keep the numbers sane: each step at least as-is, and only the steps that apply. */
export function cleanLadder(l: Partial<Ladder> | null | undefined, low: number, high: number): Ladder | null {
  if (!l || (!l.looks_dirty && !l.needs_test)) return null;
  const pair = (a: number | null | undefined, b: number | null | undefined, on: boolean): [number | null, number | null] => {
    if (!on || a == null || b == null || !isFinite(Number(a)) || !isFinite(Number(b))) return [null, null];
    const lo = Math.max(Number(a), low), hi = Math.max(Number(b), lo, high);
    return lo <= low && hi <= high ? [null, null] : [Math.round(lo), Math.round(hi)];
  };
  const [cl, ch] = pair(l.cleaned_low, l.cleaned_high, !!l.looks_dirty);
  const [tl, th] = pair(l.tested_low, l.tested_high, !!l.needs_test);
  const [bl, bh] = pair(l.both_low, l.both_high, !!l.looks_dirty && !!l.needs_test);
  if (cl == null && tl == null && bl == null) return null;
  return { looks_dirty: !!l.looks_dirty && cl != null, needs_test: !!l.needs_test && tl != null, clean_tip: l.clean_tip || null, test_tip: l.test_tip || null, cleaned_low: cl, cleaned_high: ch, tested_low: tl, tested_high: th, both_low: bl, both_high: bh };
}

/** Honest words for a listing's condition line. */
// Untested matters most ("doesn't work" is a common "not as described" return). Dust isn't forced into the words:
// sellers often clean an item when it sells, so the listing describes damage and function, not dust.
export const LISTING_HONESTY = " Be honest about whether it works: if the owner hasn't said it works, say plainly in the condition notes and description that it's untested. Never claim it works unless the owner said so. Mention real damage (cracks, chips, missing pieces).";

/**
 * Owner notes are facts for the AI, not words for the buyer (Oct 2, 2026, after "it puts all my shit in there").
 * Every listing writer adds this so corrections like "they're dusty from the warehouse but new, they'll clean up"
 * become "New, never used." and never "Seller says they're dusty but will clean up."
 */
export const BUYER_VOICE = " Write for the BUYER, as a confident seller would. The owner's notes and corrections are facts for you to use, not text to repeat: never quote or paraphrase the conversation, never write 'seller says', 'owner notes', 'buyer says', 'per the seller', 'AI', or anything about an earlier answer being wrong. Turn notes into plain facts (\"new, never used\", \"tested, works\", \"untested\", \"missing the remote\"). Leave out storage dust, cleaning plans and 'will clean up' unless it's real damage the buyer must know about; the seller cleans it before it goes out.";
