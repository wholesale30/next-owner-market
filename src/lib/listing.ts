import type { Item, Tier } from "./types";
import { CONDITION_LABELS } from "./types";

export interface CommissionTiers {
  full_service: number;
  full_service_under_50: number;
  drop_off: number;
  self_listed: number;
  owned: number;
}

export const DEFAULT_TIERS: CommissionTiers = {
  full_service: 40,
  full_service_under_50: 50,
  drop_off: 30,
  self_listed: 15,
  owned: 0,
};

/** Commission % for an item: per-item override > per-consignor default > tier default. */
export function commissionFor(
  item: Pick<Item, "tier" | "commission_pct" | "price">,
  consignorDefault: number | null | undefined,
  tiers: CommissionTiers = DEFAULT_TIERS
): number {
  if (item.commission_pct != null) return Number(item.commission_pct);
  if (consignorDefault != null) return Number(consignorDefault);
  const tier = item.tier as Tier;
  if (tier === "full_service" && item.price != null && Number(item.price) < 50)
    return tiers.full_service_under_50;
  return tiers[tier] ?? 0;
}

export function money(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface ListingCopyInput {
  item: Item;
  businessName: string;
  location?: string;
  storefrontUrl?: string;
}

/**
 * Search words for the bottom of every copy-and-paste listing (Oct 3, 2026: "put all the keywords in the bottom,
 * that's how people search"). The AI's tags first (synonyms, model numbers, what people type), then brand, model,
 * category and the title's own words, so even a listing without tags gets a line. Relevant words only: eBay and
 * Mercari punish unrelated keywords.
 */
const STOP = new Set(["the", "and", "for", "with", "of", "in", "on", "a", "an", "to", "new", "used", "lot", "item", "great", "condition", "vintage"]);
export function keywordsFor(item: Pick<Item, "title" | "tags" | "brand" | "model"> & { categories?: { name?: string } | null }, max = 20): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (w: string | null | undefined) => {
    const t = String(w || "").trim().replace(/\s+/g, " ");
    const k = t.toLowerCase();
    if (!t || t.length < 2 || seen.has(k)) return;
    seen.add(k); out.push(t);
  };
  for (const t of item.tags || []) add(t);
  add(item.brand); add(item.model);
  if (item.brand && item.model) add(`${item.brand} ${item.model}`);
  add(item.categories?.name);
  for (const w of String(item.title || "").split(/[^A-Za-z0-9-]+/)) if (w.length > 2 && !STOP.has(w.toLowerCase())) add(w);
  return out.slice(0, max);
}
const hashtags = (words: string[], n: number) => words.slice(0, n).map((t) => "#" + t.replace(/[^A-Za-z0-9]/g, "")).filter((t) => t.length > 2).join(" ");

function baseBody({ item, businessName, location, storefrontUrl }: ListingCopyInput, opts: { keywords?: boolean } = {}) {
  const lines: string[] = [];
  lines.push(item.description.trim());
  lines.push("");
  const facts: string[] = [];
  if (item.brand) facts.push(`Brand: ${item.brand}`);
  if (item.model) facts.push(`Model: ${item.model}`);
  if (item.condition) facts.push(`Condition: ${CONDITION_LABELS[item.condition]}`);
  if (item.condition_notes) facts.push(item.condition_notes);
  for (const [k, v] of Object.entries(item.specs || {})) if (v) facts.push(`${k}: ${v}`);
  if (facts.length) {
    lines.push(...facts);
    lines.push("");
  }
  if (item.tested || item.serviced) {
    const s: string[] = [];
    if (item.tested) s.push("Tested and working");
    if (item.serviced) s.push(`Serviced: ${item.service_notes || "cleaned and checked"}`);
    lines.push(`✔ ${s.join(". ")}`);
    lines.push("");
  }
  const logistics: string[] = [];
  if (item.local_pickup_ok) logistics.push(`Local pickup${location ? " in " + location : ""}`);
  if (item.shipping_ok) logistics.push("Shipping available");
  if (logistics.length) lines.push(logistics.join(" • "));
  lines.push(`Item #${item.sku} • ${businessName}`);
  if (storefrontUrl) lines.push(`See everything we have: ${storefrontUrl}`);
  if (opts.keywords !== false) {
    const kw = keywordsFor(item);
    if (kw.length) { lines.push(""); lines.push(`Keywords: ${kw.join(", ")}`); }
  }
  return lines.join("\n");
}

