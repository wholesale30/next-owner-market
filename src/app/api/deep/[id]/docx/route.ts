import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepDocx } from "@/lib/deepdocx";
import type { DeepReport, QA } from "@/lib/deepcheck";

export const maxDuration = 60;

/** GET — the saved report as a Word white paper (.docx). */
export async function GET(_: Request, ctx: RouteContext<"/api/deep/[id]/docx">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: row } = await supabase.from("deep_reports").select("title, notes, photo_urls, report, qa, created_at").eq("id", id).single();
  if (!row?.report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const buf = await deepDocx({ report: row.report as DeepReport, qa: (row.qa as QA[]) || [], notes: row.notes, photoUrls: row.photo_urls || [], createdAt: row.created_at });
  const name = `${(row.title || "Report").replace(/[^A-Za-z0-9 ._-]+/g, "").trim().slice(0, 60).replace(/\s+/g, "_") || "Report"}_${String(row.created_at).slice(0, 10)}.docx`;
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
