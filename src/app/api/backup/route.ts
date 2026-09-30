import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { runBackup } from "@/lib/backup";

export const maxDuration = 120;

/** Admin: POST → take a backup now; GET → list backups with 10-minute download links. */
export async function POST() {
  const me = await getProfile();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try { return NextResponse.json(await runBackup()); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
export async function GET() {
  const me = await getProfile();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const db = admin();
  const { data: files } = await db.storage.from("backups").list("", { limit: 60, sortBy: { column: "created_at", order: "desc" } });
  const out = [];
  for (const f of files || []) {
    const { data } = await db.storage.from("backups").createSignedUrl(f.name, 600);
    out.push({ name: f.name, size: (f.metadata as { size?: number } | null)?.size || 0, created_at: f.created_at, url: data?.signedUrl });
  }
  return NextResponse.json({ backups: out });
}
