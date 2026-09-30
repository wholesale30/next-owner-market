import { NextResponse } from "next/server";
import { admin } from "@/lib/stripe";

/** POST { token, password } → sets the new password, burns the token. */
export async function POST(req: Request) {
  const { token, password } = (await req.json()) as { token?: string; password?: string };
  if (!token || !password) return NextResponse.json({ error: "Missing info." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  const db = admin();
  const { data: row } = await db.from("password_resets").select("user_id, expires_at, used_at").eq("token", token).maybeSingle();
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return NextResponse.json({ error: "This link has expired. Request a new one." }, { status: 400 });
  const { error } = await db.auth.admin.updateUserById(row.user_id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("password_resets").update({ used_at: new Date().toISOString() }).eq("token", token);
  const { data: prof } = await db.from("profiles").select("email").eq("id", row.user_id).single();
  return NextResponse.json({ ok: true, email: prof?.email });
}
