import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepAsk, type DeepReport, type QA } from "@/lib/deepcheck";

export const maxDuration = 180;

/** POST { question } — a follow-up question on a saved report; the answer is saved into the report. */
export async function POST(req: Request, ctx: RouteContext<"/api/deep/[id]/ask">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { question } = (await req.json()) as { question: string };
  if (!question?.trim()) return NextResponse.json({ error: "Type or say a question." }, { status: 400 });
  const { data: row } = await supabase.from("deep_reports").select("report, qa, photo_urls, cost").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  try {
    const { qa, cost } = await deepAsk(new Anthropic(), { report: row.report as DeepReport, qa: (row.qa as QA[]) || [], question, photoUrls: row.photo_urls || [], ownerId: user.id });
    const all = [...((row.qa as QA[]) || []), qa];
    const { error } = await supabase.from("deep_reports").update({ qa: all, cost: Number(row.cost || 0) + cost, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: `Answered but not saved: ${error.message}`, qa }, { status: 500 });
    return NextResponse.json({ qa });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
