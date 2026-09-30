import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { runVision } from "@/lib/ai-engine";
import { scrubPriceTalk } from "@/lib/listing";

export const maxDuration = 90;

type PileItem = { name: string; category: string; condition: string; low: number; high: number; action: "keep" | "sell" | "donate" | "toss"; reason: string; confidence: "high" | "medium" | "low"; needs_expert: boolean; listing_title: string; listing_description: string; weight_lbs: number; box: string; photo_index: number };

/** POST { photoUrls, hints?, name? } → items with value ranges and keep/sell/donate/toss; saved as a pile scan. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first (it's free)." }, { status: 401 });
  const { photoUrls, hints, name } = (await req.json()) as { photoUrls: string[]; hints?: string; name?: string };
  const r = await runVision<{ items: PileItem[]; summary: string }>({
    name: "sort_pile", userId: user.id, photoUrls, maxPhotos: 10, maxTokens: 4000,
    prompt: `You are an experienced US surplus and estate-sale appraiser (30 years). The photos show a box, shelf, room, or pile of belongings. ${hints ? `The owner says: "${hints}". ` : ""}List every distinct sellable or notable item you can identify (up to 25). Read labels and model numbers. For each, give an honest resale value range in USD (quick sale to patient sale) and one action: sell (worth listing, roughly $15+), donate (usable but not worth the time), toss (broken, unsafe, or worthless), keep (sentimental or worth more to a person than the market). Flag needs_expert for art, jewelry, coins, firearms, or anything possibly high-value. Common junk is fine to call junk, kindly. Use photo_index to say which photo (0-based) the item is in.`,
    schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "one or two sentences on the pile as a whole" },
        items: { type: "array", items: { type: "object", properties: {
          name: { type: "string" }, category: { type: "string" }, condition: { type: "string" },
          low: { type: "number" }, high: { type: "number" },
          action: { type: "string", enum: ["keep", "sell", "donate", "toss"] },
          reason: { type: "string", description: "one short sentence" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          needs_expert: { type: "boolean" },
          listing_title: { type: "string", description: "max 80 chars, only if action is sell" },
          listing_description: { type: "string", description: "3-4 honest sentences, no prices, only if action is sell" },
          weight_lbs: { type: "number" }, box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"] },
          photo_index: { type: "integer" },
        }, required: ["name", "low", "high", "action", "reason", "confidence", "needs_expert", "photo_index"] } },
      },
      required: ["items", "summary"],
    },
  });
  if (!r.ok) return NextResponse.json({ error: r.error, upgrade: r.upgrade }, { status: r.status });
  const items = (r.result.items || []).map((x) => ({ ...x, listing_description: scrubPriceTalk(x.listing_description) }));
  const sell = items.filter((x) => x.action === "sell");
  const total_low = sell.reduce((a, x) => a + Number(x.low || 0), 0), total_high = sell.reduce((a, x) => a + Number(x.high || 0), 0);
  const db = admin();
  const { data: scan } = await db.from("pile_scans").insert({ owner_id: user.id, name: name || null, photo_urls: photoUrls.slice(0, 10), total_low, total_high }).select("id").single();
  if (scan) await db.from("pile_items").insert(items.map((x, i) => ({ scan_id: scan.id, name: x.name, category: x.category || null, condition: x.condition || null, low: x.low, high: x.high, action: x.action, reason: x.reason, confidence: x.confidence, needs_expert: x.needs_expert, listing_title: x.listing_title || null, listing_description: x.listing_description || null, weight_lbs: x.weight_lbs || null, box: x.box || null, sort_order: i })));
  return NextResponse.json({ scanId: scan?.id, summary: r.result.summary, items, total_low, total_high });
}
