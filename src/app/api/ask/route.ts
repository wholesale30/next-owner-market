import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { TOPICS } from "@/lib/help";
import { logUsage } from "@/lib/usage";

export const maxDuration = 30;
const MODEL = process.env.CLAUDE_ASK_MODEL || "claude-haiku-4-5-20251001";

/** POST { q } → plain-English answer grounded in the help topics and the User Guide. Rate-limited per IP in memory. */
const hits = new Map<string, { n: number; t: number }>();
export async function POST(req: Request) {
  const { q } = (await req.json()) as { q?: string };
  if (!q?.trim()) return NextResponse.json({ error: "Ask something." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for") || "anon";
  const h = hits.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - h.t > 3600_000) { h.n = 0; h.t = Date.now(); }
  if (++h.n > 30) return NextResponse.json({ error: "Slow down a little; try again in a bit." }, { status: 429 });
  hits.set(ip, h);
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Help isn't available right now." }, { status: 500 });

  let guide = "";
  try { guide = await readFile(path.join(process.cwd(), "docs", "Next_Owner_Market_User_Guide.md"), "utf8"); } catch { /* optional */ }
  const faq = TOPICS.map((t) => `Q: ${t.q}\n${t.a.join("\n")}`).join("\n\n");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    // The guide is the same for every question, so it's cached: repeat questions read it at a tenth of the price.
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: `You answer questions for people using Next Owner Market (nextownermarket.com), a marketplace where anyone can list stuff, buyers pay by card, and money is held until the buyer has the item. Many users have never sold online. Answer in plain, friendly English at an 8th-grade level, 2-5 short sentences, no jargon, no bullet lists unless steps. Say exactly what to tap ("Tap + Add"). If the answer isn't in the material below, say you're not sure and suggest messaging us from the Wanted page or emailing the store. Never invent fees, dates, or policies.\n\n=== HELP TOPICS ===\n${faq}\n\n=== USER GUIDE ===\n${guide.slice(0, 60000)}` }],
    messages: [{ role: "user", content: q.trim().slice(0, 500) }],
  });
  await logUsage(null, "help_question", MODEL, r.usage);
  const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
  return NextResponse.json({ answer: text });
}
