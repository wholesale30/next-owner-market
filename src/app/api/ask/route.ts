import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { TOPICS } from "@/lib/help";
import { logUsage } from "@/lib/usage";
import { aiServiceDown, reportAiDown, AI_DOWN_MESSAGE } from "@/lib/ai-tool";

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
  // Send only the guide sections that match the question (the whole guide is ~14,000 tokens; this is ~3,000).
  const words = new Set(q.toLowerCase().match(/[a-z']{3,}/g) || []);
  const stop = new Set(["the", "and", "for", "how", "what", "does", "can", "you", "your", "with", "this", "that", "are", "get", "have", "where", "when", "why", "who", "any", "much"]);
  const sections = guide.split(/\n(?=## )/).map((sec) => {
    const lower = sec.toLowerCase();
    let score = 0;
    for (const w of words) if (!stop.has(w) && lower.includes(w)) score += lower.slice(0, 120).includes(w) ? 3 : 1;
    return { sec, score };
  });
  const picked = sections.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map((x) => x.sec.slice(0, 2500));
  const guidePart = (picked.length ? picked : sections.slice(0, 3).map((x) => x.sec.slice(0, 2500))).join("\n\n");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let r: Anthropic.Message;
  try {
  r = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [{ type: "text", text: `You answer questions for people using Next Owner Market (nextownermarket.com), a marketplace where anyone can list stuff, buyers pay by card, and money is held until the buyer has the item. Many users have never sold online. Answer in plain, friendly English at an 8th-grade level, 2-5 short sentences, no jargon, no bullet lists unless steps. Say exactly what to tap ("Tap + Add"). If the answer isn't in the material below, say you're not sure and suggest messaging us from the Wanted page or emailing the store. Never invent fees, dates, or policies.\n\n=== HELP TOPICS ===\n${faq}\n\n=== USER GUIDE (the parts that match the question) ===\n${guidePart}` }],
    messages: [{ role: "user", content: q.trim().slice(0, 500) }],
  });
  } catch (e) {
    if (aiServiceDown(e)) { await reportAiDown(e); return NextResponse.json({ error: AI_DOWN_MESSAGE }, { status: 503 }); }
    return NextResponse.json({ error: "Couldn't answer that right now. Try again." }, { status: 502 });
  }
  await logUsage(null, "help_question", MODEL, r.usage);
  const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
  return NextResponse.json({ answer: text });
}
