import Anthropic from "@anthropic-ai/sdk";
import { logUsage, costOf, aiImages } from "@/lib/usage";
import { cleanAiTells } from "@/lib/listing";

/**
 * 🔬 Advanced What's it worth (owner, Oct 26, 2026): "it actually tells how to check things. If it's electronic, it
 * tells how to test it… a Word document white paper on the details of how to test the thing, all what it's worth and
 * everything… store it in the app, but also do a downloadable white paper."
 * Follows Operating Rules 24/25: one expected price first, list AND fast price from real US comps and real retail,
 * parts and alternate-use values for old equipment, his own knowledge wins. Every link must have come back in a search.
 */
export const DEEP_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const link = { type: "object", properties: { title: { type: "string" }, url: { type: "string", description: "only a URL that came back in your search results" } } };
const SCHEMA = {
  type: "object",
  properties: {
    what: { type: "string", description: "exactly what it is: brand, model, type" },
    brand: { type: ["string", "null"] }, model: { type: ["string", "null"] },
    era: { type: ["string", "null"], description: "year or years made" },
    kind: { type: "string", enum: ["electronic", "electrical", "mechanical", "engine", "vehicle", "tool", "lab or medical", "collectible", "furniture", "other"] },
    summary: { type: "string", description: "3-4 plain sentences: what it is, who buys it, what it's worth and why" },
    specs: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } } }, description: "key specs from the maker or manual: power, size, weight, ratings, inputs, original price" },
    expected_price: { type: "number", description: "the single most likely sale price as described, local pickup, USD" },
    list_price: { type: "number", description: "what to put in the price box to sell in 1-2 weeks with room for offers" },
    fast_price: { type: "number", description: "sells within a few days" },
    top_price: { type: "number", description: "patient seller, best case, working and clean" },
    retail_new: { type: ["number", "null"], description: "new price today at a real store, or original price new if discontinued (say which in value_why)" },
    parts_value: { type: ["number", "null"], description: "what it brings sold for parts / not working" },
    scrap_value: { type: ["number", "null"], description: "metal or scrap value if nothing else" },
    value_why: { type: "string", description: "2-3 sentences: what the comps show, what moves the price up or down (working vs not, serviced, original box, cosmetic)" },
    hold: { type: "boolean", description: "true if worth holding for top dollar instead of dumping" },
    comps: { type: "array", items: { type: "object", properties: { where: { type: "string" }, what: { type: "string" }, price: { type: "number" }, sold: { type: "boolean" }, url: { type: ["string", "null"] } } }, description: "4-8 real US prices you saw" },
    safety: { type: "array", items: { type: "string" }, description: "safety warnings before touching or powering it (capacitors, mains voltage, refrigerant, pressure, fuel, lead, mercury, heavy lift). Empty if none." },
    tools_needed: { type: "array", items: { type: "string" }, description: "tools and supplies to test it, cheapest workable option (e.g. multimeter, dim-bulb tester or variac, test speakers, CD, battery)" },
    test_steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, how: { type: "string", description: "exactly what to do, plain words, step by step" }, good: { type: "string", description: "what you see/hear/measure if it's good" }, bad: { type: "string", description: "what a problem looks like and what it usually means" } } }, description: "6-14 ordered tests from a visual check and safe first power-up through every function. For vintage electronics include slow power-up (dim-bulb or variac), checking fuses, DC offset / bias where it applies, every input, both channels. For engines: compression, spark, fuel. Fit the tests to this exact item." },
    common_faults: { type: "array", items: { type: "object", properties: { fault: { type: "string" }, signs: { type: "string" }, fix: { type: "string" }, cost: { type: "string", description: "rough parts/repair cost" } } }, description: "known problems with this model or type, from forums and service notes" },
    value_after_fix: { type: ["string", "null"], description: "one sentence: is repairing or servicing worth it for the price gain" },
    manuals: { type: "array", items: link, description: "owner's/service manual and schematic pages you found" },
    parts_sources: { type: "array", items: { type: "object", properties: { part: { type: "string" }, where: { type: "string" }, url: { type: ["string", "null"] } } }, description: "where to get replacement parts (belts, lamps, caps, knobs, filters)" },
    alternate_uses: { type: "array", items: { type: "string" }, description: "other buyers or uses: parts harvest, scrap metal, prop, upcycle, education. Required for old equipment." },
    who_buys: { type: "array", items: { type: "string" }, description: "the kinds of buyers and where they shop (eBay, audio forums, Facebook groups, local shops)" },
    ship_or_pickup: { type: "string", description: "one sentence: ship it or local only, packed weight and box size" },
    listing_title: { type: "string", description: "max 80 chars: brand + model + what it is + key feature" },
    listing_description: { type: "string", description: "honest, paste-ready, seller's voice; only flaws that are visible or stated; ends with what's included" },
    listing_keywords: { type: "array", items: { type: "string" }, description: "12-20 search words buyers type; never another brand, never 'like X'" },
    check_before_listing: { type: "array", items: { type: "string" }, description: "the 2-5 things the owner should check that change the price most" },
    sources: { type: "array", items: link, description: "pages you used" },
  },
  required: ["what", "kind", "summary", "specs", "expected_price", "list_price", "fast_price", "top_price", "value_why", "hold", "comps", "safety", "tools_needed", "test_steps", "common_faults", "manuals", "parts_sources", "alternate_uses", "who_buys", "ship_or_pickup", "listing_title", "listing_description", "listing_keywords", "check_before_listing", "sources"],
} as const;

