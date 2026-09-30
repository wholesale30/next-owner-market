import { admin } from "@/lib/stripe";
import { getRates, shippoReady, type Address } from "@/lib/shippo";
import { lookupZip } from "@/lib/geo";

export const BOXES: Record<string, { length: number; width: number; height: number; label: string }> = {
  small: { length: 10, width: 8, height: 4, label: "Small (shoebox)" },
  medium: { length: 14, width: 12, height: 8, label: "Medium (microwave)" },
  large: { length: 20, width: 16, height: 12, label: "Large (receiver, small speaker)" },
  xl: { length: 24, width: 20, height: 16, label: "XL (tower speaker, big lamp)" },
  freight: { length: 48, width: 40, height: 40, label: "Freight / too big to ship" },
};

/** Cheapest ground rate to a buyer ZIP for an item, or the flat price. Returns null if it can't ship. */
export interface Quote { amount: number; service: string; rateId: string | null; mode: string; days?: number | null; options?: { amount: number; service: string; rateId: string; days: number | null }[] }
export async function quoteShipping(itemId: string, buyerZip: string | null, pickRateId?: string | null): Promise<Quote | null> {
  const db = admin();
  const { data: it } = await db.from("items").select("shipping_ok, shipping_mode, shipping_price, weight_lbs, box, owner_id").eq("id", itemId).single();
  if (!it || !it.shipping_ok || it.box === "freight") return null;
  if (it.shipping_mode === "free") return { amount: 0, service: "Free shipping", rateId: null, mode: "free" };
  if (!shippoReady()) return { amount: Number(it.shipping_price || 0), service: "Standard shipping", rateId: null, mode: "calculated" };
  const to = lookupZip(buyerZip);
  if (!to) return { amount: Number(it.shipping_price || 0), service: "Estimate (enter ZIP for exact)", rateId: null, mode: "estimate" };
  const from = await shipFromFor(it.owner_id);
  if (!from) return { amount: Number(it.shipping_price || 0), service: "Standard shipping", rateId: null, mode: "calculated" };
  const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
  const b = (biz?.value as { shipping_markup_pct?: number; shipping_markup_min?: number }) || {};
  const pct = Number(b.shipping_markup_pct ?? 20), minUp = Number(b.shipping_markup_min ?? 1.5);
  const box = BOXES[it.box || "medium"] || BOXES.medium;
  try {
    const rates = await getRates(from, { name: "Buyer", street1: "1 Main St", city: to.city, state: to.state, zip: to.zip }, { ...box, weight: Number(it.weight_lbs || 2) });
    // buyer price = discounted rate + platform margin (max of % and minimum), rounded up to the next 5¢
    const cushion = (n: string) => { const r = Number(n); const up = Math.max(r * pct / 100, minUp); return Math.ceil((r + up) * 20) / 20; };
    const isFast = (n: string) => /express|overnight|next day|2nd day|2 day|2-day/i.test(n);
    const isPriority = (n: string) => /priority|3 day|3-day|ground saver/i.test(n) && !isFast(n);
    const ground = rates.filter((r) => !isFast(r.servicelevel.name) && !isPriority(r.servicelevel.name));
    const priority = rates.filter((r) => isPriority(r.servicelevel.name));
    const fast = rates.filter((r) => isFast(r.servicelevel.name));
    const picks = [ground[0], priority[0], fast[0]].filter(Boolean).sort((a, b) => Number(a.amount) - Number(b.amount));
    const options = picks.map((r) => ({ amount: cushion(r.amount), service: `${r.provider} ${r.servicelevel.name}`, rateId: r.object_id, days: r.estimated_days }));
    const chosen = (pickRateId && options.find((o) => o.rateId === pickRateId)) || options[0];
    if (!chosen) return { amount: Number(it.shipping_price || 0), service: "Standard shipping", rateId: null, mode: "calculated" };
    return { ...chosen, mode: "calculated", options };
  } catch {
    return { amount: Number(it.shipping_price || 0), service: "Standard shipping", rateId: null, mode: "calculated" };
  }
}

export async function shipFromFor(sellerId: string): Promise<Address | null> {
  const db = admin();
  const { data: p } = await db.from("profiles").select("role, full_name, business_name, address1, address2, city, state, zip, phone, email").eq("id", sellerId).single();
  if (!p) return null;
  if (p.role === "admin" || p.role === "staff") {
    const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
    const b = (biz?.value as { name?: string; address?: string; zip?: string; contact_phone?: string; contact_email?: string }) || {};
    const m = (b.address || "").match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})/);
    if (m) return { name: b.name || "Next Owner Market", street1: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4], phone: b.contact_phone, email: b.contact_email };
    const g = lookupZip(b.zip);
    return g ? { name: b.name || "Next Owner Market", street1: "Warehouse", city: g.city, state: g.state, zip: g.zip } : null;
  }
  const g = lookupZip(p.zip);
  if (!g) return null;
  return { name: p.business_name || p.full_name || "Seller", street1: p.address1 || "Seller", street2: p.address2 || undefined, city: p.city || g.city, state: p.state || g.state, zip: g.zip, phone: p.phone || undefined, email: p.email || undefined };
}
