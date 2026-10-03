import { redirect } from "next/navigation";
import StoreHeader from "../StoreHeader";
import { getProfile } from "@/lib/supabase/server";
import { admin } from "@/lib/stripe";
import LookupsClient, { type Row } from "./LookupsClient";

export const metadata = { title: "My lookups" };
export const dynamic = "force-dynamic";

/** Everything someone has checked, saved until they delete it. List any of it later. */
export default async function LookupsPage() {
  const me = await getProfile();
  if (!me) redirect("/signup?buyer=1&next=/lookups");
  const { data } = await admin().from("lookups").select("id, tool, title, photo_urls, value_low, value_high, item_id, listed_count, created_at, result").eq("owner_id", me.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000);
  const rows: Row[] = (data || []).map((r) => {
    const res = (r.result || {}) as { verdict?: string; pieces?: unknown[]; items?: { action?: string }[] };
    return {
      id: r.id, tool: r.tool, title: r.title || "Untitled", photo: (r.photo_urls || [])[0] || null, low: Number(r.value_low || 0), high: Number(r.value_high || 0),
      item_id: r.item_id, listed: Number(r.listed_count || 0) > 0 || !!r.item_id, created_at: r.created_at,
      verdict: r.tool === "buy_or_pass" ? res.verdict || null : null,
      count: r.tool === "pile" ? (res.items || []).filter((x) => x.action === "sell").length : Array.isArray(res.pieces) && res.pieces.length ? res.pieces.length : 0,
    };
  });
  return (
    <div className="flex-1">
      <StoreHeader business={{ name: "Next Owner Market" }} signedIn />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">📂 My lookups</h1>
          <p className="text-sm muted">Everything you&apos;ve checked is saved here until you delete it. Check a whole pallet now, then tap <b>📝 List it</b> when you&apos;re ready.</p>
        </div>
        <LookupsClient rows={rows} />
      </main>
    </div>
  );
}
