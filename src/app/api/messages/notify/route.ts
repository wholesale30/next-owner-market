import { NextResponse } from "next/server";
import { textSeller } from "@/lib/sms";
import { admin, site } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/** After any message is written: email the other side right away. POST { conversationId } */
export async function POST(req: Request) {
  const { conversationId } = (await req.json()) as { conversationId: string };
  if (!conversationId) return NextResponse.json({ error: "no id" }, { status: 400 });
  const db = admin();
  const { data: c } = await db.from("conversations").select("*, items(sku, title, price), profiles!conversations_seller_profile_id_fkey(role, email, phone, full_name, business_name, sms_gateway, alert_messages, alert_orders)").eq("id", conversationId).single();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: last } = await db.from("messages").select("sender, body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(1).single();
  if (!last) return NextResponse.json({ ok: true });
  const item = c.items as unknown as { sku: string; title: string; price: number } | null;
  const seller = c.profiles as unknown as { role: string; email: string | null; phone: string | null; full_name: string | null; business_name: string | null; sms_gateway?: string | null; alert_messages?: boolean; alert_orders?: boolean } | null;
  const { data: biz } = await db.from("settings").select("value").eq("key", "business").maybeSingle();
  const b = (biz?.value as { name?: string; contact_email?: string; alert_all_messages?: boolean }) || {};
  const from = process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`;
  const link = item ? `${site()}/item/${item.sku}` : site();
  const isEmail = (s: string | null | undefined) => !!s && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

  async function send(to: string, subject: string, text: string, replyTo?: string) {
    if (!process.env.RESEND_API_KEY) return false;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }) });
    return r.ok;
  }

  if (last.sender === "buyer") {
    // → seller (if a consignor with an email) and staff
    const about = item ? `${item.title} (${item.sku})` : "a general question";
    const body = `${c.buyer_name || "A buyer"} wrote about ${about}:\n\n"${last.body}"\n\nReply in the app: ${site()}/app/inbox?c=${c.id}`;
    const sellerIsStaff = seller?.role === "admin" || seller?.role === "staff";
    if (seller && !sellerIsStaff && isEmail(seller.email)) await send(seller.email!, `New message about ${item?.title || "your listing"}`, body);
    if (seller && !sellerIsStaff) await textSeller(seller, "message", `NOM: ${c.buyer_name || "A buyer"} asked about ${item?.title || "your listing"}: "${last.body.slice(0, 60)}" Reply: ${site()}/app/inbox`);
    // staff are pinged for their own items and general questions; consignor-item chatter stays in the Inbox unless alert_all_messages is on
    if (sellerIsStaff || !seller || b.alert_all_messages) await alertStaff(`Message: ${item?.title || "general"}`, `${c.buyer_name || "Buyer"}: ${last.body.slice(0, 120)}`, `/app/inbox?c=${c.id}`);
  } else {
    // staff/seller → buyer
    const who = seller && seller.role !== "admin" && seller.role !== "staff" ? seller.business_name || seller.full_name || "the seller" : b.name || "Next Owner Market";
    const sellerIsStaff = seller?.role === "admin" || seller?.role === "staff";
    const text = `${who} replied about ${item?.title || "your message"}:\n\n"${last.body}"\n\n${c.buyer_profile_id ? `Reply in your account: ${site()}/account` : `Reply here: ${link} (tap "Message about this"; use the same ${isEmail(c.buyer_contact) ? "email" : "number"} and it lands in the same thread)`}\n\nMessages stay inside Next Owner Market so both sides are protected. Pay through the site's checkout; never send money outside it.`;
    if (isEmail(c.buyer_contact)) {
      await send(c.buyer_contact, `Reply: ${item?.title || "your message"}`, text, sellerIsStaff ? b.contact_email || undefined : undefined);
    } else {
      // phone-only buyer: queue for SMS (sends once Twilio is set up); seller can tap Text in the inbox meanwhile
      await db.from("notifications").insert({ profile_id: c.buyer_profile_id, contact: c.buyer_contact, channel: "sms", subject: `Reply about ${item?.title || "your message"}`, body: last.body, related_item_id: c.item_id });
    }
  }
  return NextResponse.json({ ok: true });
}
