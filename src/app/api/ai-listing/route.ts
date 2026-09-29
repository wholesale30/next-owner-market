import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    if (!ok) return NextResponse.json({ error: "You've used your free AI listings. Upgrade to Pro for unlimited.", upgrade: true }, { status: 402 });
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

  const content: Anthropic.MessageParam["content"] = [
    ...photoUrls.slice(0, 6).map(
      (url) =>
        ({
          type: "image",
          source: { type: "url", url },
        }) as Anthropic.ImageBlockParam
    ),
    {
      type: "text",
      text: `You are writing a resale listing for a surplus/used-goods business in Virginia. Look at the photos carefully: read every label, model number, brand mark, and sticker you can see.

${hints ? `Seller notes: ${hints}\n` : ""}
Available categories (pick the single best one and return its id): ${catList}

Return ONLY a JSON object with these fields:
{
  "title": "clear, searchable title, max 80 characters, brand + model + what it is (no ALL CAPS, no exclamation points)",
  "brand": "brand or null",
  "model": "model number or null",
  "category_id": "id from the list",
  "condition": "one of: new, like_new, good, fair, for_parts (judge from photos; if unclear use good)",
  "condition_notes": "short honest note about visible wear, damage, or missing parts, or null",
  "description": "3-6 sentences a buyer would want: what it is, what it does, notable features, size if guessable, what's included. Plain and honest. No hype words like 'amazing'. Do not mention price.",
  "specs": { "key": "value" } (2-6 useful specs like Dimensions, Power, Capacity, Year, Color; omit unknowns),
  "tags": ["5-10 lowercase search terms buyers would type"],
  "price_min": number (realistic low resale price in USD for local pickup),
  "price_max": number (realistic high resale price in USD),
  "price_note": "one sentence on how you priced it and what would raise it (e.g. tested, box, accessories)",
  "worth_listing": true or false (false if it is likely worth under $10 or is junk),
  "recalled_or_prohibited": "null, or a short warning if this item type is commonly recalled or can't be sold on marketplaces"
}`,
    },
  ];

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return NextResponse.json({ draft: parsed, usage: msg.usage });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
