import type { DeepReport } from "@/lib/deepcheck";

/** the listing fields an item gets from a deep report: words, price, keywords, weight and box (Oct 26, 2026) */
export function itemFields(r: DeepReport) {
  const dims = r.box_l && r.box_w && r.box_h ? [r.box_l, r.box_w, r.box_h].sort((a, b) => b - a) : null;
  const box = !dims ? undefined : (r.ship_lbs || 0) > 70 ? "freight" : dims[0] <= 10 && dims[1] <= 8 && dims[2] <= 4 ? "small" : dims[0] <= 14 && dims[1] <= 12 && dims[2] <= 8 ? "medium" : dims[0] <= 20 && dims[1] <= 16 && dims[2] <= 12 ? "large" : "xl";
  return {
    title: r.listing_title.slice(0, 80) || r.what.slice(0, 80), description: r.listing_description || r.summary, tags: (r.listing_keywords || []).slice(0, 25),
    brand: r.brand, model: r.model, price: r.list_price || null, price_min_suggested: r.fast_price || null, price_max_suggested: r.top_price || null,
    weight_lbs: r.ship_lbs || null, ship_l: r.box_l || null, ship_w: r.box_w || null, ship_h: r.box_h || null, ship_source: r.weight_source || null,
    ...(box ? { box } : {}),
  };
}