export function facebookCopy(input: ListingCopyInput) {
  const { item } = input;
  return `${item.title}\n\n${baseBody(input)}`;
}

export function offerUpCopy(input: ListingCopyInput) {
  return baseBody(input);
}

export function ebayCopy(input: ListingCopyInput) {
  const { item } = input;
  const title = item.title.slice(0, 80);
  return `TITLE (80 char max):\n${title}\n\nDESCRIPTION:\n${baseBody(input)}`;
}

export function craigslistCopy(input: ListingCopyInput) {
  return `${input.item.title}\n\n${baseBody(input)}`;
}

/** Etsy: 140-char title, 13 tags max (20 chars each). Only handmade, vintage (20+ yrs), or craft supplies are allowed. */
export function etsyCopy(input: ListingCopyInput) {
  const { item } = input;
  const tags = Array.from(new Set(keywordsFor(item, 30).map((t) => t.slice(0, 20)))).slice(0, 13);
  return `TITLE (140 char max):\n${item.title.slice(0, 140)}\n\nDESCRIPTION:\n${baseBody(input)}\n\nTAGS (up to 13):\n${tags.join(", ")}\n\nNote: Etsy allows only handmade, vintage (20+ years old), or craft supplies. Pick "Vintage" and the decade when listing.`;
}

/** Poshmark: 80-char title, fashion/home. Buyers expect a short blurb; Poshmark takes 20% (or $2.95 under $15). */
export function poshmarkCopy(input: ListingCopyInput) {
  const { item } = input;
  return `TITLE (80 char max):\n${item.title.slice(0, 80)}\n\nDESCRIPTION:\n${baseBody(input)}\n\nTip: price about 20% above your bottom line; Poshmark buyers always send offers.`;
}

/** Vinted: 100-char title; no fees to the seller (buyer pays protection fee). Clothing, accessories, home, electronics. */
export function vintedCopy(input: ListingCopyInput) {
  const { item } = input;
  return `TITLE (100 char max):\n${item.title.slice(0, 100)}\n\nDESCRIPTION:\n${baseBody(input)}\n\nHashtags:\n${hashtags(keywordsFor(item), 5)}`;
}

/** Mercari: 80-char title, 1,000-char description. */
export function mercariCopy(input: ListingCopyInput) {
  const { item } = input;
  const tail = `\n\nKeywords: ${keywordsFor(item, 12).join(", ")}\n${hashtags(keywordsFor(item), 3)}`;
  const body = baseBody(input, { keywords: false });
  return `TITLE (80 char max):\n${item.title.slice(0, 80)}\n\nDESCRIPTION (1000 char max):\n${body.slice(0, Math.max(200, 1000 - tail.length))}${tail}`;
}

/** Depop: short, casual, hashtags matter. */
export function depopCopy(input: ListingCopyInput) {
  const { item } = input;
  const tags = [hashtags(keywordsFor(item), 5)];
  return `${item.title}\n\n${item.description.trim().slice(0, 600)}\n\n${item.condition ? CONDITION_LABELS[item.condition] + ". " : ""}${item.shipping_ok ? "Ships fast." : "Local pickup."}\n\n${tags.join(" ")}`;
}

/** Remove any price talk the AI slipped into buyer-facing text. Prices live in the price field only. */
export function scrubPriceTalk(text: string | null | undefined): string {
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  return sentences.filter((x) => !/\$\s?\d|\b\d+\s?(dollars|bucks)\b|\b(worth|valued?|retail(s|ed)? (for|at)|resale|asking|price[ds]?|sell(s)? for)\b/i.test(x)).join(" ").replace(/\s+/g, " ").trim();
}
export function scrubSpecs(specs: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs || {})) if (!/price|value|worth|msrp|retail|cost/i.test(k) && !/\$\s?\d/.test(String(v))) out[k] = v;
  return out;
}
