import { redirect, notFound } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";

export const metadata = { title: "Photo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * One listing photo, alone, filling the whole browser window on white (Oct 24, 2026). Owner only.
 * Claude in Chrome can't attach photos from a web link, but it can upload a screenshot it takes itself:
 * it opens this page, screenshots it, and uploads that screenshot into Facebook's photo box. Nothing else
 * is on the page so the screenshot is just the photo.
 */
export default async function FbPhoto({ params }: { params: Promise<{ id: string; n: string }> }) {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/app");
  const { id, n } = await params;
  const supabase = await createClient();
  const { data: it } = await supabase.from("items").select("item_photos(url, sort_order)").eq("id", id).single();
  const ph = ((it?.item_photos as { url: string; sort_order: number }[]) || []).sort((a, b) => a.sort_order - b.sort_order)[Math.max(0, Number(n) - 1)];
  if (!ph) notFound();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={ph.url} alt={`Photo ${n}`} style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain" }} />
    </div>
  );
}
