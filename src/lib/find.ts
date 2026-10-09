import Anthropic from "@anthropic-ai/sdk";
import { logUsage, costOf } from "@/lib/usage";
import { tags } from "@/lib/parts";
import { cleanAiTells } from "@/lib/listing";

/**
 * "Find it for less" (owner's idea, Oct 9, 2026): tell us a part or item (words, voice or a photo), the AI searches
 * the live web and comes back with the exact part, real prices at real stores, what a shop or dealer would charge,
 * and whether you can do it yourself. His example: Prius EGR valve, dealer $750, Amazon $80.
 *
 * How it works: one AI call with two tools: Anthropic's web_search (live results, $10 per 1,000 searches) and our
 * record_results tool. Links are never invented: a product link is only kept if that exact page came back from a
 * search; otherwise it becomes a plain search link at that store (or Google Shopping).
 */
export const FIND_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export type FindOption = { store: string; product: string; price: number | null; condition: string; url: string; note: string; checked: boolean };
export type FindResult = {
  what_it_is: string;
  exact_specs: string[];
  answer: string;
  shop_price_low: number | null;
  shop_price_high: number | null;
  shop_label: string;
  options: FindOption[];
  diy: { doable: "easy" | "medium" | "hard" | "pro_only"; time: string; tools: string[]; steps: string[]; video_search: string; safety: string };
  watch_out: string;
  cheaper_idea: string;
  best_price: number | null;
  searches: number;
  cost: number;
};

const SCHEMA = {
  type: "object",
  properties: {
    what_it_is: { type: "string", description: "short plain name first, then the part number in parentheses if there is one of exactly what they need, e.g. 'R7S 118mm LED bulb for halogen work light' or 'EGR valve for 2012 Toyota Prius (part 25620-37100)'" },
    exact_specs: { type: "array", maxItems: 5, items: { type: "string" }, description: "the specs to match when buying: size, base, wattage, part number, fits years/models. Short phrases" },
    answer: { type: "string", description: "2 or 3 plain sentences a beginner understands: what to buy, roughly what it costs, and the big savings vs a shop if there is one. No dashes as punctuation" },
    shop_price_low: { type: ["number", "null"], description: "what a dealer, repair shop or full-price store usually charges for this, installed if it's a repair, USD. null if not relevant" },
    shop_price_high: { type: ["number", "null"] },
    shop_label: { type: "string", description: "what that shop price is, at most 5 words, e.g. 'dealer, installed' or 'repair shop, installed' or 'full retail'. Empty if none" },
    options: {
      type: "array", maxItems: 6,
      description: "the best places to buy it RIGHT NOW from your searches, cheapest good option first. Real stores you found (Amazon, Walmart, Home Depot, Lowe's, eBay, RockAuto, AutoZone, Harbor Freight, the maker...). Include a trusted brand option and a budget option when they differ",
      items: {
        type: "object",
        properties: {
          store: { type: "string" },
          product: { type: "string", description: "the product name as the store lists it, short" },
          price: { type: ["number", "null"], description: "price you saw in the search, USD, or null if you didn't see one" },
          condition: { type: "string", enum: ["new", "used", "refurbished", "aftermarket new", "OEM new"] },
          url: { type: "string", description: "the exact product or listing URL from your search results. Never make one up" },
          note: { type: "string", description: "one short line: why this one (cheapest, best reviewed, OEM, pack of 2, fits both...)" },
        },
        required: ["store", "product", "price", "condition", "url", "note"],
      },
    },
    diy: {
      type: "object",
      properties: {
        doable: { type: "string", enum: ["easy", "medium", "hard", "pro_only"] },
        time: { type: "string", description: "e.g. '10 minutes' or '2 to 3 hours'" },
        tools: { type: "array", maxItems: 6, items: { type: "string" } },
        steps: { type: "array", maxItems: 7, items: { type: "string" }, description: "short plain steps a beginner can follow. Empty if it's just a swap like a bulb" },
        video_search: { type: "string", description: "a YouTube search phrase that finds a good how-to video, e.g. '2012 Prius EGR valve replacement'" },
        safety: { type: "string", description: "one line safety warning if any (unplug it, let the engine cool, disconnect the 12V battery). Empty if none" },
      },
      required: ["doable", "time", "tools", "steps", "video_search", "safety"],
    },
    watch_out: { type: "string", description: "one line on what people get wrong buying this (wrong length, wrong year, cheap knockoffs). Empty if none" },
    cheaper_idea: { type: "string", description: "one line on an even cheaper route if there is one (used part from a junkyard, buy the 2 pack, rebuild kit, clean it instead of replacing). Empty if none" },
  },
  required: ["what_it_is", "exact_specs", "answer", "shop_price_low", "shop_price_high", "shop_label", "options", "diy", "watch_out", "cheaper_idea"],
} as const;

