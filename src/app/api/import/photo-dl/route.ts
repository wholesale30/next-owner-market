import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET ?item=<id>&i=<n> — one listing photo as a file download (named <SKU>-<n>.jpg), owner only (Oct 24, 2026).
 * Facebook's photo picker only takes files from the computer, and Claude in Chrome can't reliably attach photos
 * from a web link, so the Next post page saves each listing's photos into Downloads first.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const n = Math.max(0, Number(sp.get("i")) || 0);
  const { data: it } = await supabase.from("items").select("sku, item_photos(url, sort_order)").eq("id", sp.get("item") || "").single();
  const ph = ((it?.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[n];
  if (!it || !ph) return NextResponse.json({ error: "No photo" }, { status: 404 });
  const r = await fetch(ph.url);
  if (!r.ok) return NextResponse.json({ error: "Photo not found" }, { status: 502 });
  return new NextResponse(await r.arrayBuffer(), { headers: { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="${it.sku}-${n + 1}.jpg"`, "Cache-Control": "no-store" } });
}
