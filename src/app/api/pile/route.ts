import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { runVision } from "@/lib/ai-engine";
import { scrubPriceTalk } from "@/lib/listing";
import { PILE_PART_SCHEMA, PART_PROMPT, withPartLinks, type MissingPart } from "@/lib/parts";
import { LISTING_HONESTY } from "@/lib/ladder";

export const maxDuration = 90;

type PileItem = { fixup?: "clean" | "test" | "both" | "none"; fixup_low?: number | null; fixup_high?: number | null; fixup_tip?: string | null; missing_parts?: MissingPart[]; name: string; category: string; condition: string; low: number; high: number; action: "keep" | "sell" | "donate" | "toss"; reason: string; confidence: "high" | "medium" | "low"; needs_expert: boolean; listing_title: string; listing_description: string; weight_lbs: number; box: string; photo_index: number };

/** POST { photoUrls, hints?, name? } → items with value ranges and keep/sell/donate/toss; saved as a pile scan. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first (it's free)." }, { status: 401 });
  const { photoUrls, hints, name, correction, prev_scan_id, previous } = (await req.json()) as { photoUrls: string[]; hints?: string; name?: string; correction?: string; prev_scan_id?: string; previous?: { name: string; low: number; high: number; action: string }[] };
  const db0 = admin();
  // "Something wrong? Tell it": re-sort the same photos with the owner's correction.
  // The first 2 fixes of a sort are free; after that a fix counts as a use. Never more than 20 a day.
  const fixing = !!(correction && correction.trim() && previous?.length);
  let fixCharge = false;
  if (fixing) {
    if (prev_scan_id && /^[0-9a-f-]{36}$/.test(prev_scan_id)) {
      const sk = `fix:pile:scan:${prev_scan_id}`;
      const { data: sc } = await db0.from("settings").select("value").eq("key", sk).maybeSingle();
      const k = Number((sc?.value as { n?: number } | null)?.n || 0);
      if (k >= 2) fixCharge = true;
      await db0.from("settings").upsert({ key: sk, value: { n: k + 1 } });
    } else fixCharge = true;
    const key = `fix:pile:${user.id}:${new Date().toISOString().slice(0, 10)}`;
    const { data: c } = await db0.from("settings").select("value").eq("key", key).maybeSingle();
    const n = Number((c?.value as { n?: number } | null)?.n || 0);
    if (n >= 20) return NextResponse.json({ error: "That's a lot of fixes for one day. Start a fresh sort instead." }, { status: 429 });
    await db0.from("settings").upsert({ key, value: { n: n + 1 } });
  }
  const before = fixing ? `Your earlier answer listed: ${previous!.slice(0, 25).map((x) => `${String(x.name).slice(0, 80)} ($${Math.round(Number(x.low))}-$${Math.round(Number(x.high))}, ${x.action})`).join("; ")}. The owner says: "${String(correction).slice(0, 800)}". Redo the whole list with this correction. Trust what the owner tells you (what an item really is, model, condition, what's missing, items you missed or that aren't there) unless the photos clearly show otherwise. In the summary, say in one sentence what changed. ` : "";
  const r = await runVision<{ items: PileItem[]; summary: string }>({
    name: "sort_pile", userId: user.id, photoUrls, maxPhotos: 10, maxTokens: 5000, charge: !fixing || fixCharge,
    prompt: `You are an experienced US surplus and estate-sale appraiser (30 years). The photos show a box, shelf, room, or pile of belongings. ${hints ? `The owner says: "${String(hints).slice(0, 500)}". ` : ""}${before}List every distinct sellable or notable item you can identify (up to 25). Read labels and model numbers. For each, give an honest resale value range in USD (quick sale to patient sale) and one action: sell (worth listing, roughly $15+), donate (usable but not worth the time), toss (broken, unsafe, or worthless), keep (sentimental or worth more to a person than the market). Flag needs_expert for art, jewelry, coins, firearms, or anything possibly high-value. Common junk is fine to call junk, kindly. Use photo_index to say which photo (0-based) the item is in. Price each item AS-IS (dirty if it looks dirty, untested unless the owner said it works), and use fixup to say what a wipe-down and/or a working test would raise it to.${LISTING_HONESTY}${PART_PROMPT} (At most one part per item, and only for items marked sell.)`,
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
          missing_parts: PILE_PART_SCHEMA,
          fixup: { type: "string", enum: ["none", "clean", "test", "both"], description: "the work that would raise its price: clean (looks dirty in the photos), test (electric/mechanical and nobody said it works), both, or none" },
          fixup_low: { type: ["number", "null"], description: "value after that work (low), null if none" },
          fixup_high: { type: ["number", "null"], description: "value after that work (high), null if none" },
          fixup_tip: { type: ["string", "null"], description: "a few words on how, e.g. 'wipe down, plug in and run it'" },
        }, required: ["fixup", "name", "low", "high", "action", "reason", "confidence", "needs_expert", "photo_index"] } },
      },
      required: ["items", "summary"],
    },
  });
  if (!r.ok) return NextResponse.json({ error: r.error, upgrade: r.upgrade, topup: r.topup }, { status: r.status });
  const items = await Promise.all((r.result.items || []).map(async (x) => {
    // only show a fix-up when it really adds money
    const up = x.fixup && x.fixup !== "none" && x.fixup_high != null && Number(x.fixup_high) > Number(x.high);
    return { ...x, fixup: up ? x.fixup : "none", fixup_low: up ? Math.max(Number(x.fixup_low ?? x.low), Number(x.low)) : null, fixup_high: up ? Number(x.fixup_high) : null, fixup_tip: up ? x.fixup_tip || null : null, listing_description: scrubPriceTalk(x.listing_description), missing_parts: await withPartLinks(x.missing_parts) };
  }));
  const sell = items.filter((x) => x.action === "sell");
  const total_low = sell.reduce((a, x) => a + Number(x.low || 0), 0), total_high = sell.reduce((a, x) => a + Number(x.high || 0), 0);
  const db = admin();
  let scan: { id: string } | null = null;
  if (fixing && prev_scan_id) {
    const { data: old } = await db.from("pile_scans").select("id").eq("id", prev_scan_id).eq("owner_id", user.id).maybeSingle();
    if (old) { await db.from("pile_scans").update({ total_low, total_high }).eq("id", old.id); await db.from("pile_items").delete().eq("scan_id", old.id); scan = old; }
  }
  if (!scan) scan = (await db.from("pile_scans").insert({ owner_id: user.id, name: name || null, photo_urls: photoUrls.slice(0, 10), total_low, total_high }).select("id").single()).data;
  if (scan) await db.from("pile_items").insert(items.map((x, i) => ({ scan_id: scan.id, name: x.name, category: x.category || null, condition: x.condition || null, low: x.low, high: x.high, action: x.action, reason: x.reason, confidence: x.confidence, needs_expert: x.needs_expert, listing_title: x.listing_title || null, listing_description: x.listing_description || null, weight_lbs: x.weight_lbs || null, box: x.box || null, sort_order: i })));
  return NextResponse.json({ scanId: scan?.id, summary: r.result.summary, items, total_low, total_high });
}
