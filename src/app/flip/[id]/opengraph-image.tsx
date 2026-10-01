import { shareCard } from "@/lib/og";
import { admin } from "@/lib/stripe";

export const runtime = "nodejs"; export const size = { width: 1200, height: 630 }; export const contentType = "image/png"; export const alt = "Buy or pass?";
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: s } = /^[0-9a-f-]{36}$/.test(id) ? await admin().from("buy_pass_scans").select("what, paid, resale_low, resale_high, net_high, verdict, photo_url").eq("id", id).maybeSingle() : { data: null };
  if (!s) return shareCard({ title: "Check your thrift find before you buy it.", big: "Buy or pass?", sub: "Free · 10 seconds · no app" });
  return shareCard({
    title: s.what,
    big: `${String(s.verdict).toUpperCase()}${s.net_high > 0 ? ` · +${money(s.net_high)}` : ""}`,
    sub: s.paid ? `Paid ${money(s.paid)} → sells for ${money(s.resale_low)}–${money(s.resale_high)}` : `Sells for ${money(s.resale_low)}–${money(s.resale_high)}`,
    photo: s.photo_url,
  });
}
