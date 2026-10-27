import Anthropic from "@anthropic-ai/sdk";
import { logUsage, costOf, aiImages } from "@/lib/usage";
import { cleanAiTells } from "@/lib/listing";

/**
 * 🔬 Advanced What's it worth (owner, Oct 26, 2026): "it actually tells how to check things. If it's electronic, it
 * tells how to test it… a Word document white paper on the details of how to test the thing, all what it's worth and
 * everything… store it in the app, but also do a downloadable white paper."
 * Follows Operating Rules 24/25: one expected price first, list AND fast price from real US comps and real retail,
 * parts and alternate-use values for old equipment, his own knowledge wins. Every link must have come back in a search.
 *
 * Two passes (Oct 26, 2026): one giant answer came back with half its lists empty (the B&K 1476A report had no test
 * steps and no listing). Pass 1 = identify, price, weight and box; pass 2 = how to test, faults, manuals, listing.
 * Each pass is checked and asked again if anything important is empty.
 */
export const DEEP_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const link = { type: "object", properties: { title: { type: "string" }, url: { type: "string", description: "only a URL that came back in your search results" } }, required: ["title", "url"] };
const strs = (d: string) => ({ type: "array", items: { type: "string" }, description: d });

const VALUE_SCHEMA = {
  type: "object",
  properties: {
    what: { type: "string", description: "exactly what it is: brand, model, type" },
    brand: { type: ["string", "null"] }, model: { type: ["string", "null"] },
    era: { type: ["string", "null"], description: "year or years made" },
    kind: { type: "string", enum: ["electronic", "electrical", "mechanical", "engine", "vehicle", "tool", "lab or medical", "collectible", "furniture", "other"] },
    summary: { type: "string", description: "3-4 plain sentences: what it is, who buys it, what it's worth and why" },
    specs: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] }, description: "5-12 key specs from the maker or manual: power, size, weight, ratings, inputs, original price" },
    expected_price: { type: "number", description: "the single most likely sale price as described, local pickup, USD" },
    list_price: { type: "number", description: "what to put in the price box to sell in 1-2 weeks with room for offers" },
    fast_price: { type: "number", description: "sells within a few days" },
    top_price: { type: "number", description: "patient seller, best case" },
    retail_new: { type: ["number", "null"], description: "new price today, or original price new if discontinued" },
    parts_value: { type: ["number", "null"], description: "what it brings for parts / not working" },
    scrap_value: { type: ["number", "null"] },
    value_why: { type: "string", description: "2-3 sentences: what the comps show, what moves the price" },
    hold: { type: "boolean", description: "true if worth holding for top dollar instead of dumping" },
    comps: { type: "array", items: { type: "object", properties: { where: { type: "string" }, what: { type: "string" }, price: { type: "number" }, sold: { type: "boolean" }, url: { type: ["string", "null"] } }, required: ["where", "what", "price", "sold", "url"] }, description: "4-8 real US prices you saw" },
    who_buys: strs("the kinds of buyers and where they shop"),
    alternate_uses: strs("parts harvest, scrap, prop, upcycle, education; required for old equipment"),
    item_lbs: { type: "number", description: "the item's own weight in pounds, from the maker's spec or a listing" },
    ship_lbs: { type: "number", description: "packed shipping weight: item plus about 15% and 1 lb for box and padding, rounded up" },
    box_l: { type: "number", description: "shipping box length in inches: item plus 2-3 in padding each side" }, box_w: { type: "number" }, box_h: { type: "number" },
    weight_source: { type: ["string", "null"], description: "URL of the page the weight came from, only if it came back in search" },
    ship_or_pickup: { type: "string", description: "one sentence: ship it or local only, and why (fragile, heavy, over 70 lb, oversize box)" },
    sources: { type: "array", items: link },
  },
  required: ["what", "brand", "model", "era", "kind", "summary", "specs", "expected_price", "list_price", "fast_price", "top_price", "retail_new", "parts_value", "scrap_value", "value_why", "hold", "comps", "who_buys", "alternate_uses", "item_lbs", "ship_lbs", "box_l", "box_w", "box_h", "weight_source", "ship_or_pickup", "sources"],
} as const;

