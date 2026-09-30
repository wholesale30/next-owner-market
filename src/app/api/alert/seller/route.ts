import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, site } from "@/lib/stripe";

/** Staff → seller: "we changed your listing". POST { itemId, note } */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const { itemId, note } = (await req.json()) as { itemId: string; note: string };
  const db = admin();
  const { data: it } = await db.from("items").select("sku, title, owner_id, profiles!items_owner_id_fkey(email, role)").eq("id", itemId).single();
  const owner = it?.profiles as unknown as { email: string | null; role: string } | null;
  if (!it || !owner?.email || owner.role === "admin" || owner.role === "staff") return NextResponse.json({ ok: true, skipped: true });
  const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
  const b = (biz?.value as { name?: string; contact_email?: string }) || {};
  await db.from("notifications").insert({ profile_id: it.owner_id, contact: owner.email, channel: "email", subject: `Your listing was updated: ${it.title}`, body: note, related_item_id: itemId, sent_at: process.env.RESEND_API_KEY ? new Date().toISOString() : null });
  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`, to: [owner.email], reply_to: b.contact_email || undefined, subject: `Your listing was updated: ${it.title}`, text: `${note}\n\nSee it: ${site()}/item/${it.sku}\nQuestions? Reply to this email.` }) });
  }
  return NextResponse.json({ ok: true });
}
