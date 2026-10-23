import Anthropic from "@anthropic-ai/sdk";
import { logUsage, costOf } from "@/lib/usage";
import { strictSchema } from "@/lib/find";
import { cleanAiTells } from "@/lib/listing";

/**
 * Price check (owner, Oct 23, 2026): "scan every item and do a search like we normally do… give me suggested prices so
 * I can see what I have it listed for and what it would blow out for, high end, low end." Some things he doesn't want
 * dumped, so it also says when an item is worth holding for top dollar.
 * Follows Operating Rule 24: real US sold and asking prices from a live search, real retail, never a guess.
 * Only comps whose page actually came back in the search keep their link.
 */
export const PRICE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export type Comp = { where: string; what: string; price: number; sold: boolean; url: string | null };
export type PriceCheck = {
  what: string; retail_new: number | null; top_price: number; list_price: number; fast_price: number; floor_price: number;
  hold: boolean; why: string; comps: Comp[]; searches: number; cost: number; checked_at: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    what: { type: "string", description: "exactly what it is: brand, model, size, year if known" },
    retail_new: { type: ["number", "null"], description: "current new retail in USD at a real store, null if not sold new anymore or not found" },
    comps: {
      type: "array", maxItems: 6, description: "real US prices you saw in search results for the same or very close item",
      items: { type: "object", properties: {
        where: { type: "string", description: "eBay sold, eBay listed, Facebook Marketplace, Craigslist, store name…" },
        what: { type: "string" }, price: { type: "number" }, sold: { type: "boolean", description: "true only for a confirmed sold price" },
        url: { type: ["string", "null"], description: "only a URL that came back in your search results" },
      } },
    },
    top_price: { type: "number", description: "top dollar: what a patient seller gets locally in about a month" },
    list_price: { type: "number", description: "what to put in the price box now to sell within 1-2 weeks with room for offers" },
    fast_price: { type: "number", description: "blow-out price that sells within a few days locally" },
    floor_price: { type: "number", description: "lowest it should ever go; below this, hold it or sell for parts/scrap instead" },
    hold: { type: "boolean", description: "true if this is worth holding for top dollar rather than dumping (scarce, collectible, high retail, steady demand)" },
    why: { type: "string", description: "one or two short plain sentences: what the comps show and why these prices" },
  },
  required: ["what", "retail_new", "comps", "top_price", "list_price", "fast_price", "floor_price", "hold", "why"],
} as const;

const SYSTEM = `You are a US resale pricer for a surplus warehouse in central Virginia that sells on Facebook Marketplace (local pickup). Today is ${new Date().toISOString().slice(0, 10)}.
1. Work out exactly what the item is from the title, description and photo (read labels and model numbers).
2. Use web_search for real prices: eBay sold/completed, current eBay and Facebook Marketplace asking prices, and new retail at a real store. US prices only. Search the model number and the plain name.
3. Call record_price once. Prices must come from what you actually saw; local pickup prices run below eBay sold prices because there is no shipping. Never invent a URL. top_price >= list_price >= fast_price >= floor_price. Short, plain words, no dashes as punctuation.
If you truly find nothing comparable, price from the closest similar items you did find and say so in why.`;

const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");

export async function priceCheck(client: Anthropic, p: { title: string; description: string; condition: string; price: number | null; photo?: string | null; ownerId?: string | null }): Promise<PriceCheck> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (p.photo) content.push({ type: "image", source: { type: "url", url: p.photo } });
  content.push({ type: "text", text: `Item: ${p.title}\nCondition: ${p.condition || "used"}\nDescription: ${p.description.slice(0, 1500)}\nOwner's current asking price: ${p.price ? `$${p.price}` : "none"}\nFind real comps and price it.` });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "US" } },
    { name: "record_price", description: "Record the prices. Call once, at the end.", input_schema: strictSchema(SCHEMA) as Anthropic.Tool.InputSchema, strict: true },
  ];
  const seen = new Set<string>();
  const total = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 0 } };
  let raw: Record<string, unknown> | null = null;
  for (let round = 0; round < 5 && !raw; round++) {
    const m = await client.messages.create({ model: PRICE_MODEL, max_tokens: 3000, system: SYSTEM, tools, messages, tool_choice: round >= 3 ? { type: "tool", name: "record_price" } : { type: "auto" } });
    const u = m.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } };
    total.input_tokens += u.input_tokens || 0; total.output_tokens += u.output_tokens || 0;
    total.cache_read_input_tokens += u.cache_read_input_tokens || 0; total.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
    total.server_tool_use.web_search_requests += u.server_tool_use?.web_search_requests || 0;
    for (const b of m.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.type === "web_search_result") seen.add(norm(r.url));
      if (b.type === "tool_use" && b.name === "record_price") raw = b.input as Record<string, unknown>;
    }
    if (raw) break;
    messages.push({ role: "assistant", content: m.content as Anthropic.ContentBlockParam[] });
    if (m.stop_reason !== "pause_turn") messages.push({ role: "user", content: "Now call record_price with what you found." });
  }
  await logUsage(p.ownerId, "price_check", PRICE_MODEL, total as unknown as Anthropic.Usage);
  if (!raw) throw new Error("No price came back. Try again.");
  const r = raw as unknown as Omit<PriceCheck, "searches" | "cost" | "checked_at">;
  const n = (x: unknown) => (typeof x === "number" && x > 0 ? Math.round(x) : 0);
  // keep the four prices in order even if the AI slipped
  const [top, list, fast, floor] = [n(r.top_price), n(r.list_price), n(r.fast_price), n(r.floor_price)].sort((a, b) => b - a);
  return {
    what: cleanAiTells(r.what || ""), retail_new: n(r.retail_new) || null,
    top_price: top, list_price: list, fast_price: fast, floor_price: floor, hold: !!r.hold, why: cleanAiTells(r.why || ""),
    comps: (r.comps || []).filter((c) => c && c.price > 0).slice(0, 6).map((c) => ({ where: cleanAiTells(c.where), what: cleanAiTells(c.what), price: Math.round(c.price), sold: !!c.sold, url: c.url && seen.has(norm(c.url)) ? c.url : null })),
    searches: total.server_tool_use.web_search_requests,
    cost: Math.round(costOf(PRICE_MODEL, total as unknown as Anthropic.Usage) * 1000) / 1000,
    checked_at: new Date().toISOString(),
  };
}
