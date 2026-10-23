import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftListing } from "@/lib/draft-listing";
import { allowanceOf, outOfUsesMessage, refundUse } from "@/lib/usage";
import { aiServiceDown, reportAiDown, AI_DOWN_MESSAGE } from "@/lib/ai-tool";

export const maxDuration = 60;

/**
 * POST { photoUrls: string[], hints?: string, categories: {id,name}[] }
 * Returns a drafted listing from the photos.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  {
    const { admin } = await import("@/lib/stripe");
    const { data: ok } = await admin().rpc("spend_ai_credit", { p_profile: user.id });
    if (!ok) return NextResponse.json({ error: outOfUsesMessage(await allowanceOf(user.id)), upgrade: true, topup: true }, { status: 402 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }

  const { photoUrls, hints, categories } = (await req.json()) as {
    photoUrls: string[];
    hints?: string;
    categories: { id: string; name: string }[];
  };
  if (!photoUrls?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

  try {
    const d = await draftListing({ photoUrls, hints, categories, ownerId: user.id });
    return NextResponse.json({ draft: d });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    await refundUse(user.id); // the listing didn't come out: give the use back
    const { admin } = await import("@/lib/stripe");
    await admin().from("settings").upsert({ key: `err:listing:${Date.now()}`, value: { message, photos: photoUrls.slice(0, 3), user: user.id, hints: hints || null } }).then(() => {}, () => {});
    if (aiServiceDown(e)) { await reportAiDown(e); return NextResponse.json({ error: AI_DOWN_MESSAGE, retry: true }, { status: 503 }); }
    return NextResponse.json({ error: "The AI couldn't read that one this time. Tap Try again, or fill it in yourself.", retry: true }, { status: 500 });
  }
}