const GUIDE_SCHEMA = {
  type: "object",
  properties: {
    safety: strs("safety warnings before touching or powering it (capacitors, mains voltage, refrigerant, pressure, fuel, heavy lift); empty only if truly none"),
    tools_needed: strs("tools and supplies to test it, cheapest workable option"),
    test_steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, how: { type: "string", description: "exactly what to do, plain words, step by step" }, good: { type: "string", description: "what you see/hear/measure if it's good" }, bad: { type: "string", description: "what a problem looks like and what it usually means" } }, required: ["title", "how", "good", "bad"] }, description: "6-14 ordered tests from a visual check and safe first power-up through every function, fitted to this exact model" },
    common_faults: { type: "array", items: { type: "object", properties: { fault: { type: "string" }, signs: { type: "string" }, fix: { type: "string" }, cost: { type: "string" } }, required: ["fault", "signs", "fix", "cost"] }, description: "3-8 known problems with this model or type" },
    value_after_fix: { type: ["string", "null"], description: "one sentence: is repair or service worth it for the price gain" },
    manuals: { type: "array", items: link, description: "owner's/service manual and schematic pages you found" },
    parts_sources: { type: "array", items: { type: "object", properties: { part: { type: "string" }, where: { type: "string" }, url: { type: ["string", "null"] } }, required: ["part", "where", "url"] } },
    check_before_listing: strs("2-5 things to check that change the price most"),
    listing_title: { type: "string", description: "max 80 chars: brand + model + what it is + key feature" },
    listing_description: { type: "string", description: "the FULL paste-ready description, 120-250 words, in the seller's voice: what it is and what it does, key specs, condition exactly as the owner said (works, cosmetic wear, rust) and what you see, what was tested, what's included, who it's great for, pickup/shipping line. Short paragraphs. Only flaws stated or visible. No price in the text." },
    listing_keywords: strs("12-20 search words buyers type: brand, model, other names, category, uses; never another brand or 'like X'"),
  },
  required: ["safety", "tools_needed", "test_steps", "common_faults", "value_after_fix", "manuals", "parts_sources", "check_before_listing", "listing_title", "listing_description", "listing_keywords"],
} as const;

type Link = { title: string; url: string | null };
export type DeepReport = {
  what: string; brand: string | null; model: string | null; era: string | null; kind: string; summary: string;
  specs: { label: string; value: string }[];
  expected_price: number; list_price: number; fast_price: number; top_price: number; retail_new: number | null; parts_value: number | null; scrap_value: number | null;
  value_why: string; hold: boolean; comps: { where: string; what: string; price: number; sold: boolean; url: string | null }[];
  item_lbs?: number | null; ship_lbs?: number | null; box_l?: number | null; box_w?: number | null; box_h?: number | null; weight_source?: string | null;
  safety: string[]; tools_needed: string[]; test_steps: { title: string; how: string; good: string; bad: string }[];
  common_faults: { fault: string; signs: string; fix: string; cost: string }[]; value_after_fix: string | null;
  manuals: Link[]; parts_sources: { part: string; where: string; url: string | null }[];
  alternate_uses: string[]; who_buys: string[]; ship_or_pickup: string;
  listing_title: string; listing_description: string; listing_keywords: string[]; check_before_listing: string[];
  sources: Link[]; searches: number; checked_at: string;
};
export type QA = { q: string; a: string; links: Link[]; at: string };

const today = () => new Date().toISOString().slice(0, 10);
const SYSTEM = () => `You are a senior appraiser and bench technician for a surplus warehouse in central Virginia that sells on Facebook Marketplace and eBay. Today is ${today()}. The owner has 30 years in surplus; what he tells you about the item (model, condition, what works) is true unless a photo clearly shows otherwise.
Identify the item exactly from the photos and notes: read every label, model and serial plate. Use web_search: eBay sold and current prices, Facebook/Craigslist asking prices, retail new, the maker's specs and weight, the owner's/service manual, known faults from repair forums (AudioKarma, BadCaps, EEVblog, model forums), how to test this exact model, parts sources. US prices only.
Prices come from what you saw; local pickup runs below eBay sold. top >= list >= expected >= fast. Never invent a URL. Plain words, short sentences, no dashes as punctuation.
When you call a record tool, every list must be a real JSON array of real entries, never text, never empty placeholders.`;

