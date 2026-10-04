import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { scrubPriceTalk } from "@/lib/listing";
import { askWithTool } from "@/lib/ai-tool";
import { PART_SCHEMA, PART_PROMPT, withPartLinks, type MissingPart } from "@/lib/parts";
import { LADDER_SCHEMA, LADDER_PROMPT, LISTING_HONESTY, BUYER_VOICE, cleanLadder, type Ladder } from "@/lib/ladder";
import { createHash } from "crypto";
import { saveLookup } from "@/lib/lookups";
import { ORIGIN_SCHEMA, ORIGIN_PROMPT, cleanOrigin } from "@/lib/origin";
import { aiImages, allowanceOf, outOfUsesMessage, refundUse } from "@/lib/usage";

export const maxDuration = 120;

/** Accept the listing as an object, JSON text, or the AI's "<parameter name=...>" text; fall back to what/why. */
function toListing(v: unknown, what?: string, why?: string): { title: string; description: string; condition?: string; keywords?: string[] } {
  if (v && typeof v === "object" && typeof (v as { title?: unknown }).title === "string") {
    const o = v as { title: string; description?: string; condition?: string; keywords?: unknown };
    return { title: o.title, description: String(o.description || why || ""), condition: o.condition ? String(o.condition) : undefined, keywords: Array.isArray(o.keywords) ? o.keywords.map(String).slice(0, 25) : [] };
  }
  if (typeof v === "string") {
    try { const j = JSON.parse(v); if (j && typeof j.title === "string") return { title: j.title, description: String(j.description || why || "") }; } catch { /* not JSON */ }
    const grab = (k: string) => (new RegExp(`<parameter name="${k}">([\\s\\S]*?)(?:</parameter>|<parameter|$)`).exec(v)?.[1] || "").trim();
    const title = grab("title"), description = grab("description");
    if (title) return { title: title.slice(0, 80), description: description || String(why || "") };
  }
  return { title: String(what || "Item").slice(0, 80), description: String(why || "") };
}
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

