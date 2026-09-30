import { createClient as createAdmin } from "@supabase/supabase-js";

/** Send everything in the notifications queue that has a contact. Email via Resend; SMS via Twilio when configured. */
export async function flushNotifications(limit = 100) {
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: queue } = await admin.from("notifications").select("*").is("sent_at", null).limit(limit);
  const { data: biz } = await admin.from("settings").select("value").eq("key", "business").maybeSingle();
  const business = (biz?.value as { name?: string; contact_email?: string }) || {};
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  let sent = 0, skipped = 0;
  for (const n of queue || []) {
    const to = n.contact as string | null;
    if (!to) { skipped++; continue; }
    const isPhone = /^[\d\s()+-]{7,}$/.test(to);
    const link = n.related_item_id ? `${site}/item/${(await admin.from("items").select("sku").eq("id", n.related_item_id).single()).data?.sku}` : site;
    let ok = false;
    try {
      if (isPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
        const body = new URLSearchParams({ To: to.replace(/[\s()-]/g, ""), From: process.env.TWILIO_FROM, Body: `${n.body} ${link}` });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body });
        ok = r.ok;
      } else if (!isPhone && process.env.RESEND_API_KEY) {
        const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM || `${business.name || "Next Owner Market"} <alerts@nextownermarket.com>`, to, subject: n.subject || "Update", text: `${n.body}\n${link}` }) });
        ok = r.ok;
      } else { skipped++; continue; }
    } catch { ok = false; }
    if (ok) { await admin.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", n.id); sent++; }
  }
  return { sent, skipped, queued: queue?.length || 0 };
}
