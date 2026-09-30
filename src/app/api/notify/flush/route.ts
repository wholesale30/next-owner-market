import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { flushNotifications } from "@/lib/notify";

/** Staff/seller: send queued alerts now (called right after a listing goes live). */
export async function POST() {
  const me = await getProfile();
  if (!me || me.role === "buyer") return NextResponse.json({ error: "no" }, { status: 403 });
  return NextResponse.json(await flushNotifications(200));
}
