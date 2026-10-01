import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";

/** Opt in to the Monday "new color-tag sale this week, check before you buy" email. */
export async function POST(req: Request) {
  const me = await getProfile();
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const to = (me?.email || email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: "Type your email." }, { status: 400 });
  const d = admin();
  const { data: ex } = await d.from("subscribers").select("id, interests").eq("email", to).maybeSingle();
  if (ex) {
    const set = new Set([...(ex.interests || []), "thrift_monday"]);
    await d.from("subscribers").update({ interests: [...set], unsubscribed: false }).eq("id", ex.id);
  } else {
    await d.from("subscribers").insert({ email: to, name: me?.full_name || null, source: "thrift", profile_id: me?.id || null, interests: ["thrift_monday"], unsub_token: randomBytes(12).toString("hex") });
  }
  return NextResponse.json({ ok: true });
}
