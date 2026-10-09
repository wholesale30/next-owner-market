import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { findItForLess } from "@/lib/find";
import { saveLookup } from "@/lib/lookups";
import { allowanceOf, outOfUsesMessage, refundUse } from "@/lib/usage";
import { aiServiceDown, AI_DOWN_MESSAGE, reportAiDown } from "@/lib/ai-tool";
import { bump, ipKey, nyDay } from "@/lib/caps";

export const maxDuration = 120;

/**
 * POST { text, image? } → the exact part, real prices at real stores, shop price, do-it-yourself help.
 * Signed out: ONE free find per device per day (answer first, account later). Signed in: one AI use.
 * Each find costs us about 10 to 15 cents (live web searches), so the site-wide free cap is lower than the other tools.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { text: rawText, image } = (await req.json().catch(() => ({}))) as { text?: string; image?: string };
  const text = String(rawText || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!text && !image) return NextResponse.json({ error: "Type or say what you need, or add a photo." }, { status: 400 });
  const d = admin();
  const jar = await cookies();
  let anonKey: string | null = null;
  let charged = false;

  let img: { mime: "jpeg" | "png" | "webp"; bytes: Buffer } | null = null;
  if (image) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(image);
    if (!m) return NextResponse.json({ error: "That photo didn't come through. Try another one." }, { status: 400 });
    img = { mime: m[1] as "jpeg" | "png" | "webp", bytes: Buffer.from(m[2], "base64") };
    if (img.bytes.length > 4_500_000) return NextResponse.json({ error: "That photo is too big. Try another one." }, { status: 413 });
  }

  if (!user) {
    if (jar.get("nom_find")?.value === nyDay()) return NextResponse.json({ error: "That was your free find for today. Make a free account to keep finding deals.", signup: true }, { status: 429 });
    anonKey = `find:ip:${nyDay()}:${ipKey(await headers())}`;
    if (!(await bump(`find:day:${nyDay()}`, 150))) return NextResponse.json({ error: "Lots of people are finding deals today. Make a free account and go right now.", signup: true }, { status: 429 });
    if (!(await bump(anonKey, 2))) return NextResponse.json({ error: "That was your free find for today. Make a free account to keep finding deals.", signup: true }, { status: 429 });
  } else {
    const { data: ok } = await d.rpc("spend_ai_credit", { p_profile: user.id });
    if (!ok) return NextResponse.json({ error: outOfUsesMessage(await allowanceOf(user.id)), upgrade: true, topup: true }, { status: 402 });
    charged = true;
  }

  // keep the photo with the saved find
  let photoUrl: string | null = null;
  if (img && user) {
    const path = `finds/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${img.mime === "png" ? "png" : "jpg"}`;
    const up = await d.storage.from("item-photos").upload(path, img.bytes, { contentType: `image/${img.mime}` });
    if (!up.error) photoUrl = d.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
  }

  try {
    const r = await findItForLess(new Anthropic(), {
      text, ownerId: user?.id || null,
      image: img ? { type: "image", source: { type: "base64", media_type: `image/${img.mime}`, data: img.bytes.toString("base64") } } : null,
    });
    const { cost: _cost, ...out } = r; void _cost;
    const lookupId = user ? await saveLookup({ ownerId: user.id, tool: "find", title: out.what_it_is || text, photoUrls: photoUrl ? [photoUrl] : [], hints: text, result: { ...out, query: text }, low: out.best_price, high: out.shop_price_high }) : null;
    const res = NextResponse.json({ ...out, query: text, photo_url: photoUrl, lookup_id: lookupId});
    if (!user) res.cookies.set("nom_find", nyDay(), { maxAge: 60 * 60 * 26, httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch (e) {
    if (charged && user) await refundUse(user.id);
    if (anonKey) await d.from("settings").delete().eq("key", anonKey).then(() => {}, () => {});
    if (aiServiceDown(e)) { await reportAiDown(e); return NextResponse.json({ error: AI_DOWN_MESSAGE }, { status: 503 }); }
    console.error("find", e);
    return NextResponse.json({ error: "Couldn't find that one. Try different words, a part number, or a photo of the label. Nothing was used." }, { status: 500 });
  }
}