type Link = { title: string; url: string | null };
export type DeepReport = {
  what: string; brand: string | null; model: string | null; era: string | null; kind: string; summary: string;
  specs: { label: string; value: string }[];
  expected_price: number; list_price: number; fast_price: number; top_price: number; retail_new: number | null; parts_value: number | null; scrap_value: number | null;
  value_why: string; hold: boolean; comps: { where: string; what: string; price: number; sold: boolean; url: string | null }[];
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
1. Identify the item exactly from the photos and notes: read every label, model and serial plate.
2. Use web_search a lot: eBay sold and current prices, Facebook/Craigslist asking prices, retail new; the owner's/service manual; known faults from repair forums (AudioKarma, BadCaps, EEVblog, model-specific forums); how to test this exact model; parts sources. US prices only.
3. Call record_report once at the end. Prices come from what you saw; local pickup runs below eBay sold. top >= list >= expected >= fast. Testing steps must be safe, concrete and in order, written so a careful non-technician can follow them, with what good and bad results look like. Never invent a URL. Plain words, short sentences, no dashes as punctuation.`;

const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; server_tool_use: { web_search_requests: number } };
const newUsage = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 0 } });

/** run a search-then-record loop; returns the recorded tool input, the set of URLs that came back, and usage */
async function runTool(client: Anthropic, p: { system: string; content: Anthropic.ContentBlockParam[]; tool: string; schema: unknown; maxSearches: number; maxTokens: number; history?: Anthropic.MessageParam[] }) {
  const messages: Anthropic.MessageParam[] = [...(p.history || []), { role: "user", content: p.content }];
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: p.maxSearches, user_location: { type: "approximate", country: "US" } },
    // not strict: this schema is too big for strict mode ("compiled grammar is too large"); fields are checked below instead
    { name: p.tool, description: "Record the result. Call once, at the end.", input_schema: p.schema as Anthropic.Tool.InputSchema },
  ];
  const seen = new Set<string>();
  const total = newUsage();
  let raw: Record<string, unknown> | null = null;
  for (let round = 0; round < 6 && !raw; round++) {
    const m = await client.messages.create({ model: DEEP_MODEL, max_tokens: p.maxTokens, system: p.system, tools, messages, tool_choice: round >= 4 ? { type: "tool", name: p.tool } : { type: "auto" } });
    const u = m.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } };
    total.input_tokens += u.input_tokens || 0; total.output_tokens += u.output_tokens || 0;
    total.cache_read_input_tokens += u.cache_read_input_tokens || 0; total.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
    total.server_tool_use.web_search_requests += u.server_tool_use?.web_search_requests || 0;
    for (const b of m.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.type === "web_search_result") seen.add(norm(r.url));
      if (b.type === "tool_use" && b.name === p.tool) raw = b.input as Record<string, unknown>;
    }
    if (raw) break;
    messages.push({ role: "assistant", content: m.content as Anthropic.ContentBlockParam[] });
    if (m.stop_reason !== "pause_turn") messages.push({ role: "user", content: `Now call ${p.tool} with what you found.` });
  }
  return { raw, seen, total };
}

const keepUrl = (seen: Set<string>) => (u: string | null | undefined) => (u && seen.has(norm(u)) ? u : null);
const c = (s: unknown) => cleanAiTells(String(s ?? ""));
/** the AI sometimes hands an array back as JSON text; accept either, never crash */
function arr<T>(x: unknown): T[] { if (Array.isArray(x)) return x as T[]; if (typeof x === "string") { try { const j = JSON.parse(x); if (Array.isArray(j)) return j as T[]; } catch { /* plain text */ } return x.trim() ? [x as unknown as T] : []; } return []; }

export async function deepCheck(client: Anthropic, p: { photoUrls: string[]; notes: string; ownerId: string }): Promise<{ report: DeepReport; cost: number }> {
  const content: Anthropic.ContentBlockParam[] = [
    ...(await aiImages(p.photoUrls.slice(0, 6))),
    { type: "text", text: `${p.notes ? `Owner's notes: "${p.notes.slice(0, 1500)}"\n` : ""}Do the full advanced appraisal and test guide for this item.` },
  ];
  const { raw, seen, total } = await runTool(client, { system: SYSTEM(), content, tool: "record_report", schema: SCHEMA, maxSearches: 8, maxTokens: 12000 });
  await logUsage(p.ownerId, "deep_check", DEEP_MODEL, total as unknown as Anthropic.Usage);
  if (!raw) throw new Error("No report came back. Try again with a clearer photo of the label.");
  const r = raw as unknown as DeepReport;
  const keep = keepUrl(seen);
  const n = (x: unknown) => (typeof x === "number" && x > 0 ? Math.round(x) : 0);
  const nn = (x: unknown) => (typeof x === "number" && x > 0 ? Math.round(x) : null);
  const [top, list, exp, fast] = [n(r.top_price), n(r.list_price), n(r.expected_price), n(r.fast_price)].sort((a, b) => b - a);
  const links = (a: unknown) => arr<Link>(a).map((l) => ({ title: c(l.title), url: keep(l.url) })).filter((l) => l.url);
  const report: DeepReport = {
    what: c(r.what), brand: r.brand || null, model: r.model || null, era: r.era || null, kind: r.kind || "other", summary: c(r.summary),
    specs: arr<DeepReport["specs"][number]>(r.specs).map((s) => ({ label: c(s.label), value: c(s.value) })),
    expected_price: exp, list_price: list, fast_price: fast, top_price: top, retail_new: nn(r.retail_new), parts_value: nn(r.parts_value), scrap_value: nn(r.scrap_value),
    value_why: c(r.value_why), hold: !!r.hold,
    comps: arr<DeepReport["comps"][number]>(r.comps).filter((x) => x && x.price > 0).slice(0, 8).map((x) => ({ where: c(x.where), what: c(x.what), price: Math.round(x.price), sold: !!x.sold, url: keep(x.url) })),
    safety: arr<DeepReport["safety"][number]>(r.safety).map(c), tools_needed: arr<DeepReport["tools_needed"][number]>(r.tools_needed).map(c),
    test_steps: arr<DeepReport["test_steps"][number]>(r.test_steps).map((s) => ({ title: c(s.title), how: c(s.how), good: c(s.good), bad: c(s.bad) })),
    common_faults: arr<DeepReport["common_faults"][number]>(r.common_faults).map((f) => ({ fault: c(f.fault), signs: c(f.signs), fix: c(f.fix), cost: c(f.cost) })),
    value_after_fix: r.value_after_fix ? c(r.value_after_fix) : null,
    manuals: links(r.manuals), parts_sources: arr<DeepReport["parts_sources"][number]>(r.parts_sources).map((x) => ({ part: c(x.part), where: c(x.where), url: keep(x.url) })),
    alternate_uses: arr<DeepReport["alternate_uses"][number]>(r.alternate_uses).map(c), who_buys: arr<DeepReport["who_buys"][number]>(r.who_buys).map(c), ship_or_pickup: c(r.ship_or_pickup),
    listing_title: c(r.listing_title).slice(0, 100), listing_description: c(r.listing_description), listing_keywords: arr<DeepReport["listing_keywords"][number]>(r.listing_keywords).map(String).slice(0, 20),
    check_before_listing: arr<DeepReport["check_before_listing"][number]>(r.check_before_listing).map(c), sources: links(r.sources),
    searches: total.server_tool_use.web_search_requests, checked_at: new Date().toISOString(),
  };
  return { report, cost: Math.round(costOf(DEEP_MODEL, total as unknown as Anthropic.Usage) * 1000) / 1000 };
}

const QA_SCHEMA = { type: "object", properties: { answer: { type: "string", description: "the full answer in plain words; step by step when it's a how-to" }, links: { type: "array", items: link } }, required: ["answer", "links"] } as const;

/** a follow-up question about a saved report; searches again when it helps */
export async function deepAsk(client: Anthropic, p: { report: DeepReport; qa: QA[]; question: string; photoUrls: string[]; ownerId: string }): Promise<{ qa: QA; cost: number }> {
  const context = `The item: ${p.report.what}${p.report.era ? ` (${p.report.era})` : ""}.\nSaved report summary: ${p.report.summary}\nPrices: expected $${p.report.expected_price}, list $${p.report.list_price}, fast $${p.report.fast_price}.\n${p.qa.slice(-6).map((x) => `Earlier Q: ${x.q}\nA: ${x.a.slice(0, 800)}`).join("\n")}`;
  const content: Anthropic.ContentBlockParam[] = [
    ...(await aiImages(p.photoUrls.slice(0, 3))),
    { type: "text", text: `${context}\n\nOwner's question: "${p.question.slice(0, 1500)}"\nAnswer it fully. Search if it helps (manuals, forums, prices). Then call record_answer.` },
  ];
  const { raw, seen, total } = await runTool(client, { system: SYSTEM(), content, tool: "record_answer", schema: QA_SCHEMA, maxSearches: 4, maxTokens: 6000 });
  await logUsage(p.ownerId, "deep_ask", DEEP_MODEL, total as unknown as Anthropic.Usage);
  if (!raw) throw new Error("No answer came back. Try asking again.");
  const r = raw as { answer: string; links: Link[] };
  const keep = keepUrl(seen);
  return {
    qa: { q: p.question.trim(), a: c(r.answer), links: arr<Link>(r.links).map((l) => ({ title: c(l.title), url: keep(l.url) })).filter((l) => l.url), at: new Date().toISOString() },
    cost: Math.round(costOf(DEEP_MODEL, total as unknown as Anthropic.Usage) * 1000) / 1000,
  };
}
