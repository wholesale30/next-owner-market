import { NextResponse } from "next/server";
import { admin, site } from "@/lib/stripe";

/** POST { email } → emails a 1-hour reset link. Always returns ok (doesn't reveal whether the email exists). */
export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  const e = (email || "").trim().toLowerCase();
  if (!e) return NextResponse.json({ ok: true });
  const db = admin();
  const { data: prof } = await db.from("profiles").select("id, full_name").eq("email", e).maybeSingle();
  if (prof && process.env.RESEND_API_KEY) {
    const { data: row } = await db.from("password_resets").insert({ user_id: prof.id }).select("token").single();
    const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
    const b = (biz?.value as { name?: string }) || {};
    const link = `${site()}/reset?t=${row!.token}`;
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`, to: [e], subject: "Reset your password", text: `Hi${prof.full_name ? " " + prof.full_name.split(" ")[0] : ""},\n\nTap this link to choose a new password (good for 1 hour):\n${link}\n\nIf you didn't ask for this, ignore it; nothing changes.` }) });
  }
  return NextResponse.json({ ok: true });
}
