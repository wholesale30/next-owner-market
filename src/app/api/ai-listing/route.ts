import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LISTING_HONESTY, BUYER_VOICE } from "@/lib/ladder";
import { scrubPriceTalk, scrubSpecs } from "@/lib/listing";
import { aiImages, allowanceOf, outOfUsesMessage, refundUse } from "@/lib/usage";
import { askWithTool } from "@/lib/ai-tool";

export const maxDuration = 60;

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

/**
 * POST { photoUrls: string[], hints?: string, categories: {id,name}[] }
 * Returns a drafted listing from the photos.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  {
    const { admin } = await import("@/lib/stripe");
    const { data: ok } = await admin().rpc("spend_ai_credit", { p_profile: user.id });
    if (!ok) return NextResponse.json({ error: outOfUsesMessage(await allowanceOf(user.id)), upgrade: true, topup: true }, { status: 402 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }

  const { photoUrls, hints, categories } = (await req.json()) as {
    photoUrls: string[];
    hints?: string;
    categories: { id: string; name: string }[];
  };
  if (!photoUrls?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

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

  try {
    const d = await askWithTool<{ title?: string; description?: string; condition_notes?: string | null; specs?: Record<string, string>; tags?: string[] }>(client, {
      model: MODEL, max_tokens: 2500, messages: [{ role: "user", content }],
      tool: { name: "listing", description: "Record the listing.", input_schema: schema as unknown as Anthropic.Tool.InputSchema },
      log: { ownerId: user.id, feature: "listing" },
    });
    d.description = scrubPriceTalk(d.description);
    d.condition_notes = d.condition_notes ? scrubPriceTalk(d.condition_notes) : d.condition_notes;
    d.specs = scrubSpecs(d.specs);
    if (d.title) d.title = d.title.replace(/\s*[-–(]?\s*\$\s?\d[\d,.]*\s*\)?/g, "").trim();
    if (!d.title || !d.description) throw new Error("The AI came back without a title or description.");
    return NextResponse.json({ draft: d });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    await refundUse(user.id); // the listing didn't come out: give the use back
    const { admin } = await import("@/lib/stripe");
    await admin().from("settings").upsert({ key: `err:listing:${Date.now()}`, value: { message, photos: photoUrls.slice(0, 3), user: user.id, hints: hints || null } }).then(() => {}, () => {});
    return NextResponse.json({ error: "The AI couldn't read that one this time. Tap Try again, or fill it in yourself.", retry: true }, { status: 500 });
  }
}
