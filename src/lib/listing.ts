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
