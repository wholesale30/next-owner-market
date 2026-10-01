import { NextResponse } from "next/server";
import { admin } from "@/lib/stripe";
import { slugify } from "@/lib/md";
import { indexNow } from "@/lib/indexnow";
import { FEES } from "@/lib/ai-engine";

/**
 * Share a Buy or Pass check. Built from OUR saved result (never from text the visitor sends), so it can't be used for spam.
 * Makes (once) a public "what it's worth" page Google can find, and returns the brag card link.
 */
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Nothing to share" }, { status: 400 });
  const d = admin();
  const { data: s } = await d.from("buy_pass_scans").select("*").eq("id", id).maybeSingle();
  if (!s) return NextResponse.json({ error: "Nothing to share" }, { status: 404 });
  let slug = s.valuation_slug as string | null;
  if (!slug) {
    const title = String(s.what || "Thrift find").slice(0, 140);
    slug = `${slugify(title) || "item"}-${Math.random().toString(36).slice(2, 7)}`;
    const place = FEES.find((f) => f.key === s.best_place);
    const { error } = await d.from("valuations").insert({
      slug, owner_id: s.owner_id || null, source: "buypass", title, condition: s.condition_guess || null,
      value_low: Number(s.resale_low), value_high: Number(s.resale_high), confidence: null,
      why: s.why || null, raise_value: [], best_places: place ? [{ name: place.label, why: "keeps the most after fees" }] : [],
      ship_or_local: s.ship_or_local || null, watch_out: s.watch_out || null, photo_url: s.photo_url || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await d.from("buy_pass_scans").update({ valuation_slug: slug, shared: true }).eq("id", id);
    indexNow([`/valued/${slug}`, "/valued"]).catch(() => {});
  }
  return NextResponse.json({ slug, flip: `/flip/${id}` });
}
