import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/**
 * POST { kind: "idea"|"problem", message, page?, email?, image? } -> saved + the owner gets an alert right away.
 * Staff: POST { action: "status", id, status, note } to mark it planned / done / not now.
 */
const hits = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const me = await getProfile();
  const b = (await req.json().catch(() => ({}))) as { kind?: string; message?: string; page?: string; email?: string; image?: string; action?: string; id?: string; status?: string; note?: string };
  const d = admin();

  if (b.action === "status") {
    if (!me || (me.role !== "admin" && me.role !== "staff")) return NextResponse.json({ error: "Staff only" }, { status: 403 });
    if (!["new", "planned", "done", "not_now"].includes(String(b.status))) return NextResponse.json({ error: "Bad status" }, { status: 400 });
    await d.from("feedback").update({ status: b.status, staff_note: b.note ? String(b.note).slice(0, 1000) : null, updated_at: new Date().toISOString() }).eq("id", String(b.id));
    return NextResponse.json({ ok: true });
  }

  const kind = b.kind === "problem" ? "problem" : "idea";
  const message = String(b.message || "").trim().slice(0, 4000);
  if (message.length < 3) return NextResponse.json({ error: "Tell us a little more." }, { status: 400 });
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const hit = hits.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - hit.t > 3600_000) { hit.n = 0; hit.t = Date.now(); }
  if (++hit.n > 20) return NextResponse.json({ error: "Thanks! That's a lot at once; try again in a bit." }, { status: 429 });
  hits.set(ip, hit);

  let photo_url: string | null = null;
  const m = b.image ? /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(b.image) : null;
  if (m) {
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length <= 4_500_000) {
      const path = `feedback/${me?.id || "anon"}/${Date.now()}.${m[1] === "png" ? "png" : "jpg"}`;
      const up = await d.storage.from("item-photos").upload(path, bytes, { contentType: `image/${m[1]}` });
      if (!up.error) photo_url = d.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
    }
  }
  const page = b.page && /^\/[^\s]{0,300}$/.test(b.page) ? b.page : null;
  const email = me?.email || (b.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) ? b.email.slice(0, 200) : null);
  const { data: row } = await d.from("feedback").insert({ kind, message, page, email, owner_id: me?.id || null, photo_url, user_agent: (h.get("user-agent") || "").slice(0, 300) }).select("id").single();
  const who = me ? (me.full_name || me.username || me.email) : email || "someone not signed in";
  await alertStaff(kind === "problem" ? `🐞 Something's not working (${who})` : `💡 New idea (${who})`, `${message.slice(0, 600)}${page ? `\n\nPage: ${page}` : ""}${photo_url ? "\n(screenshot attached)" : ""}`, "/app/feedback");
  return NextResponse.json({ ok: true, id: row?.id || null });
}
