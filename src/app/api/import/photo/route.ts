import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * GET ?url=… — fetches one Facebook photo for the importer (the phone can't read Facebook's photo links directly).
 * Only Facebook's own photo hosts, only for the owner, so it can't be used as an open proxy.
 */
const OK_HOST = /(^|\.)(fbcdn\.net|facebook\.com|fbsbx\.com)$/i;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Owner only" }, { status: 403 }); // owner only (Oct 23, 2026)
  const raw = new URL(req.url).searchParams.get("url") || "";
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: "Bad link" }, { status: 400 }); }
  if (u.protocol !== "https:" || !OK_HOST.test(u.hostname)) return NextResponse.json({ error: "Not a Facebook photo link" }, { status: 400 });
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.startsWith("image/")) return NextResponse.json({ error: r.status === 403 || r.status === 410 ? "Photo link expired" : `Photo not found (${r.status})` }, { status: 502 });
  return new NextResponse(await r.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
}
