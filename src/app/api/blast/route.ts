import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { admin, site } from "@/lib/stripe";
import { money } from "@/lib/listing";

export const maxDuration = 300;

/** Staff: POST { subject, intro, itemIds, test?: boolean } → emails every subscriber (or just staff if test). */
export async function POST(req: Request) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Email sending isn't set up (RESEND_API_KEY)." }, { status: 400 });
  const { subject, intro, itemIds, test } = (await req.json()) as { subject: string; intro?: string; itemIds: string[]; test?: boolean };
  if (!subject?.trim() || !itemIds?.length) return NextResponse.json({ error: "Subject and at least one item." }, { status: 400 });
  const db = admin();
  const [{ data: items }, { data: biz }] = await Promise.all([
    db.from("items").select("id, sku, title, price, item_photos(url, is_primary)").in("id", itemIds).eq("status", "active"),
    db.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const b = (biz?.value as { name?: string; location?: string; address?: string; contact_email?: string }) || {};
  const from = process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`;
  const base = site();
  const cards = (items || []).map((it) => {
    const p = (it.item_photos as { url: string; is_primary: boolean }[]).find((x) => x.is_primary)?.url || (it.item_photos as { url: string }[])[0]?.url;
    return `<td style="width:50%;padding:6px;vertical-align:top"><a href="${base}/item/${it.sku}" style="text-decoration:none;color:#111"><img src="${p || ""}" style="width:100%;border-radius:8px;display:block" alt=""><div style="font-weight:700;margin-top:6px">${money(it.price)}</div><div style="font-size:14px">${it.title}</div></a></td>`;
  });
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(`<tr>${cards[i]}${cards[i + 1] || "<td></td>"}</tr>`);
  const html = (unsub: string) => `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:16px">
<h1 style="font-size:22px;margin:0 0 4px">${b.name || "Next Owner Market"}</h1>
${intro ? `<p style="font-size:15px;line-height:1.4">${intro.replace(/\n/g, "<br>")}</p>` : ""}
<table style="width:100%;border-collapse:collapse">${rows.join("")}</table>
<p style="text-align:center;margin:18px 0"><a href="${base}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">See everything in the store</a></p>
<p style="font-size:12px;color:#666;text-align:center">${b.name || "Next Owner Market"} · ${b.address || b.location || "Virginia"}${b.contact_email ? ` · ${b.contact_email}` : ""}<br>You're getting this because you signed up, bought, or asked us to find something. <a href="${unsub}" style="color:#666">Unsubscribe</a></p></div>`;

  let recipients: { email: string; unsub_token: string }[] = [];
  if (test) {
    recipients = [{ email: me.email!, unsub_token: "test" }];
  } else {
    const { data } = await db.from("subscribers").select("email, unsub_token").eq("unsubscribed", false).not("email", "is", null).limit(5000);
    recipients = (data || []) as { email: string; unsub_token: string }[];
  }
  let sent = 0;
  // Resend batch endpoint: up to 100 per call
  for (let i = 0; i < recipients.length; i += 100) {
    const batch = recipients.slice(i, i + 100).map((r) => ({ from, to: [r.email], subject, html: html(`${base}/unsubscribe?t=${r.unsub_token}`) }));
    const res = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(batch) });
    if (res.ok) sent += batch.length;
  }
  if (!test) await db.from("blasts").insert({ subject, intro: intro || null, item_ids: itemIds, sent_by: me.id, recipients: recipients.length, sent });
  return NextResponse.json({ ok: true, recipients: recipients.length, sent });
}
