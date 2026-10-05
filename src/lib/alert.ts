import { admin } from "@/lib/stripe";

/**
 * Instant staff alert (new seller, new order, problem report, new message).
 * Sends by email through Resend when RESEND_API_KEY is set. A phone's email-to-text
 * address (e.g. 5551234567@vtext.com) in STAFF_ALERT_TO makes it arrive as a text, free.
 * Always queues a row in notifications so nothing is lost if sending isn't set up yet.
 */
export async function alertStaff(subject: string, body: string, link?: string, opts: { longText?: boolean } = {}) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nextownermarket.com";
  const url = link ? `${site}${link}` : site;
  const db = admin();
  const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
  const b = (biz?.value as { contact_email?: string; alert_to?: string; name?: string }) || {};
  let to = (process.env.STAFF_ALERT_TO || b.alert_to || b.contact_email || "").split(",").map((s) => s.trim()).filter(Boolean);
  // A long message (the full to-do list) goes to Verizon's picture-message address so the whole thing arrives
  // as one text instead of being cut at 160 characters.
  if (opts.longText) to = to.map((a) => a.replace(/@vtext\.com$/i, "@vzwpix.com"));
  await db.from("notifications").insert({ contact: to[0] || null, channel: "email", subject, body: `${body} ${url}`, sent_at: process.env.RESEND_API_KEY && to.length ? new Date().toISOString() : null });
  if (!process.env.RESEND_API_KEY || !to.length) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <onboarding@resend.dev>`, to, subject, text: `${body}\n${url}` }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
