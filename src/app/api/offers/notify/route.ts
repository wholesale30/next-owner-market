import { NextResponse } from "next/server";
import { admin, site } from "@/lib/stripe";
import { alertStaff } from "@/lib/alert";

/** POST { offerId, event: "new" | "accepted" | "declined" | "countered" | "counter_accepted" } → emails the other side. */
export async function POST(req: Request) {
  const { offerId, event } = (await req.json()) as { offerId: string; event: string };
  const db = admin();
  const { data: o } = await db.from("offers").select("*, items(sku, title, price)").eq("id", offerId).single();
  if (!o) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [{ data: buyer }, { data: seller }, { data: biz }] = await Promise.all([
    db.from("profiles").select("email, full_name").eq("id", o.buyer_id).single(),
    db.from("profiles").select("email, full_name, business_name, role").eq("id", o.seller_id).single(),
    db.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const b = (biz?.value as { name?: string }) || {};
  const from = process.env.EMAIL_FROM || `${b.name || "Next Owner Market"} <alerts@nextownermarket.com>`;
  const item = o.items as unknown as { sku: string; title: string; price: number };
  const link = `${site()}/item/${item.sku}`;
  const send = (to: string, subject: string, text: string) => process.env.RESEND_API_KEY ? fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text }) }).catch(() => {}) : Promise.resolve();
  const platform = seller?.role === "admin" || seller?.role === "staff";
  const $ = (n: number | string) => `$${Number(n).toFixed(2)}`;
  if (event === "new" || event === "counter_accepted") {
    const txt = event === "new"
      ? `${buyer?.full_name || "A buyer"} offered ${$(o.amount)} on "${item.title}" (asking ${$(item.price)}).${o.message ? `\n\n"${o.message}"` : ""}\n\nAccept, decline, or counter: ${site()}/app/offers\nOffers expire in 48 hours.`
      : `${buyer?.full_name || "The buyer"} accepted your counter of ${$(o.amount)} on "${item.title}". They can now buy at that price for 48 hours.`;
    if (seller?.email && !platform) await send(seller.email, `${event === "new" ? "Offer" : "Counter accepted"}: ${$(o.amount)} on ${item.title}`, txt);
    await alertStaff(`${event === "new" ? "Offer" : "Counter accepted"}: ${$(o.amount)} on ${item.title}`, txt.split("\n")[0], "/app/offers");
  } else if (buyer?.email) {
    const txt = event === "accepted" ? `Your offer of ${$(o.amount)} on "${item.title}" was accepted. Buy it at that price within 48 hours: ${link}`
      : event === "countered" ? `The seller countered your ${$(o.amount)} offer on "${item.title}" with ${$(o.counter_amount)}. Accept or let it go: ${site()}/account`
      : `Your offer of ${$(o.amount)} on "${item.title}" was declined. The asking price is ${$(item.price)}: ${link}`;
    await send(buyer.email, `Offer ${event}: ${item.title}`, txt);
  }
  return NextResponse.json({ ok: true });
}
