import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { runVision, FEES } from "@/lib/ai-engine";

export const maxDuration = 60;

import { BP_FREE_DAILY } from "@/lib/thrift";
import { saveLookup } from "@/lib/lookups";
import { PART_SCHEMA, PART_PROMPT, withPartLinks, type MissingPart } from "@/lib/parts";
import { LADDER_SCHEMA, LADDER_PROMPT, cleanLadder, type Ladder } from "@/lib/ladder";

type Out = { condition_ladder?: Partial<Ladder>; missing_parts?: MissingPart[]; what: string; condition_guess: string; resale_low: number; resale_high: number; best_place: string; ship_or_local: "ship" | "local" | "either"; shipping_est: number; confidence: "high" | "medium" | "low"; why: string; watch_out: string | null; weight_lbs: number; box: string; listing_title: string };

const nyDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
/** Count one more against `key`; returns the new count, or 0 when it's already at `max`. */
async function bump(key: string, max: number) {
  const d = admin();
  const { data } = await d.from("settings").select("value").eq("key", key).maybeSingle();
  const n = Number((data?.value as { n?: number } | null)?.n || 0);
  if (n >= max) return 0;
  await d.from("settings").upsert({ key, value: { n: n + 1 } });
  return n + 1;
}

/**
 * POST { photoUrls?, image?, paid, hints? } → resale range, profit at every place to sell, verdict.
 * Signed out: ONE free check per device per day (answer first, account later), photo sent as `image` (data URL).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { photoUrls: urls, image, paid, hints, correction, prev_id } = (await req.json()) as { photoUrls?: string[]; image?: string; paid?: number; hints?: string; correction?: string; prev_id?: string };
  const d = admin();
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/`;
  let photoUrls = (urls || []).filter((u) => typeof u === "string" && u.startsWith(base)); // only our own uploaded photos
  let charge = false;
  const jar = await cookies();
  let anonKey: string | null = null;

  // "Something wrong? Tell it": re-check the SAME check with the person's correction. Free, updates the same check.
  type Prev = { id: string; owner_id: string | null; what: string; resale_low: number; resale_high: number; photo_url: string | null; created_at: string };
  let prev: Prev | null = null;
  if (correction && correction.trim() && prev_id && /^[0-9a-f-]{36}$/.test(prev_id)) {
    const { data } = await d.from("buy_pass_scans").select("id, owner_id, what, resale_low, resale_high, photo_url, created_at").eq("id", prev_id).maybeSingle();
    const mine = data && (data.owner_id ? data.owner_id === user?.id : Date.now() - new Date(data.created_at).getTime() < 6 * 3600_000);
    if (!data || !mine) return NextResponse.json({ error: "Couldn't find that check to fix. Start a new one." }, { status: 404 });
    const n = await bump(`fix:bp:${prev_id}`, 5);
    if (!n) return NextResponse.json({ error: "That one's been fixed a lot already. Start a fresh check." }, { status: 429 });
    // the first 2 fixes are free; after that a fix counts as a check
    if (n > 2) { if (!user) return NextResponse.json({ error: "Make a free account to keep fixing this one.", signup: true }, { status: 429 }); charge = true; }
    prev = data as Prev;
    if (prev.photo_url && !photoUrls.includes(prev.photo_url)) photoUrls = [prev.photo_url, ...photoUrls];
  }

  if (prev) {
    // corrections: handled above (2 free, then they count)
  } else if (!user) {
    if (jar.get("nom_bp")?.value === nyDay()) return NextResponse.json({ error: "That was your free check for today. Make a free account and you get 5 free checks every day.", signup: true }, { status: 429 });
    const h = await headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    anonKey = `bp:ip:${nyDay()}:${createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 8)).digest("hex").slice(0, 16)}`;
    if (!(await bump(`bp:day:${nyDay()}`, 500))) return NextResponse.json({ error: "Lots of people are checking finds today. Make a free account and go right now.", signup: true }, { status: 429 });
    if (!(await bump(anonKey, 3))) return NextResponse.json({ error: "That was your free check for today. Make a free account and you get 5 free checks every day.", signup: true }, { status: 429 });
  } else {
    // Everyone signed in gets BP_FREE_DAILY free checks a day. After that each check is one AI use
    // (Pro: from the 300 a month; Thrift Pro: from its 30 a day; free: starter credits or a pack). Staff and comped: free.
    const start = new Date(Date.now() - 24 * 3600_000).toISOString(); // rolling day
    const { count } = await d.from("buy_pass_scans").select("id", { count: "exact", head: true }).eq("owner_id", user.id).gte("created_at", start);
    if ((count || 0) >= BP_FREE_DAILY) charge = true;
  }

  if (image && !prev) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(image);
    if (!m) return NextResponse.json({ error: "Pick a photo first." }, { status: 400 });
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 4_500_000) return NextResponse.json({ error: "That photo is too big. Try another one." }, { status: 413 });
    const path = `buypass/${user ? user.id : "anon"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${m[1] === "png" ? "png" : "jpg"}`;
    const up = await d.storage.from("item-photos").upload(path, bytes, { contentType: `image/${m[1]}` });
    if (up.error) return NextResponse.json({ error: "Couldn't save the photo. Try again." }, { status: 500 });
    photoUrls = [d.storage.from("item-photos").getPublicUrl(path).data.publicUrl, ...photoUrls];
  }
  if (!photoUrls.length) return NextResponse.json({ error: "Add a photo first." }, { status: 400 });

  const r = await runVision<Out>({
    name: "buy_or_pass", userId: user?.id || "anon", photoUrls, maxPhotos: 4, maxTokens: 1700, charge,
    prompt: `You are a full-time US reseller who flips thrift-store and yard-sale finds on eBay, Mercari, Poshmark and Facebook Marketplace. Identify the item from the photo (read labels, model numbers). ${hints ? `Notes: "${String(hints).slice(0, 300)}". ` : ""}${prev ? `Your earlier answer said this was "${String(prev.what).slice(0, 200)}", reselling for about $${Math.round(Number(prev.resale_low))}-$${Math.round(Number(prev.resale_high))}. The person says that's not right: "${String(correction).slice(0, 600)}". Look again with this correction. Trust what they tell you about the item (exact model, what's missing or broken, condition, what it came with) unless the photo clearly shows otherwise, and redo everything from scratch. In "why", say in one sentence what changed. ` : ""}Give a realistic resale range in USD (what it actually sells for used, not retail or hopeful asking prices), the single best place to sell it, whether it ships or is local-only, a rough shipping cost if shipped, and any warning (fakes, recalls, hard to ship, slow to sell). Be honest and a little conservative; a wrong "buy" costs real money.${LADDER_PROMPT}${PART_PROMPT}`,
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
      missing_parts: PART_SCHEMA,
      condition_ladder: LADDER_SCHEMA,
    }, required: ["condition_ladder", "what", "condition_guess", "resale_low", "resale_high", "best_place", "ship_or_local", "shipping_est", "confidence", "why", "weight_lbs", "box", "listing_title"] },
  });
  if (!r.ok) {
    if (anonKey) await d.from("settings").delete().eq("key", anonKey).then(() => {}, () => {});
    return NextResponse.json({ error: r.upgrade ? `You've used today's ${BP_FREE_DAILY} free checks. They come back tomorrow. ${r.error}` : r.error, upgrade: r.upgrade, thrift: r.upgrade, topup: r.topup }, { status: r.status });
  }
  const o = r.result;
  const cost = Number(paid || 0);
  const ship = o.ship_or_local === "local" ? 0 : Number(o.shipping_est || 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Profit at every place to sell (local places skip shipping; Poshmark's flat fee under $15)
  const places = FEES.map((f) => {
    const local = f.key === "facebook";
    if (o.ship_or_local === "local" && !local && f.key !== "nom") return null;
    const net = (price: number) => {
      const fee = f.key === "poshmark" && price < 15 ? 2.95 : price * f.pct / 100 + f.fixed;
      return r2(price - fee - (local || f.key === "nom" ? 0 : ship) - cost);
    };
    return { key: f.key, label: f.label, pct: f.pct, fixed: f.fixed, note: f.note, net_low: net(o.resale_low), net_high: net(o.resale_high) };
  }).filter(Boolean) as { key: string; label: string; pct: number; fixed: number; note: string; net_low: number; net_high: number }[];
  // Best place = where you keep the most (the AI's pick wins ties)
  const aiPick = places.find((p) => p.key === o.best_place) || places[0];
  const best = places.reduce((a, p) => (p.net_low > a.net_low + 0.5 ? p : a), aiPick);
  const net_low = best.net_low, net_high = best.net_high;
  const verdict = net_low >= 15 ? "buy" : net_high >= 15 && net_low >= 0 ? "maybe" : "pass";
  const max_pay = Math.max(0, Math.floor(net_low + cost - 15));
  // Missing a part? What you'd keep at the same place if you buy the part (its high price) and sell it complete
  const bestFee = FEES.find((f) => f.key === best.key) || FEES[0];
  const netAt = (price: number, partCost: number) => {
    const fee = bestFee.key === "poshmark" && price < 15 ? 2.95 : price * bestFee.pct / 100 + bestFee.fixed;
    return r2(price - fee - (bestFee.key === "facebook" || bestFee.key === "nom" ? 0 : ship) - cost - partCost);
  };
  const parts = (await withPartLinks(o.missing_parts)).map((p) => {
    const lo = netAt(p.value_with_low, p.price_high), hi = netAt(p.value_with_high, p.price_high);
    return { ...p, net_with_low: lo, net_with_high: hi, verdict_with: lo >= 15 ? "buy" : hi >= 15 && lo >= 0 ? "maybe" : "pass" };
  }); // the most you can pay and still clear about $15 at the low end
  // As-is vs cleaned vs tested: what you'd keep at the best place for each step, and whether the verdict changes
  const verdictOf = (lo: number, hi: number) => (lo >= 15 ? "buy" : hi >= 15 && lo >= 0 ? "maybe" : "pass");
  const lad = cleanLadder(o.condition_ladder, o.resale_low, o.resale_high);
  const step = (lo: number | null, hi: number | null) => lo == null || hi == null ? null : { low: lo, high: hi, net_low: netAt(lo, 0), net_high: netAt(hi, 0), verdict: verdictOf(netAt(lo, 0), netAt(hi, 0)) };
  const ladder = lad ? { clean_tip: lad.clean_tip, test_tip: lad.test_tip, cleaned: step(lad.cleaned_low, lad.cleaned_high), tested: step(lad.tested_low, lad.tested_high), both: step(lad.both_low, lad.both_high) } : null;
  const row = { what: o.what, paid: cost || null, resale_low: o.resale_low, resale_high: o.resale_high, net_low, net_high, verdict, photo_url: photoUrls[0] || null, best_place: best.key, listing_title: o.listing_title, why: o.why, condition_guess: o.condition_guess, watch_out: o.watch_out || null, ship_or_local: o.ship_or_local };
  // A correction updates the same check (same share link); a shared page gets remade from the corrected answer next time it's shared
  const { data: scan } = prev
    ? await d.from("buy_pass_scans").update({ ...row, valuation_slug: null, shared: false }).eq("id", prev.id).select("id").single()
    : await d.from("buy_pass_scans").insert({ owner_id: user?.id || null, ...row }).select("id").single();
  const fee = FEES.find((f) => f.key === best.key) || FEES[0];
  const body = { ...o, id: scan?.id || null, photo_url: photoUrls[0], photo_urls: photoUrls, places, paid: cost, net_low, net_high, verdict, max_pay, best_place: best.key, missing_parts: parts, ladder, condition_ladder: undefined, fee: { label: fee.label, pct: fee.pct, fixed: fee.fixed, note: fee.note } };
  const lookupId = user && scan?.id ? await saveLookup({ ownerId: user.id, tool: "buy_or_pass", title: o.what, photoUrls, hints, result: body, low: o.resale_low, high: o.resale_high, refId: scan.id }) : null;
  const res = NextResponse.json({ ...body, lookup_id: lookupId });
  if (!user && !prev) res.cookies.set("nom_bp", nyDay(), { maxAge: 60 * 60 * 26, httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
