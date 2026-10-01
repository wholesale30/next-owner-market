import { createClient as createAdmin } from "@supabase/supabase-js";
import { shareCard } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "What it's worth, on Next Owner Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: v } = await db.from("valuations").select("title, value_low, value_high, era, photo_url").eq("slug", slug).maybeSingle();
  const m = (n: number) => `$${Math.round(n).toLocaleString()}`;
  return shareCard({ title: v?.title || "Item", big: v ? `${m(v.value_low)}–${m(v.value_high)}` : "", sub: v?.era ? `${v.era} · worth about` : "worth about", photo: v?.photo_url || null });
}