const SYSTEM = `You help everyday people (thrift shoppers, flippers, DIYers, car owners) find the exact part or item they need and buy it for the least money from a trustworthy seller. Today is ${new Date().toISOString().slice(0, 10)}. Shoppers are in the USA.
Steps:
1. Work out EXACTLY what they need (exact part number, size, base, fit). If they gave a photo, read any label or model number in it.
2. Use web_search to find current prices at real stores. Search the exact part number and the plain name. Look at Amazon, Walmart, Home Depot, Lowe's, eBay and specialist stores (RockAuto, AutoZone, the maker). Also search what a dealer or repair shop charges if it's a repair.
3. Call record_results once with what you found. Options must all be the thing they asked for (if they asked for LED, every option is LED). shop_price is what a dealer, repair shop or full-price store charges for that SAME thing (installed, for a repair); use null if there isn't one. A different, cheaper route goes in cheaper_idea, not in options. Only use URLs that came back in your search results. Prices must be ones you actually saw; use null if you didn't see a price. Write for a beginner, short and plain, no dashes as punctuation.`;

const KNOWN_STORES: { host: RegExp; name: string; search: (q: string) => string }[] = [
  { host: /(^|\.)amazon\.com$/, name: "Amazon", search: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  { host: /(^|\.)walmart\.com$/, name: "Walmart", search: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
  { host: /(^|\.)homedepot\.com$/, name: "Home Depot", search: (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}` },
  { host: /(^|\.)lowes\.com$/, name: "Lowe's", search: (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}` },
  { host: /(^|\.)ebay\.com$/, name: "eBay", search: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
  { host: /(^|\.)rockauto\.com$/, name: "RockAuto", search: (q) => `https://www.rockauto.com/en/partsearch/?partnum=${encodeURIComponent(q)}` },
  { host: /(^|\.)autozone\.com$/, name: "AutoZone", search: (q) => `https://www.autozone.com/searchresult?searchText=${encodeURIComponent(q)}` },
  { host: /(^|\.)harborfreight\.com$/, name: "Harbor Freight", search: (q) => `https://www.harborfreight.com/search?q=${encodeURIComponent(q)}` },
];
const storeByName = (name: string) => KNOWN_STORES.find((s) => s.name.toLowerCase().replace(/\W/g, "") === name.toLowerCase().replace(/\W/g, "").replace(/\.com$/, ""));
const norm = (u: string) => { try { const x = new URL(u); return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/$/, "")).toLowerCase(); } catch { return ""; } };

/** Add our affiliate tag to Amazon and eBay links (once Shayne's Associates / Partner Network IDs are in). */
async function tagLink(url: string): Promise<{ url: string; tagged: boolean }> {
  const t = await tags();
  try {
    const u = new URL(url);
    if (/(^|\.)amazon\.com$/.test(u.host) && t.amazon) { u.searchParams.set("tag", t.amazon); return { url: u.toString(), tagged: true }; }
    if (/(^|\.)ebay\.com$/.test(u.host) && t.ebay) {
      for (const [k, v] of Object.entries({ mkcid: "1", mkrid: "711-53200-19255-0", siteid: "0", campid: t.ebay, toolid: "10001", mkevt: "1" })) u.searchParams.set(k, v);
      return { url: u.toString(), tagged: true };
    }
  } catch { /* fall through */ }
  return { url, tagged: false };
}

export async function findItForLess(client: Anthropic, p: { text: string; image?: Anthropic.ImageBlockParam | null; ownerId?: string | null; maxSearches?: number }): Promise<FindResult> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (p.image) content.push(p.image);
  content.push({ type: "text", text: `What I need: ${p.text || "(see the photo)"}\nFind me the exact part or item and the best prices.` });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: p.maxSearches ?? 5, user_location: { type: "approximate", country: "US" } },
    { name: "record_results", description: "Record what you found. Call this once, at the end.", input_schema: SCHEMA as unknown as Anthropic.Tool.InputSchema },
  ];
  const seen = new Set<string>();
  const total = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 0 } };
  let raw: Record<string, unknown> | null = null;

  for (let round = 0; round < 5 && !raw; round++) {
    const force = round >= 3; // after a few rounds, make it write the answer
    const m = await client.messages.create({ model: FIND_MODEL, max_tokens: 4000, system: SYSTEM, tools, messages, tool_choice: force ? { type: "tool", name: "record_results" } : { type: "auto" } });
    const u = m.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } };
    total.input_tokens += u.input_tokens || 0; total.output_tokens += u.output_tokens || 0;
    total.cache_read_input_tokens += u.cache_read_input_tokens || 0; total.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
    total.server_tool_use.web_search_requests += u.server_tool_use?.web_search_requests || 0;
    for (const b of m.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.type === "web_search_result") seen.add(norm(r.url));
      if (b.type === "tool_use" && b.name === "record_results") raw = b.input as Record<string, unknown>;
    }
    if (raw) break;
    messages.push({ role: "assistant", content: m.content as Anthropic.ContentBlockParam[] });
    if (m.stop_reason !== "pause_turn") messages.push({ role: "user", content: "Now call record_results with what you found." });
  }
  await logUsage(p.ownerId, "find", FIND_MODEL, total as unknown as Anthropic.Usage);
  if (!raw) throw new Error("find: no result");

  const r = raw as unknown as Omit<FindResult, "options" | "best_price" | "searches" | "cost"> & { options?: Omit<FindOption, "checked">[] };
  const options: FindOption[] = [];
  for (const o of (r.options || []).slice(0, 6)) {
    if (!o || !o.store || !o.product) continue;
    let url = String(o.url || "");
    let checked = !!url && seen.has(norm(url));
    if (!checked) {
      // not a page we actually saw: send them to a search at that store instead of a link that may not exist
      let host = ""; try { host = new URL(url).host.replace(/^www\./, ""); } catch { /* none */ }
      const st = KNOWN_STORES.find((s) => s.host.test(host)) || storeByName(o.store);
      url = st ? st.search(o.product.slice(0, 90)) : `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(o.product.slice(0, 90))}`;
      checked = false;
    }
    const t = await tagLink(url);
    const price = typeof o.price === "number" && o.price > 0 ? Math.round(o.price * 100) / 100 : null;
    options.push({ store: cleanAiTells(o.store), product: cleanAiTells(o.product), price, condition: o.condition || "new", url: t.url, note: cleanAiTells(o.note || ""), checked });
  }
  options.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  const prices = options.map((o) => o.price).filter((x): x is number => x != null);
  const d = r.diy || ({} as FindResult["diy"]);
  const num = (x: unknown) => (typeof x === "number" && x > 0 ? Math.round(x) : null);
  return {
    what_it_is: cleanAiTells(r.what_it_is || ""),
    exact_specs: (r.exact_specs || []).map(cleanAiTells).slice(0, 5),
    answer: cleanAiTells(r.answer || ""),
    shop_price_low: num(r.shop_price_low),
    shop_price_high: num(r.shop_price_high) ?? num(r.shop_price_low),
    shop_label: cleanAiTells(r.shop_label || ""),
    options,
    diy: {
      doable: (["easy", "medium", "hard", "pro_only"] as const).includes(d.doable) ? d.doable : "medium",
      time: cleanAiTells(d.time || ""), tools: (d.tools || []).map(cleanAiTells).slice(0, 6), steps: (d.steps || []).map(cleanAiTells).slice(0, 7),
      video_search: d.video_search || `${String(r.what_it_is || p.text).replace(/\([^)]*\)/g, "").trim()} how to replace`, safety: cleanAiTells(d.safety || ""),
    },
    watch_out: cleanAiTells(r.watch_out || ""),
    cheaper_idea: cleanAiTells(r.cheaper_idea || ""),
    best_price: prices.length ? Math.min(...prices) : null,
    searches: total.server_tool_use.web_search_requests,
    cost: Math.round(costOf(FIND_MODEL, total as unknown as Anthropic.Usage) * 1000) / 1000,
  };
}

/** "Let us find it for you": free to ask; you only pay if we find it and you want it. Owner can change this here. */
export const FINDER_FEE = { pct: 10, min: 10, text: "Free to ask. If we find it and you want it, our finder's fee is 10% of the price (at least $10). No find, no fee." };
