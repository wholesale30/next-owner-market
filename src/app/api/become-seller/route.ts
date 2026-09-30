import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { alertStaff } from "@/lib/alert";

/** Signed-in buyer → seller (pending approval). */
export async function POST() {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (me.role !== "buyer") return NextResponse.json({ ok: true, already: true });
  const supabase = await createClient();
  const { error } = await supabase.rpc("become_seller");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await alertStaff("New seller waiting for approval", `${me.full_name || me.email} (existing buyer) wants to sell. Approve them under People.`, "/app/people");
  return NextResponse.json({ ok: true });
}
