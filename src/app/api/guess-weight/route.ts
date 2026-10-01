import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askWithTool } from "@/lib/ai-tool";

/** Guess packed shipping weight and box size from the words of a listing (title, description, specs). Free; no AI credit used. */
const MODEL = process.env.CLAUDE_ASK_MODEL || "claude-haiku-4-5-20251001";
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { title, description, specs, category } = (await req.json()) as { title?: string; description?: string; specs?: Record<string, string>; category?: string };
  if (!title?.trim()) return NextResponse.json({ error: "Add a title first, then I can guess." }, { status: 400 });
  const specText = Object.entries(specs || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const out = await askWithTool<{ weight_lbs: number; box: string; reason: string }>(client, {
      model: MODEL, max_tokens: 300,
      tool: { name: "weight", description: "Packed shipping estimate", input_schema: { type: "object", properties: {
        weight_lbs: { type: "number", description: "packed weight in pounds: the item plus a box and padding, rounded up to the next half pound" },
        box: { type: "string", enum: ["small", "medium", "large", "xl", "freight"], description: "small=shoebox, medium=microwave, large=stereo receiver, xl=tower speaker, freight=too big/heavy to ship by parcel (over ~70 lb or very large)" },
        reason: { type: "string", description: "one short plain-English line, e.g. 'Resin lamp about 4 lb, plus box and padding'" },
      }, required: ["weight_lbs", "box", "reason"] } },
      messages: [{ role: "user", content: `Estimate the packed shipping weight and box for this item. Use known product weights when the model is identifiable; otherwise reason from material and size. Round up; it's better to be a little heavy than short on postage.\n\nTitle: ${title}\nCategory: ${category || ""}\nSpecs:\n${specText}\n\nDescription:\n${(description || "").slice(0, 2500)}` }],
    });
    if (!out?.weight_lbs) throw new Error("no estimate");
    return NextResponse.json({ weight_lbs: Math.max(0.5, Math.ceil(out.weight_lbs * 2) / 2), box: out.box, reason: out.reason });
  } catch {
    return NextResponse.json({ error: "Couldn't guess right now. Type a weight, or try again." }, { status: 502 });
  }
}
