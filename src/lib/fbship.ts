/** Facebook shipping helpers shared by the Relist list and the Next post page (owner, Oct 26, 2026). */
type Box = { lbs: number | null; l: number | null; w: number | null; h: number | null };

/** what the post office bills: the bigger of real weight and box size (L×W×H ÷ 166 for boxes over 1 cubic foot) */
export function billedLbs(s: Box) {
  const vol = (s.l || 0) * (s.w || 0) * (s.h || 0);
  return Math.max(s.lbs || 0, vol > 1728 ? Math.ceil(vol / 166) : 0);
}
/** true when Facebook's weight-only label is risky: box billed heavier than it weighs, or over 70 lb */
export function fbRisky(s: Box) { return billedLbs(s) > (s.lbs || 0) || (s.lbs || 0) > 70; }

/** the weight to type into Facebook's only shipping box: the billed weight, so the label covers the box size (Oct 26, 2026) */
export function fbWeight(s: Box) { return Math.ceil(billedLbs(s)); }
/** Facebook's USPS label tops out at 70 lb */
export function fbFits(s: Box) { return !!s.lbs && fbWeight(s) <= 70; }

export const OFFSITE_LINE = "Shipping available at the buyer's cost. Message me your ZIP code for an exact quote.";
