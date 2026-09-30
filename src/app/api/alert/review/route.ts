import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/** Called after a consignor submits an item for review → instant staff alert. POST { itemId } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (me.role === "admin" || me.role === "staff") return NextResponse.json({ ok: true, skipped: true });
  const { itemId } = (await req.json()) as { itemId: string };
  const { data: it } = await admin().from("items").select("id, title, price, status, owner_id").eq("id", itemId).single();
  if (!it || it.owner_id !== me.id || it.status !== "pending_review") return NextResponse.json({ ok: true, skipped: true });
  await alertStaff("Listing waiting for review", `${me.business_name || me.full_name || me.email}: "${it.title}" $${it.price ?? "?"}.`, `/app/review`);
  return NextResponse.json({ ok: true });
}
