import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { alertStaff } from "@/lib/alert";
import { lookupZip } from "@/lib/geo";

// Creates the account server-side, already confirmed, so no confirmation email
// (and no Supabase Site URL / redirect list) is ever involved.
export async function POST(req: Request) {
  const { invite, username, email, password, full_name, phone, role, ref, city, state, zip, try: tryToken } = (await req.json()) as { try?: string; invite?: string; username?: string; email?: string; password?: string; full_name?: string; phone?: string; role?: string; ref?: string; city?: string; state?: string; zip?: string };
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const uname = (username || "").trim().toLowerCase();
  if (uname && !/^[a-z0-9][a-z0-9_]{2,19}$/.test(uname)) return NextResponse.json({ error: "Username: 3–20 letters, numbers, or _." }, { status: 400 });
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
  if (created?.user && uname) {
    const { data: free } = await admin.rpc("username_available", { p_name: uname });
    if (free) await admin.from("profiles").update({ username: uname }).eq("id", created.user.id);
  }
  if (created?.user && (city || state || zip)) { const g = lookupZip(zip); await admin.from("profiles").update({ city: city || g?.city || null, state: state || g?.state || null, zip: zip || null, lat: g?.lat ?? null, lng: g?.lng ?? null }).eq("id", created.user.id); }
  if (ref && created?.user) await admin.rpc("apply_referral", { p_new: created.user.id, p_code: ref.trim().toLowerCase() });
  // "Try it free" result → their first draft listing, photo included.
  let tryItemId: string | null = null;
  if (tryToken && created?.user && /^[a-f0-9]{24}$/.test(tryToken)) {
    try {
      const { data: t } = await admin.from("settings").select("value").eq("key", `try:result:${tryToken}`).maybeSingle();
      const v = t?.value as { draft: Record<string, unknown>; photo_url: string; path: string } | undefined;
      if (v?.draft) {
        const dr = v.draft as { title?: string; description?: string; brand?: string | null; model?: string | null; category_id?: string | null; condition?: string; condition_notes?: string | null; specs?: Record<string, string>; tags?: string[]; price_min?: number; price_max?: number; weight_lbs?: number; box?: string };
        const mid = dr.price_min && dr.price_max ? Math.round((Number(dr.price_min) + Number(dr.price_max)) / 2) : dr.price_max ? Math.round(Number(dr.price_max)) : null;
        const { data: it } = await admin.from("items").insert({
          owner_id: created.user.id, created_by: created.user.id, title: dr.title || "My item", description: dr.description || "",
          brand: dr.brand || null, model: dr.model || null, category_id: dr.category_id || null, condition: dr.condition || "good", condition_notes: dr.condition_notes || null,
          specs: dr.specs || {}, tags: dr.tags || [], price: mid, price_min_suggested: dr.price_min ?? null, price_max_suggested: dr.price_max ?? null,
          weight_lbs: dr.weight_lbs ?? null, box: dr.box || "medium", shipping_ok: dr.box !== "freight", local_pickup_ok: true, shipping_mode: "calculated",
          tier: "self_listed", ai_generated: true, status: "draft",
        }).select("id").single();
        if (it) {
          await admin.from("item_photos").insert({ item_id: it.id, url: v.photo_url, storage_path: v.path, is_primary: true, sort_order: 0 });
          await admin.from("settings").update({ value: { ...v, claimed_by: created.user.id, item_id: it.id } }).eq("key", `try:result:${tryToken}`);
          tryItemId = it.id;
        }
      }
    } catch (e) { console.error("try claim", e); }
  }
  let invited = false;
  if (invite && created?.user) { const { data } = await admin.rpc("redeem_invite", { p_new: created.user.id, p_code: invite }); invited = !!data; }
  if (invited) { await alertStaff("Invite used", `${full_name || email} signed up with invite "${invite}" and has free Pro.`, "/app/invites"); return NextResponse.json({ ok: true, invited: true, item_id: tryItemId }); }
  if (role !== "buyer") await alertStaff("New seller waiting for approval", `${full_name || email} signed up to sell. Approve them under People.`, "/app/people?filter=pending");
  return NextResponse.json({ ok: true, item_id: tryItemId });
}
