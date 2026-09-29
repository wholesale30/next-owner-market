import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Creates the account server-side, already confirmed, so no confirmation email
// (and no Supabase Site URL / redirect list) is ever involved.
export async function POST(req: Request) {
  const { email, password, full_name, phone, role } = (await req.json()) as { email?: string; password?: string; full_name?: string; phone?: string; role?: string };
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || "", phone: phone || null, role: role === "buyer" ? "buyer" : "consignor" },
  });
  if (error) {
    const msg = /already|exists|registered/i.test(error.message) ? "That email already has an account. Sign in instead." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