const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; server_tool_use: { web_search_requests: number } };
const newUsage = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 0 } });

/** the AI sometimes hands an array back as JSON text; accept either, never crash */
function arr<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (typeof x === "string") { try { const j = JSON.parse(x); if (Array.isArray(j)) return j as T[]; } catch { /* not JSON */ } }
  return [];
}

/**
 * Search-then-record loop. `check` returns what's missing ("" = good); if something's missing the AI is told exactly
 * what and asked to record again (up to 2 more times). Returns the tool input, the URLs seen, usage and the chat so far.
 */
async function runTool(client: Anthropic, p: { messages: Anthropic.MessageParam[]; tool: string; schema: unknown; maxSearches: number; maxTokens: number; check: (raw: Record<string, unknown>) => string; seen: Set<string>; total: Usage }) {
  const messages = p.messages;
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: p.maxSearches, user_location: { type: "approximate", country: "US" } },
    // not strict: the schema is too big for strict mode ("compiled grammar is too large"); `check` catches bad answers
    { name: p.tool, description: "Record the result. Call once, at the end, with every field filled.", input_schema: p.schema as Anthropic.Tool.InputSchema },
  ];
  let best: Record<string, unknown> | null = null;
  let fixes = 0;
  for (let round = 0; round < 8; round++) {
    const m = await client.messages.create({ model: DEEP_MODEL, max_tokens: p.maxTokens, system: SYSTEM(), tools, messages, tool_choice: round >= 4 ? { type: "tool", name: p.tool } : { type: "auto" } });
    const u = m.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } };
    p.total.input_tokens += u.input_tokens || 0; p.total.output_tokens += u.output_tokens || 0;
    p.total.cache_read_input_tokens += u.cache_read_input_tokens || 0; p.total.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
    p.total.server_tool_use.web_search_requests += u.server_tool_use?.web_search_requests || 0;
    let call: Anthropic.ToolUseBlock | null = null;
    for (const b of m.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.type === "web_search_result") p.seen.add(norm(r.url));
      if (b.type === "tool_use" && b.name === p.tool) call = b;
    }
    messages.push({ role: "assistant", content: m.content as Anthropic.ContentBlockParam[] });
    if (call) {
      const raw = call.input as Record<string, unknown>;
      best = raw;
      const missing = m.stop_reason === "max_tokens" ? "your answer was cut off (too long); keep each field shorter" : p.check(raw);
      if (!missing || fixes >= 2) break;
      fixes++;
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: `Not recorded: ${missing}. Call ${p.tool} again with every field filled in properly (lists as real JSON arrays).`, is_error: true }] });
      continue;
    }
    if (m.stop_reason !== "pause_turn") messages.push({ role: "user", content: `Now call ${p.tool} with what you found.` });
  }
  return best;
}

const keepUrl = (seen: Set<string>) => (u: string | null | undefined) => (u && seen.has(norm(u)) ? u : null);
const c = (s: unknown) => cleanAiTells(String(s ?? ""));
const has = (x: unknown, n: number, key?: string) => arr<Record<string, unknown>>(x).filter((e) => (key ? typeof e === "object" && e && String(e[key] || "").trim() : String(e || "").trim())).length >= n;

