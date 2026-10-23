import Anthropic from "@anthropic-ai/sdk";
import { LISTING_HONESTY, BUYER_VOICE } from "@/lib/ladder";
import { cleanAiTells, scrubPriceTalk, scrubSpecs } from "@/lib/listing";
import { aiImages } from "@/lib/usage";
import { askWithTool } from "@/lib/ai-tool";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Draft = Record<string, any> & { title?: string; description?: string; condition_notes?: string | null; specs?: Record<string, string>; tags?: string[] };

/**
 * The AI listing writer, shared by "Write listing" (/api/ai-listing) and the owner's Facebook import runner.
 * Throws on failure; callers handle refunds and messages.
 */
export async function draftListing({ photoUrls, hints, categories, ownerId }: { photoUrls: string[]; hints?: string; categories: { id: string; name: string }[]; ownerId: string | null }): Promise<Draft> {
  const client = new Anthropic();
  const catList = categories.map((c) => `${c.name} (${c.id})`).join("; ");

  // Structured answer (a tool call), not free JSON text: the old way got cut off at the word limit and came back blank (Oct 3, 2026).
  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "clear, searchable title, max 80 characters, brand + model + what it is (no ALL CAPS, no exclamation points)" },
      brand: { type: ["string", "null"] },
      model: { type: ["string", "null"], description: "model number" },
      category_id: { type: ["string", "null"], description: "id from the category list" },
      condition: { type: "string", enum: ["new", "like_new", "good", "fair", "for_parts"] },
      condition_notes: { type: ["string", "null"], description: "short buyer-facing note about wear, damage, missing parts, tested/untested" },
      description: { type: "string", description: "3-6 plain sentences a buyer wants: what it is, what it does, notable features, size, what's included. No hype. Never mention price or value." },
      specs: { type: "object", additionalProperties: { type: "string" }, description: "2-6 useful specs (Dimensions, Power, Capacity, Year, Color); omit unknowns" },
      tags: { type: "array", items: { type: "string" }, description: "12-20 search words and phrases buyers actually type on Facebook, eBay and Google: brand, model and model number, what it is, other names and spellings, category, use, era or style. Only words that truly describe this item: never another brand, never 'like X', 'not X', 'X style' or a question mark (marketplaces remove listings for that)." },
      price_min: { type: "number", description: "realistic low resale price in USD, local pickup" },
      price_max: { type: "number", description: "realistic high resale price in USD" },
      price_note: { type: "string", description: "one sentence on how you priced it and what would raise it" },
      weight_lbs: { type: "number", description: "packed shipping weight in pounds" },
      box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"] },
      worth_listing: { type: "boolean", description: "false if likely worth under $10 or junk" },
      recalled_or_prohibited: { type: ["string", "null"], description: "short warning if commonly recalled or not allowed on marketplaces, else null" },
    },
    required: ["title", "condition", "description", "tags", "price_min", "price_max", "price_note", "weight_lbs", "box", "worth_listing"],
  };
  const content: Anthropic.MessageParam["content"] = [
    ...(await aiImages(photoUrls.slice(0, 6))),
    {
      type: "text",
      text: `You are writing a resale listing for a surplus/used-goods business in Virginia. Look at the photos carefully: read every label, model number, brand mark, and sticker you can see. The seller's notes are true: if they say what the item is, use that, even if the photos are unclear.${LISTING_HONESTY}${BUYER_VOICE}
${hints ? `\nSeller notes: ${String(hints).slice(0, 1500)}\n` : ""}
Available categories (pick the single best one and return its id): ${catList}

Record the listing with the listing tool. Never put a price or dollar amount in the title, description, condition notes or specs.`,
    },
  ];


    const d = await askWithTool<{ title?: string; description?: string; condition_notes?: string | null; specs?: Record<string, string>; tags?: string[] }>(client, {
    model: MODEL, max_tokens: 2500, messages: [{ role: "user", content }],
    tool: { name: "listing", description: "Record the listing.", input_schema: schema as unknown as Anthropic.Tool.InputSchema },
    log: { ownerId, feature: "listing" },
  });
  d.description = scrubPriceTalk(d.description);
  d.condition_notes = d.condition_notes ? scrubPriceTalk(d.condition_notes) : d.condition_notes;
  d.specs = scrubSpecs(d.specs);
  if (d.title) d.title = cleanAiTells(d.title.replace(/\s*[-–(]?\s*\$\s?\d[\d,.]*\s*\)?/g, "").trim());
  if (!d.title || !d.description) throw new Error("The AI came back without a title or description.");
  return d;
}
