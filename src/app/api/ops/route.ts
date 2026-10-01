import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { runAutomations } from "@/lib/automations";

export const maxDuration = 120;

/** Staff: POST { action: "run", key } runs one automation now; { action: "toggle", key, enabled } switches it; { action: "task", id, done, notes } updates a manual task. */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) return NextResponse.json({ error: "staff only" }, { status: 403 });
  const b = (await req.json()) as { action: string; key?: string; enabled?: boolean; id?: string; done?: boolean; notes?: string };
  const db = admin();
  if (b.action === "run" && b.key) { const r = await runAutomations(b.key); return NextResponse.json({ ok: true, result: r[b.key] }); }
  if (b.action === "toggle" && b.key) { await db.from("automations").update({ enabled: !!b.enabled }).eq("key", b.key); return NextResponse.json({ ok: true }); }
  if (b.action === "task" && b.id) { await db.from("ops_tasks").update({ done_at: b.done ? new Date().toISOString() : null, ...(b.notes !== undefined ? { notes: b.notes } : {}) }).eq("id", b.id); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
