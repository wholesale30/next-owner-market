import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepCheck } from "@/lib/deepcheck";

export const maxDuration = 300;

/** POST { photoUrls, notes } — 🔬 Advanced What's it worth. Owner only for now (a paid add-on later). Saves the report. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Owner only for now." }, { status: 403 });
  const { photoUrls, notes } = (await req.json()) as { photoUrls: string[]; notes?: string };
  if (!photoUrls?.length && !notes?.trim()) return NextResponse.json({ error: "Add a photo or say what it is." }, { status: 400 });
  try {
    const { report, cost } = await deepCheck(new Anthropic(), { photoUrls: photoUrls || [], notes: notes || "", ownerId: user.id });
    const { data, error } = await supabase.from("deep_reports").insert({ owner_id: user.id, title: report.what.slice(0, 200), photo_urls: photoUrls || [], notes: notes || null, report, cost }).select("id").single();
    if (error) return NextResponse.json({ error: `Report made but not saved: ${error.message}` }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
