import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { runVision, FEES } from "@/lib/ai-engine";

export const maxDuration = 60;

type Out = { what: string; condition_guess: string; resale_low: number; resale_high: number; best_place: string; ship_or_local: "ship" | "local" | "either"; shipping_est: number; confidence: "high" | "medium" | "low"; why: string; watch_out: string | null; weight_lbs: number; box: string; listing_title: string };

/** POST { photoUrls, paid, hints? } → resale range, fee math, net profit, verdict. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first (it's free)." }, { status: 401 });
  const { photoUrls, paid, hints } = (await req.json()) as { photoUrls: string[]; paid?: number; hints?: string };
  const r = await runVision<Out>({
    name: "buy_or_pass", userId: user.id, photoUrls, maxPhotos: 4, maxTokens: 1200,
    prompt: `You are a full-time US reseller who flips thrift-store and yard-sale finds on eBay, Mercari, Poshmark and Facebook Marketplace. Identify the item from the photo (read labels, model numbers). ${hints ? `Notes: "${hints}". ` : ""}Give a realistic resale range in USD (what it actually sells for used, not retail), the single best place to sell it, whether it ships or is local-only, a rough shipping cost if shipped, and any warning (fakes, recalls, hard to ship, slow to sell). Be honest; a wrong "buy" costs real money.`,
    schema: { type: "object", properties: {
      what: { type: "string" }, condition_guess: { type: "string" },
      resale_low: { type: "number" }, resale_high: { type: "number" },
      best_place: { type: "string", enum: FEES.map((f) => f.key) },
      ship_or_local: { type: "string", enum: ["ship", "local", "either"] },
      shipping_est: { type: "number", description: "typical outbound shipping cost in USD, 0 if local" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      why: { type: "string", description: "2 sentences: demand and what to check before buying" },
      watch_out: { type: ["string", "null"] },
      weight_lbs: { type: "number" }, box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"] },
      listing_title: { type: "string", description: "max 80 chars" },
    }, required: ["what", "condition_guess", "resale_low", "resale_high", "best_place", "ship_or_local", "shipping_est", "confidence", "why", "weight_lbs", "box", "listing_title"] },
  });
  if (!r.ok) return NextResponse.json({ error: r.error, upgrade: r.upgrade }, { status: r.status });
  const o = r.result;
  const fee = FEES.find((f) => f.key === o.best_place) || FEES[0];
  const cost = Number(paid || 0);
  const net = (price: number) => Math.round((price - price * fee.pct / 100 - fee.fixed - (o.ship_or_local === "local" ? 0 : Number(o.shipping_est || 0)) - cost) * 100) / 100;
  const net_low = net(o.resale_low), net_high = net(o.resale_high);
  const verdict = net_low >= 15 ? "buy" : net_high >= 15 && net_low >= 0 ? "maybe" : "pass";
  await admin().from("buy_pass_scans").insert({ owner_id: user.id, what: o.what, paid: cost || null, resale_low: o.resale_low, resale_high: o.resale_high, net_low, net_high, verdict, photo_url: photoUrls[0] || null });
  return NextResponse.json({ ...o, fee: { label: fee.label, pct: fee.pct, fixed: fee.fixed, note: fee.note }, paid: cost, net_low, net_high, verdict });
}
