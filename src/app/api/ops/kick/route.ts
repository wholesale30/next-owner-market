import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { runAutomations, setCatchup } from "@/lib/automations";

/**
 * Single-use trigger: runs chosen automations once when called with a token that staff (or Claude, via SQL)
 * just put in settings key "ops:kick". The token is erased before anything runs, so a link can't be reused.
 */
export const maxDuration = 300;
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.from("settings").select("value").eq("key", "ops:kick").maybeSingle();
  const v = data?.value as { token?: string; only?: string[]; catchup?: boolean; expires?: string } | undefined;
  if (!token || !v?.token || v.token !== token || (v.expires && v.expires < new Date().toISOString())) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  await db.from("settings").delete().eq("key", "ops:kick");
  setCatchup(!!v.catchup);
  const out: Record<string, unknown> = {};
  try { for (const k of v.only || []) Object.assign(out, await runAutomations(k)); } finally { setCatchup(false); }
  return NextResponse.json({ ok: true, ran: out });
}
