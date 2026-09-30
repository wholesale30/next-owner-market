import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { lookupZip } from "@/lib/geo";

/** Fill lat/lng (and blank city/state) from a profile's ZIP. POST { profileId? } — self, or any profile if staff. */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { profileId } = (await req.json().catch(() => ({}))) as { profileId?: string };
  const target = profileId && (me.role === "admin" || me.role === "staff") ? profileId : me.id;
  const db = admin();
  const { data: p } = await db.from("profiles").select("zip, city, state").eq("id", target).single();
  const g = lookupZip(p?.zip);
  if (!g) { await db.from("profiles").update({ lat: null, lng: null }).eq("id", target); return NextResponse.json({ ok: true, geo: null }); }
  await db.from("profiles").update({ lat: g.lat, lng: g.lng, city: p?.city || g.city, state: p?.state || g.state }).eq("id", target);
  return NextResponse.json({ ok: true, geo: g });
}
