import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { indexNow } from "@/lib/indexnow";

/** Submit everything changed in the last day (called by the daily cron; or POST { paths } from the app after a listing goes live). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ data: items }, { data: posts }, { data: cats }] = await Promise.all([
    db.from("items").select("sku").gte("updated_at", since).in("status", ["active", "reserved", "sold"]).limit(2000),
    db.from("posts").select("slug").gte("updated_at", since).not("published_at", "is", null),
    db.from("categories").select("slug"),
  ]);
  const paths = ["/", "/sitemap.xml", ...(items || []).map((i) => `/item/${i.sku}`), ...(posts || []).map((p) => `/blog/${p.slug}`), ...(cats || []).map((c) => `/c/${c.slug}`)];
  await indexNow(paths);
  return NextResponse.json({ submitted: paths.length });
}

export async function POST(req: Request) {
  const { paths } = (await req.json()) as { paths?: string[] };
  if (!paths?.length) return NextResponse.json({ ok: false });
  await indexNow(paths.filter((p) => /^\/(item|blog|c)\//.test(p)).slice(0, 50));
  return NextResponse.json({ ok: true });
}
