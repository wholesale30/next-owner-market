import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";

export const maxDuration = 60;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

/** POST { photoUrls: string[], hints?: string } → appraisal. Uses one AI credit (Pro/staff unlimited). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first (it's free)." }, { status: 401 });
  const { data: me } = await admin().from("profiles").select("ai_credits").eq("id", user.id).single();
  const { data: ok } = await admin().rpc("spend_ai_credit", { p_profile: user.id });
  if (!ok) return NextResponse.json({ error: "You've used your free lookups. Pro gives you unlimited for $15/month.", upgrade: true }, { status: 402 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Not available right now." }, { status: 500 });
  const { photoUrls, hints } = (await req.json()) as { photoUrls: string[]; hints?: string };
  if (!photoUrls?.length) return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });

  const client = new Anthropic();
  const schema = {
    type: "object",
    properties: {
      what: { type: "string", description: "one line: what it is, brand and model if visible" },
      era: { type: ["string", "null"], description: "approximate year or decade" },
      condition_guess: { type: "string" },
      value_low: { type: "number", description: "realistic quick-sale price in USD, local" },
      value_high: { type: "number", description: "realistic patient-seller price in USD, listed well" },
      retail_new: { type: ["number", "null"], description: "price new today if still made" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      why: { type: "string", description: "2-3 sentences on what drives the value" },
      raise_value: { type: "array", items: { type: "string" }, description: "2-4 short things that would raise the price" },
      best_places: { type: "array", items: { type: "object", properties: { place: { type: "string" }, why: { type: "string" } }, required: ["place", "why"] }, description: "2-3 entries, best first: eBay, Facebook Marketplace, OfferUp, Craigslist, Mercari, Poshmark, Etsy, Local auction, Scrap, Donate" },
      ship_or_local: { type: "string", enum: ["ship", "local", "either"] },
      watch_out: { type: ["string", "null"], description: "recalls, fakes, common scams" },
      listing: { type: "object", properties: { title: { type: "string", description: "max 80 chars, brand + model + what it is" }, description: { type: "string", description: "3-5 honest sentences a buyer wants" } }, required: ["title", "description"] },
      weight_lbs: { type: "number", description: "packed shipping weight estimate" },
      box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"] },
    },
    required: ["what", "condition_guess", "value_low", "value_high", "confidence", "why", "raise_value", "best_places", "ship_or_local", "listing", "weight_lbs", "box"],
  } as const;
  const content: Anthropic.MessageParam["content"] = [
    ...photoUrls.slice(0, 6).map((url) => ({ type: "image", source: { type: "url", url } }) as Anthropic.ImageBlockParam),
    { type: "text", text: `You are an experienced US resale appraiser (30 years of estate sales, surplus, eBay, and Facebook Marketplace). Identify what is in the photos: read every label, model number, brand mark, and sticker. ${hints ? `The owner says: "${hints}". ` : ""}Be honest and specific; a wrong "it's worth $500" costs people money. If it's common junk, say so kindly. Record your appraisal with the appraise tool.` },
  ];
  let raw = "";
  try {
    const msg = await client.messages.create({
      model: MODEL, max_tokens: 2000, messages: [{ role: "user", content }],
      tools: [{ name: "appraise", description: "Record the appraisal.", input_schema: schema as unknown as Anthropic.Tool.InputSchema }],
      tool_choice: { type: "tool", name: "appraise" },
    });
    const call = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    raw = JSON.stringify(call?.input ?? msg.content);
    if (!call) throw new Error("No appraisal returned");
    return NextResponse.json({ result: call.input });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin().from("settings").upsert({ key: `err:worth:${Date.now()}`, value: { message, raw: raw.slice(0, 2000), photos: photoUrls.slice(0, 3), user: user.id } }).then(() => {}, () => {});
    await admin().from("profiles").update({ ai_credits: (me?.ai_credits ?? 0) + 1 }).eq("id", user.id).then(() => {}, () => {});
    return NextResponse.json({ error: "Couldn't read that one. Try a clearer photo of the whole item, or add a note about what it is." }, { status: 500 });
  }
}
