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
  const content: Anthropic.MessageParam["content"] = [
    ...photoUrls.slice(0, 6).map((url) => ({ type: "image", source: { type: "url", url } }) as Anthropic.ImageBlockParam),
    { type: "text", text: `You are an experienced US resale appraiser (30 years of estate sales, surplus, eBay, and Facebook Marketplace). Identify what is in the photos: read every label, model number, brand mark, and sticker. ${hints ? `The owner says: "${hints}". ` : ""}Be honest and specific; a wrong "it's worth $500" costs people money. If it's common junk, say so kindly.

Return ONLY a JSON object:
{
  "what": "one line: what it is, brand and model if visible",
  "era": "approximate year or decade, or null",
  "condition_guess": "one short sentence on visible condition",
  "value_low": number (realistic quick-sale price in USD, local),
  "value_high": number (realistic patient-seller price in USD, listed well with good photos),
  "retail_new": number or null (what it costs new today, if still made),
  "confidence": "high" | "medium" | "low",
  "why": "2-3 sentences on what drives the value: demand, rarity, condition, what buyers look for",
  "raise_value": ["2-4 short things that would raise the price: test it, include the remote, clean it, find the manual"],
  "best_places": [{"place": "eBay|Facebook Marketplace|OfferUp|Craigslist|Mercari|Poshmark|Etsy|Local auction|Scrap|Donate", "why": "short reason"}] (2-3 entries, best first),
  "ship_or_local": "ship" | "local" | "either",
  "watch_out": "one sentence: recalls, fakes, common scams, or null",
  "listing": { "title": "max 80 chars, brand + model + what it is", "description": "3-5 honest sentences a buyer wants" },
  "weight_lbs": number (packed shipping weight estimate),
  "box": "small|medium|large|xl|freight"
}` },
  ];
  let raw = "";
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content }] });
    raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return NextResponse.json({ result: parsed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin().from("settings").upsert({ key: `err:worth:${Date.now()}`, value: { message, raw: raw.slice(0, 2000), photos: photoUrls.slice(0, 3), user: user.id } }).then(() => {}, () => {});
    await admin().from("profiles").update({ ai_credits: (me?.ai_credits ?? 0) + 1 }).eq("id", user.id).then(() => {}, () => {});
    return NextResponse.json({ error: "Couldn't read that one. Try a clearer photo of the whole item, or add a note about what it is." }, { status: 500 });
  }
}