const checkValue = (r: Record<string, unknown>) => [
  !String(r.what || "").trim() && "what",
  !(Number(r.expected_price) > 0) && "expected_price",
  !has(r.specs, 3, "label") && "specs (at least 3 real specs)",
  !(Number(r.ship_lbs) > 0) && "ship_lbs",
  !(Number(r.box_l) > 0 && Number(r.box_w) > 0 && Number(r.box_h) > 0) && "box_l, box_w, box_h",
].filter(Boolean).join(", ");
const checkGuide = (r: Record<string, unknown>) => [
  !has(r.test_steps, 4, "how") && "test_steps (at least 4 real steps with how/good/bad)",
  !has(r.tools_needed, 1) && "tools_needed",
  !String(r.listing_title || "").trim() && "listing_title",
  String(r.listing_description || "").trim().length < 200 && "listing_description (the full description, 120-250 words)",
  !has(r.listing_keywords, 8) && "listing_keywords (12-20 words)",
].filter(Boolean).join(", ");

export async function deepCheck(client: Anthropic, p: { photoUrls: string[]; notes: string; ownerId: string }): Promise<{ report: DeepReport; cost: number }> {
  const seen = new Set<string>();
  const total = newUsage();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: [
    ...(await aiImages(p.photoUrls.slice(0, 6))),
    { type: "text", text: `${p.notes ? `Owner's notes: "${p.notes.slice(0, 1500)}"\n` : ""}Part 1 of 2: identify this item, find real prices, the maker's specs and weight, and the shipping box size. Then call record_value.` },
  ] }];
  const v = await runTool(client, { messages, tool: "record_value", schema: VALUE_SCHEMA, maxSearches: 6, maxTokens: 8000, check: checkValue, seen, total });
  if (!v) { await logUsage(p.ownerId, "deep_check", DEEP_MODEL, total as unknown as Anthropic.Usage); throw new Error("No report came back. Try again with a clearer photo of the label."); }
  messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: (messages[messages.length - 1].content as Anthropic.ContentBlockParam[]).filter((b): b is Anthropic.ToolUseBlock => (b as { type: string }).type === "tool_use").pop()?.id || "x", content: "Recorded." }, { type: "text", text: "Part 2 of 2: now how to test this exact model step by step, its known faults, manuals and parts, and the full listing. Search for the service manual and repair forums if you haven't. Then call record_guide." }] });
  const g = await runTool(client, { messages, tool: "record_guide", schema: GUIDE_SCHEMA, maxSearches: 4, maxTokens: 10000, check: checkGuide, seen, total });
  await logUsage(p.ownerId, "deep_check", DEEP_MODEL, total as unknown as Anthropic.Usage);
  if (!g) throw new Error("The test guide didn't come back. Try again.");
  const r = { ...v, ...g } as unknown as DeepReport & { item_lbs?: number; ship_lbs?: number };
  const keep = keepUrl(seen);
  const n = (x: unknown) => (typeof x === "number" && x > 0 ? Math.round(x) : 0);
  const nn = (x: unknown) => (typeof x === "number" && x > 0 ? Math.round(x) : null);
  const n1 = (x: unknown) => (Number(x) > 0 ? Math.round(Number(x) * 10) / 10 : null);
  const [top, list, exp, fast] = [n(r.top_price), n(r.list_price), n(r.expected_price), n(r.fast_price)].sort((a, b) => b - a);
  const links = (a: unknown) => arr<Link>(a).map((l) => ({ title: c(l?.title), url: keep(l?.url) })).filter((l) => l.url);
  const report: DeepReport = {
    what: c(r.what), brand: r.brand || null, model: r.model || null, era: r.era || null, kind: r.kind || "other", summary: c(r.summary),
    specs: arr<DeepReport["specs"][number]>(r.specs).filter((s) => s?.label).map((s) => ({ label: c(s.label), value: c(s.value) })),
    expected_price: exp, list_price: list, fast_price: fast, top_price: top, retail_new: nn(r.retail_new), parts_value: nn(r.parts_value), scrap_value: nn(r.scrap_value),
    value_why: c(r.value_why), hold: !!r.hold,
    comps: arr<DeepReport["comps"][number]>(r.comps).filter((x) => x && x.price > 0).slice(0, 8).map((x) => ({ where: c(x.where), what: c(x.what), price: Math.round(x.price), sold: !!x.sold, url: keep(x.url) })),
    item_lbs: n1(r.item_lbs), ship_lbs: n1(r.ship_lbs) ? Math.ceil(Number(r.ship_lbs)) : null, box_l: n1(r.box_l), box_w: n1(r.box_w), box_h: n1(r.box_h), weight_source: keep(r.weight_source),
    safety: arr<string>(r.safety).map(c).filter(Boolean), tools_needed: arr<string>(r.tools_needed).map(c).filter(Boolean),
    test_steps: arr<DeepReport["test_steps"][number]>(r.test_steps).filter((s) => s?.how).map((s) => ({ title: c(s.title), how: c(s.how), good: c(s.good), bad: c(s.bad) })),
    common_faults: arr<DeepReport["common_faults"][number]>(r.common_faults).filter((f) => f?.fault).map((f) => ({ fault: c(f.fault), signs: c(f.signs), fix: c(f.fix), cost: c(f.cost) })),
    value_after_fix: r.value_after_fix ? c(r.value_after_fix) : null,
    manuals: links(r.manuals), parts_sources: arr<DeepReport["parts_sources"][number]>(r.parts_sources).filter((x) => x?.part).map((x) => ({ part: c(x.part), where: c(x.where), url: keep(x.url) })),
    alternate_uses: arr<string>(r.alternate_uses).map(c).filter(Boolean), who_buys: arr<string>(r.who_buys).map(c).filter(Boolean), ship_or_pickup: c(r.ship_or_pickup),
    listing_title: c(r.listing_title).slice(0, 100), listing_description: c(r.listing_description), listing_keywords: arr<string>(r.listing_keywords).map(String).filter(Boolean).slice(0, 20),
    check_before_listing: arr<string>(r.check_before_listing).map(c).filter(Boolean), sources: links(r.sources),
    searches: total.server_tool_use.web_search_requests, checked_at: new Date().toISOString(),
  };
  return { report, cost: Math.round(costOf(DEEP_MODEL, total as unknown as Anthropic.Usage) * 1000) / 1000 };
}

const QA_SCHEMA = { type: "object", properties: { answer: { type: "string", description: "the full answer in plain words; step by step when it's a how-to" }, links: { type: "array", items: link } }, required: ["answer", "links"] } as const;

/** a follow-up question about a saved report; searches again when it helps */
export async function deepAsk(client: Anthropic, p: { report: DeepReport; qa: QA[]; question: string; photoUrls: string[]; ownerId: string }): Promise<{ qa: QA; cost: number }> {
  const context = `The item: ${p.report.what}${p.report.era ? ` (${p.report.era})` : ""}.\nSaved report summary: ${p.report.summary}\nPrices: expected $${p.report.expected_price}, list $${p.report.list_price}, fast $${p.report.fast_price}.\n${p.qa.slice(-6).map((x) => `Earlier Q: ${x.q}\nA: ${x.a.slice(0, 800)}`).join("\n")}`;
  const seen = new Set<string>();
  const total = newUsage();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: [
    ...(await aiImages(p.photoUrls.slice(0, 3))),
    { type: "text", text: `${context}\n\nOwner's question: "${p.question.slice(0, 1500)}"\nAnswer it fully. Search if it helps (manuals, forums, prices). Then call record_answer.` },
  ] }];
  const raw = await runTool(client, { messages, tool: "record_answer", schema: QA_SCHEMA, maxSearches: 4, maxTokens: 6000, check: (x) => (String(x.answer || "").trim() ? "" : "answer"), seen, total });
  await logUsage(p.ownerId, "deep_ask", DEEP_MODEL, total as unknown as Anthropic.Usage);
  if (!raw) throw new Error("No answer came back. Try asking again.");
  const r = raw as { answer: string; links: Link[] };
  const keep = keepUrl(seen);
  return {
    qa: { q: p.question.trim(), a: c(r.answer), links: arr<Link>(r.links).map((l) => ({ title: c(l?.title), url: keep(l?.url) })).filter((l) => l.url), at: new Date().toISOString() },
    cost: Math.round(costOf(DEEP_MODEL, total as unknown as Anthropic.Usage) * 1000) / 1000,
  };
}
