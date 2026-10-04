import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { LISTING_HONESTY, BUYER_VOICE } from "@/lib/ladder";
import { scrubPriceTalk, scrubSpecs } from "@/lib/listing";
import { askWithTool } from "@/lib/ai-tool";

/**
 * Try it free: one photo in, a full listing out, no account needed.
 * One try per device (cookie) and two per network per day, 300 a day site-wide. The result is saved
 * under a token so signing up turns it into the person's first draft listing (see /api/signup).
 */
export const maxDuration = 60;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const db = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const today = () => new Date().toISOString().slice(0, 10);

async function bump(key: string, max: number) {
  const d = db();
  const { data } = await d.from("settings").select("value").eq("key", key).maybeSingle();
  const n = Number((data?.value as { n?: number } | null)?.n || 0);
  if (n >= max) return false;
  await d.from("settings").upsert({ key, value: { n: n + 1 } });
  return true;
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (jar.get("nom_try")?.value) return NextResponse.json({ error: "You've used your free try on this device. Make a free account to keep going: you get 3 more AI listings.", signup: true }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Not available right now. Try again soon." }, { status: 500 });
  const { image, hints } = (await req.json()) as { image?: string; hints?: string };
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(image || "");
  if (!m) return NextResponse.json({ error: "Pick a photo first." }, { status: 400 });
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 4_500_000) return NextResponse.json({ error: "That photo is too big. Try another one." }, { status: 413 });

  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipKey = createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 8)).digest("hex").slice(0, 16);
  if (!(await bump(`try:day:${today()}`, 300))) return NextResponse.json({ error: "Lots of people are trying it today. Make a free account and you can go right now.", signup: true }, { status: 429 });
  if (!(await bump(`try:ip:${today()}:${ipKey}`, 2))) return NextResponse.json({ error: "You've used your free try. Make a free account to keep going: you get 3 more AI listings.", signup: true }, { status: 429 });

  const d = db();
  const token = randomBytes(12).toString("hex");
  const path = `try/${token}.${m[1] === "png" ? "png" : "jpg"}`;
  const up = await d.storage.from("item-photos").upload(path, bytes, { contentType: `image/${m[1]}` });
  if (up.error) return NextResponse.json({ error: "Couldn't save the photo. Try again." }, { status: 500 });
  const photoUrl = d.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
  const { data: cats } = await d.from("categories").select("id, name").order("name");

  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "clear, searchable title, max 80 characters, brand + model + what it is; no ALL CAPS, no price" },
      brand: { type: ["string", "null"] }, model: { type: ["string", "null"] },
      category_id: { type: ["string", "null"], description: "id from the category list" },
      condition: { type: "string", enum: ["new", "like_new", "good", "fair", "for_parts"] },
      condition_notes: { type: ["string", "null"], description: "honest note on visible wear or missing parts" },
      description: { type: "string", description: "3-6 plain, honest sentences a buyer wants. Never mention price or value." },
      specs: { type: "object", additionalProperties: { type: "string" }, description: "2-6 useful specs (Dimensions, Color, Year, Power...)" },
      tags: { type: "array", items: { type: "string" }, description: "12-20 search words and phrases buyers actually type on Facebook, eBay and Google: brand, model and model number, what it is, common other names and spellings, category, use, era or style. Only words that truly describe this item: never another brand, never 'like X', 'not X', 'X style' or a question mark (marketplaces remove listings for that)" },
      price_min: { type: "number", description: "realistic quick-sale price in USD" },
      price_max: { type: "number", description: "realistic patient-seller price in USD" },
      price_note: { type: "string", description: "one sentence on how it was priced and what would raise it" },
      weight_lbs: { type: "number", description: "packed shipping weight in lbs, rounded up" },
      box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"] },
      worth_listing: { type: "boolean", description: "false if likely under $10 or junk" },
    },
    required: ["title", "condition", "description", "specs", "tags", "price_min", "price_max", "price_note", "weight_lbs", "box", "worth_listing"],
  };
  try {
    const client = new Anthropic();
    const input = await askWithTool(client, {
      model: MODEL, max_tokens: 1500, log: { ownerId: null, feature: "try_demo" },
      tool: { name: "listing", description: "Record the listing.", input_schema: schema as unknown as Anthropic.Tool.InputSchema },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: `image/${m[1]}` as "image/jpeg", data: m[2] } },
        { type: "text", text: `You are an experienced US reseller writing a listing for this item. Read every label, model number and brand mark you can see. ${hints ? `The owner says: "${String(hints).slice(0, 300)}". ` : ""}Categories (pick the best id): ${(cats || []).map((c) => `${c.id}=${c.name}`).join("; ")}. Be honest; if it's common, say so plainly in the price.${LISTING_HONESTY}${BUYER_VOICE}` },
      ] }],
    });
    const call = { input };
    const draft = call.input as Record<string, unknown> & { description: string; title: string; specs?: Record<string, string>; condition_notes?: string | null };
    draft.description = scrubPriceTalk(draft.description);
    if (draft.condition_notes) draft.condition_notes = scrubPriceTalk(draft.condition_notes);
    draft.specs = scrubSpecs(draft.specs);
    draft.title = String(draft.title || "").replace(/\s*[-–(]?\s*\$\s?\d[\d,.]*\s*\)?/g, "").trim().slice(0, 80);
    const catName = (cats || []).find((c) => c.id === draft.category_id)?.name || null;
    await d.from("settings").upsert({ key: `try:result:${token}`, value: { draft, photo_url: photoUrl, path, at: new Date().toISOString(), cat: catName } });
    const res = NextResponse.json({ token, draft, photo_url: photoUrl, category: catName });
    res.cookies.set("nom_try", token, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch (e) {
    await d.from("settings").upsert({ key: `err:try:${Date.now()}`, value: { message: e instanceof Error ? e.message : String(e) } }).then(() => {}, () => {});
    // don't count a failed try against them
    await d.from("settings").delete().eq("key", `try:ip:${today()}:${ipKey}`).then(() => {}, () => {});
    return NextResponse.json({ error: "Couldn't read that photo. Try one of the whole item in good light, or add a note about what it is." }, { status: 500 });
  }
}
