import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { askWithTool, aiServiceDown, reportAiDown, AI_DOWN_MESSAGE } from "@/lib/ai-tool";
import { cleanAiTells, scrubPriceTalk } from "@/lib/listing";
import { BUYER_VOICE } from "@/lib/ladder";

export const maxDuration = 30;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5"; // better writing; text only, about 1 cent

/**
 * "✨ Tell it what to change": POST { title, description, condition_notes, instruction } -> rewritten fields.
 * Text only (no photos), about 1 cent. Free; doesn't use an AI lookup. Capped at 60 a day.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { title?: string; description?: string; condition_notes?: string; instruction?: string };
  const instruction = String(b.instruction || "").trim().slice(0, 1500);
  if (instruction.length < 3) return NextResponse.json({ error: "Say what to change." }, { status: 400 });
  const d = admin();
  const key = `revise:${user.id}:${new Date().toISOString().slice(0, 10)}`;
  const { data: c } = await d.from("settings").select("value").eq("key", key).maybeSingle();
  const n = Number((c?.value as { n?: number } | null)?.n || 0);
  if (n >= 60) return NextResponse.json({ error: "That's a lot of rewrites today. Edit the words by hand, or try tomorrow." }, { status: 429 });
  await d.from("settings").upsert({ key, value: { n: n + 1 } });
  try {
    const out = await askWithTool<{ title: string; description: string; condition_notes: string; changed: string }>(new Anthropic(), {
      model: MODEL, max_tokens: 1200, log: { ownerId: user.id, feature: "listing_rewrite" },
      tool: { name: "listing", description: "Record the rewritten listing.", input_schema: { type: "object", properties: {
        title: { type: "string", description: "max 80 characters, brand + model + what it is" },
        description: { type: "string" },
        condition_notes: { type: "string", description: "one short line a buyer reads, e.g. 'New, never used. Untested.'" },
        changed: { type: "string", description: "one short sentence: what you changed" },
      }, required: ["title", "description", "condition_notes", "changed"] } },
      messages: [{ role: "user", content: `Here is a resale listing. The seller wants a change. Make exactly the change they ask for, keep everything else that's still true, and return the full listing. The description should read like a good listing: 3-6 plain sentences on what it is, what's included, condition, and why it's a good buy (keep real specs and model numbers). If they ask you to make it better or more complete, do that.${BUYER_VOICE}

Title: ${String(b.title || "").slice(0, 200)}
Condition: ${String(b.condition_notes || "").slice(0, 400)}
Description:
${String(b.description || "").slice(0, 4000)}

The seller says: "${instruction}"` }],
    });
    return NextResponse.json({ title: cleanAiTells(String(out.title || "")).slice(0, 80), description: scrubPriceTalk(out.description || ""), condition_notes: scrubPriceTalk(out.condition_notes || ""), changed: out.changed || "Updated." });
  } catch (e) {
    if (aiServiceDown(e)) { await reportAiDown(e); return NextResponse.json({ error: AI_DOWN_MESSAGE }, { status: 503 }); }
    return NextResponse.json({ error: "Couldn't rewrite it right now. Try again." }, { status: 502 });
  }
}
