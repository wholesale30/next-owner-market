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

function baseBody({ item, businessName, location, storefrontUrl }: ListingCopyInput) {
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
  const tags = Array.from(new Set([...(item.tags || []), item.brand || "", item.model || ""].filter(Boolean).map((t) => t.slice(0, 20)))).slice(0, 13);
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
  return `TITLE (100 char max):\n${item.title.slice(0, 100)}\n\nDESCRIPTION:\n${baseBody(input)}\n\nHashtags:\n${(item.tags || []).slice(0, 5).map((t) => "#" + t.replace(/\s+/g, "")).join(" ")}`;
}

/** Mercari: 80-char title, 1,000-char description. */
export function mercariCopy(input: ListingCopyInput) {
  const { item } = input;
  return `TITLE (80 char max):\n${item.title.slice(0, 80)}\n\nDESCRIPTION (1000 char max):\n${baseBody(input).slice(0, 1000)}`;
}

/** Depop: short, casual, hashtags matter. */
export function depopCopy(input: ListingCopyInput) {
  const { item } = input;
  const tags = (item.tags || []).slice(0, 5).map((t) => "#" + t.replace(/\s+/g, ""));
  return `${item.title}\n\n${item.description.trim().slice(0, 600)}\n\n${item.condition ? CONDITION_LABELS[item.condition] + ". " : ""}${item.shipping_ok ? "Ships fast." : "Local pickup."}\n\n${tags.join(" ")}`;
}
