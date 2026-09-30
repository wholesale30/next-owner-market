import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { alertStaff } from "@/lib/alert";
import { lookupZip } from "@/lib/geo";

// Creates the account server-side, already confirmed, so no confirmation email
// (and no Supabase Site URL / redirect list) is ever involved.
export async function POST(req: Request) {
  const { email, password, full_name, phone, role, ref, city, state, zip } = (await req.json()) as { email?: string; password?: string; full_name?: string; phone?: string; role?: string; ref?: string; city?: string; state?: string; zip?: string };
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: created, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || "", phone: phone || null, role: role === "buyer" ? "buyer" : "consignor" },
  });
  if (error) {
    const msg = /already|exists|registered/i.test(error.message) ? "That email already has an account. Sign in instead." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (created?.user && (city || state || zip)) { const g = lookupZip(zip); await admin.from("profiles").update({ city: city || g?.city || null, state: state || g?.state || null, zip: zip || null, lat: g?.lat ?? null, lng: g?.lng ?? null }).eq("id", created.user.id); }
  if (ref && created?.user) await admin.rpc("apply_referral", { p_new: created.user.id, p_code: ref.trim().toLowerCase() });
  if (role !== "buyer") await alertStaff("New seller waiting for approval", `${full_name || email} signed up to sell. Approve them under People.`, "/app/people?filter=pending");
  return NextResponse.json({ ok: true });
}
