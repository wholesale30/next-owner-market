import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askWithTool } from "@/lib/ai-tool";
import { cleanAiTells } from "@/lib/listing";
import { DEEP_MODEL, type DeepReport } from "@/lib/deepcheck";

export const maxDuration = 120;

type Listing = { listing_title: string; listing_description: string; list_price: number; listing_keywords: string[] };
type Saved = DeepReport & { listing_history?: Listing[] };
const cur = (r: Saved): Listing => ({ listing_title: r.listing_title, listing_description: r.listing_description, list_price: r.list_price, listing_keywords: r.listing_keywords || [] });

/**
 * POST { instruction } → rewrites the report's listing the way he says ("shorter", "price it at 150", "say it was serviced").
 * POST { undo: true } → puts the previous version back. Every version is kept so nothing is lost.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/deep/[id]/listing">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { instruction, undo } = (await req.json()) as { instruction?: string; undo?: boolean };
  const { data: row } = await supabase.from("deep_reports").select("report, notes, qa").eq("id", id).single();
  if (!row?.report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const r = row.report as Saved;
  const hist = r.listing_history || [];
  let next: Saved;
  if (undo) {
    if (!hist.length) return NextResponse.json({ error: "Nothing to undo." }, { status: 400 });
    next = { ...r, ...hist[hist.length - 1], listing_history: hist.slice(0, -1) };
  } else {
    if (!instruction?.trim()) return NextResponse.json({ error: "Say what to change." }, { status: 400 });
    const schema = { type: "object", properties: {
      listing_title: { type: "string", description: "max 80 characters" },
      listing_description: { type: "string" },
      list_price: { type: "number", description: "the price box amount; keep the current one unless the owner asks for a change" },
      listing_keywords: { type: "array", items: { type: "string" }, description: "12-20 search words; never another brand or 'like X'" },
    }, required: ["listing_title", "listing_description", "list_price", "listing_keywords"] };
    const qa = ((row.qa as { q: string; a: string }[]) || []).slice(-4).map((x) => `Q: ${x.q}\nA: ${x.a.slice(0, 600)}`).join("\n");
    try {
      const out = await askWithTool<Listing>(new Anthropic(), {
        model: DEEP_MODEL, max_tokens: 3000, log: { ownerId: user.id, feature: "deep_listing" },
        tool: { name: "write_listing", description: "Record the rewritten listing.", input_schema: schema as unknown as Anthropic.Tool.InputSchema },
        messages: [{ role: "user", content: `You write honest, paste-ready Facebook Marketplace and eBay listings for a surplus seller in Virginia, in his voice. Plain words, no dashes as punctuation, only flaws he states or that are visible, no hype.\nItem: ${r.what}${r.era ? ` (${r.era})` : ""}\nWhat we know: ${r.summary}\n${row.notes ? `His notes: ${row.notes}\n` : ""}${qa ? `${qa}\n` : ""}Current listing:\nTitle: ${r.listing_title}\nPrice: $${r.list_price}\nDescription:\n${r.listing_description}\nKeywords: ${(r.listing_keywords || []).join(", ")}\n\nThe owner wants this change: "${instruction.slice(0, 1500)}"\nMake exactly that change and keep everything else that's good. Call write_listing.` }],
      });
      const price = Number(out.list_price) > 0 ? Math.round(Number(out.list_price)) : r.list_price;
      next = { ...r, listing_title: cleanAiTells(out.listing_title || r.listing_title).slice(0, 100), listing_description: cleanAiTells(out.listing_description || r.listing_description), list_price: price, listing_keywords: Array.isArray(out.listing_keywords) ? out.listing_keywords.map(String).slice(0, 20) : r.listing_keywords, listing_history: [...hist, cur(r)].slice(-20) };
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }
  const { error } = await supabase.from("deep_reports").update({ report: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: cur(next), canUndo: !!(next.listing_history || []).length });
}