/** POST { photoUrls: string[], hints?: string, correction?, previous? } → appraisal. Uses one AI use; the first 2 fixes of a lookup are free, after that a fix counts as a use. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first (it's free)." }, { status: 401 });
  const { photoUrls, hints, correction, previous, lookup_id } = (await req.json()) as { photoUrls: string[]; hints?: string; correction?: string; previous?: { what?: string; value_low?: number; value_high?: number; era?: string | null }; lookup_id?: string };
  const fixing = !!(correction && correction.trim() && previous);
  let charged = false;
  const spend = async () => {
    const { data: ok } = await admin().rpc("spend_ai_credit", { p_profile: user.id });
    if (ok) charged = true;
    return !!ok;
  };
  const noUses = async () => NextResponse.json({ error: outOfUsesMessage(await allowanceOf(user.id)), upgrade: true, topup: true }, { status: 402 });
  if (fixing) {
    // Fixes: the first 2 on each lookup are free (it's our answer being fixed); after that each counts as a use. Never more than 30 a day.
    const day = new Date().toISOString().slice(0, 10);
    const dayKey = `fix:${user.id}:${day}`;
    const lookKey = `fix:w:${createHash("sha256").update(user.id + (photoUrls || []).slice().sort().join("|")).digest("hex").slice(0, 20)}`;
    const [{ data: c }, { data: l }] = await Promise.all([
      admin().from("settings").select("value").eq("key", dayKey).maybeSingle(),
      admin().from("settings").select("value").eq("key", lookKey).maybeSingle(),
    ]);
    const n = Number((c?.value as { n?: number } | null)?.n || 0), k = Number((l?.value as { n?: number } | null)?.n || 0);
    if (n >= 30) return NextResponse.json({ error: "That's a lot of fixes for one day. Start a fresh lookup instead." }, { status: 429 });
    if (k >= 2 && !(await spend())) return noUses();
    await admin().from("settings").upsert([{ key: dayKey, value: { n: n + 1 } }, { key: lookKey, value: { n: k + 1 } }]);
  } else if (!(await spend())) return noUses();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Not available right now." }, { status: 500 });
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
      listing: { type: "object", properties: { title: { type: "string", description: "max 80 chars, brand + model + what it is" }, description: { type: "string", description: "3-5 honest sentences a buyer wants, in the seller's voice" }, condition: { type: "string", description: "one short line for the buyer, e.g. 'New, never used. Untested.' or 'Used, works, light wear.'" }, keywords: { type: "array", items: { type: "string" }, description: "12-20 search words and phrases buyers actually type on Facebook, eBay and Google: brand, model and model number, what it is, common other names and spellings, category, use, era or style. Relevant only; no unrelated brands" } }, required: ["title", "description", "condition", "keywords"] },
      weight_lbs: { type: "number", description: "packed shipping weight estimate" },
      box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"] },
      missing_parts: PART_SCHEMA,
      condition_ladder: LADDER_SCHEMA,
      origin: ORIGIN_SCHEMA,
      pieces: {
        type: "array", maxItems: 20,
        description: "ONLY when the photos show 2 or more separate sellable items (a stack, a box, a set that can be split). One entry per piece; identical pieces can share an entry with qty. Leave empty for a single item. When filled, value_low/value_high and listing are for selling them ALL together as one lot.",
        items: { type: "object", properties: {
          name: { type: "string", description: "brand + model, e.g. 'General Instrument 4DTV DSR922'" },
          qty: { type: "number" },
          value_low: { type: "number", description: "each, sold alone" }, value_high: { type: "number", description: "each, sold alone" },
          note: { type: "string", description: "one short sentence: why it's worth that (demand, rarity, condition)" },
          listing_title: { type: "string", description: "max 80 chars" },
          listing_description: { type: "string", description: "2-4 honest sentences for selling this one alone" },
          keywords: { type: "array", items: { type: "string" }, description: "8-15 search words for this piece alone" },
          year_made: { type: ["string", "null"], description: "year or range this piece was made, if you can tell" },
          original_price: { type: ["number", "null"], description: "what this piece sold for new when it came out, USD, if known" },
        }, required: ["name", "qty", "value_low", "value_high", "note", "listing_title", "listing_description"] },
      },
      sell_advice: { type: ["string", "null"], description: "when pieces is filled: one sentence, sell as a lot or one by one, and why (time, shipping, which pieces to pull out and sell alone)" },
    },
    required: ["what", "condition_guess", "value_low", "value_high", "confidence", "why", "raise_value", "best_places", "ship_or_local", "listing", "weight_lbs", "box", "condition_ladder", "origin"],
  } as const;
  const content: Anthropic.MessageParam["content"] = [
    ...(await aiImages(photoUrls.slice(0, 6))),
    { type: "text", text: `You are an experienced US resale appraiser (30 years of estate sales, surplus, eBay, and Facebook Marketplace). Identify what is in the photos: read every label, model number, brand mark, and sticker. ${hints ? `The owner says: "${String(hints).slice(0, 500)}". ` : ""}${fixing ? `Your earlier answer said this was "${String(previous?.what || "").slice(0, 200)}"${previous?.era ? ` (${String(previous.era).slice(0, 60)})` : ""}, worth about $${Math.round(Number(previous?.value_low || 0))}-$${Math.round(Number(previous?.value_high || 0))}. The owner says that's not right: "${String(correction).slice(0, 600)}". Look at the photos again with this correction. Trust what the owner tells you about the item (exact model, year, what's missing or broken, condition, what it came with) unless the photos clearly show otherwise, and redo the identification and value from scratch. In "why", say in one sentence what changed. ` : ""}Be honest and specific; a wrong "it's worth $500" costs people money. If it's common junk, say so kindly. If the photos show several separate items (a stack of receivers, a box of tools, a set of dishes that can be split), price the whole lot AND list every piece in "pieces" with its own value sold alone; a lot usually sells for less than the pieces added up, so be realistic about both.${LADDER_PROMPT}${ORIGIN_PROMPT}${LISTING_HONESTY}${BUYER_VOICE}${PART_PROMPT} Record your appraisal with the appraise tool.` },
  ];
  let raw = "";
  try {
    const input = await askWithTool(client, { model: MODEL, max_tokens: 5000, messages: [{ role: "user", content }], tool: { name: "appraise", description: "Record the appraisal.", input_schema: schema as unknown as Anthropic.Tool.InputSchema }, log: { ownerId: user.id, feature: fixing ? "worth_fix" : "worth" } });
    raw = JSON.stringify(input);
    const call = { input };
    const out = call.input as { what?: string; why?: string; listing?: { title: string; description: string } | string; missing_parts?: MissingPart[]; condition_ladder?: unknown };
    // Now and then the AI hands a nested field back as text instead of an object. Rescue it instead of failing.
    out.listing = toListing(out.listing, out.what, out.why);
    if (typeof out.condition_ladder === "string") { try { out.condition_ladder = JSON.parse(out.condition_ladder); } catch { out.condition_ladder = null; } }
    out.listing.description = scrubPriceTalk(out.listing.description);
    const o2 = out as { pieces?: { listing_description: string }[] };
    if (Array.isArray(o2.pieces)) { if (o2.pieces.length < 2 && !o2.pieces.some((x) => Number((x as { qty?: number }).qty) > 1)) o2.pieces = []; o2.pieces.forEach((x) => { x.listing_description = scrubPriceTalk(x.listing_description || ""); }); }
    const parts = await withPartLinks(out.missing_parts);
    const o3 = out as { condition_ladder?: Partial<Ladder>; value_low?: number; value_high?: number };
    const ladder = cleanLadder(o3.condition_ladder, Number(o3.value_low || 0), Number(o3.value_high || 0));
    const result = { ...out, missing_parts: parts, condition_ladder: ladder, origin: cleanOrigin((out as { origin?: unknown }).origin) };
    const r2 = result as { what?: string; value_low?: number; value_high?: number };
    const lookupId = await saveLookup({ id: lookup_id, ownerId: user.id, tool: "worth", title: r2.what || "", photoUrls, hints: [hints, fixing ? correction : null].filter(Boolean).join(". "), result, low: r2.value_low, high: r2.value_high });
    return NextResponse.json({ result, lookup_id: lookupId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin().from("settings").upsert({ key: `err:worth:${Date.now()}`, value: { message, raw: raw.slice(0, 2000), photos: photoUrls.slice(0, 3), user: user.id } }).then(() => {}, () => {});
    if (charged) await refundUse(user.id); // give back the use that failed
    return NextResponse.json({ error: "Couldn't read that one. Try a clearer photo of the whole item, or add a note about what it is." }, { status: 500 });
  }
}
