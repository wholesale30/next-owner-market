import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/**
 * POST { photoUrls: string[] } (up to 40, in the order they were shot)
 * Returns { groups: number[][] } — indexes of photos that belong to the same item, in shooting order.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  {
    const { data: me } = await supabase.from("profiles").select("role, plan").eq("id", user.id).single();
    if (!me || (me.role !== "admin" && me.role !== "staff" && me.plan !== "pro")) return NextResponse.json({ error: "Batch sorting is a Pro feature.", upgrade: true }, { status: 402 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  const { photoUrls } = (await req.json()) as { photoUrls: string[] };
  const urls = (photoUrls || []).slice(0, 40);
  if (!urls.length) return NextResponse.json({ error: "No photos" }, { status: 400 });
  if (urls.length === 1) return NextResponse.json({ groups: [[0]] });

  const client = new Anthropic();
  const content: Anthropic.MessageParam["content"] = [];
  urls.forEach((url, i) => {
    content.push({ type: "text", text: `Photo ${i}:` });
    content.push({ type: "image", source: { type: "url", url } } as Anthropic.ImageBlockParam);
  });
  content.push({
    type: "text",
    text: `These ${urls.length} photos were taken one after another in a warehouse. Consecutive photos of the SAME physical object (different angles, the label, the back, the cord) belong together. When the object changes, a new item starts. Group them.

Rules:
- Every photo index from 0 to ${urls.length - 1} appears exactly once.
- Groups are contiguous runs in shooting order (an item's photos are always next to each other).
- Two different units of the same product model are different items unless they're clearly photographed together as a set.
- If unsure whether a photo starts a new item, start a new item (it's easier to merge later than to split).

Return ONLY JSON: {"groups": [[0,1,2],[3],[4,5]]}`,
  });

  try {
    const msg = await client.messages.create({
      model: process.env.CLAUDE_GROUP_MODEL || "claude-sonnet-5-5",
      max_tokens: 600,
      messages: [{ role: "user", content }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { groups: number[][] };
    // sanity: cover every index exactly once, in order; otherwise fall back to one-per-photo
    const flat = parsed.groups.flat();
    const ok = flat.length === urls.length && flat.every((v, i) => v === i);
    return NextResponse.json({ groups: ok ? parsed.groups : urls.map((_, i) => [i]), usage: msg.usage });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Grouping failed" }, { status: 500 });
  }
}
