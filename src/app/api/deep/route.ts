import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepCheck } from "@/lib/deepcheck";
import { itemFields } from "@/lib/deepitem";

export const maxDuration = 300;

/** POST { photoUrls, notes } — 🔬 Advanced What's it worth. Owner only for now (a paid add-on later). Saves the report. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Owner only for now." }, { status: 403 });
  const body = (await req.json()) as { photoUrls?: string[]; notes?: string; redo_id?: string };
  let { photoUrls, notes } = body;
  let redo: { id: string; item_id: string | null } | null = null;
  if (body.redo_id) {
    // 🔄 Run it again: same photos and notes, the report is replaced (and a draft listing made from it is refreshed)
    const { data: old } = await supabase.from("deep_reports").select("id, photo_urls, notes, item_id").eq("id", body.redo_id).single();
    if (!old) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    photoUrls = old.photo_urls || []; notes = old.notes || ""; redo = { id: old.id, item_id: old.item_id };
  }
  if (!photoUrls?.length && !notes?.trim()) return NextResponse.json({ error: "Add a photo or say what it is." }, { status: 400 });
  try {
    const { report, cost } = await deepCheck(new Anthropic(), { photoUrls: photoUrls || [], notes: notes || "", ownerId: user.id });
    if (redo) {
      const { error } = await supabase.from("deep_reports").update({ title: report.what.slice(0, 200), report, qa: [], cost, updated_at: new Date().toISOString() }).eq("id", redo.id);
      if (error) return NextResponse.json({ error: `Report made but not saved: ${error.message}` }, { status: 500 });
      if (redo.item_id) await supabase.from("items").update(itemFields(report)).eq("id", redo.item_id).in("status", ["draft", "pending_review"]);
      return NextResponse.json({ id: redo.id });
    }
    const { data, error } = await supabase.from("deep_reports").insert({ owner_id: user.id, title: report.what.slice(0, 200), photo_urls: photoUrls || [], notes: notes || null, report, cost }).select("id").single();
    if (error) return NextResponse.json({ error: `Report made but not saved: ${error.message}` }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
