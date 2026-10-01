import { redirect } from "next/navigation";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getProfile } from "@/lib/supabase/server";
import TrashClient from "./TrashClient";

export const metadata = { title: "Deleted" };
export const revalidate = 0;

const KIND: Record<string, string> = { items: "Item", item_photos: "Photo", item_videos: "Video", auctions: "Auction", listings: "Marketplace listing", lots: "Lot", lot_members: "Lot item", posts: "Blog post", threads: "Community post", replies: "Community reply", pickup_slots: "Pickup time", invites: "Invite", categories: "Category", locations: "Bin", subscribers: "Email subscriber", offers: "Offer", valuations: "Valuation", ops_tasks: "Ops task", saved_searches: "Saved search" };

export default async function TrashPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ data: rows }, { data: archived }, { data: people }] = await Promise.all([
    db.from("trash").select("id, batch, table_name, title, data, deleted_at, deleted_by, restored_at").order("deleted_at", { ascending: false }).limit(1500),
    db.from("items").select("id, sku, title, price, listed_at, updated_at, owner_id").eq("status", "archived").order("updated_at", { ascending: false }).limit(500),
    db.from("profiles").select("id, full_name, username"),
  ]);
  const name = new Map((people || []).map((p) => [p.id, p.username ? `@${p.username}` : p.full_name || "someone"]));
  // one card per delete action (an item and its photos are one card)
  type Bt = { batch: number; when: string; by: string; main: string; kind: string; owner: string; parts: string[]; restored: boolean };
  const batches = new Map<number, Bt>();
  for (const r of rows || []) {
    const b: Bt = batches.get(r.batch) || { batch: r.batch, when: r.deleted_at, by: r.deleted_by ? name.get(r.deleted_by) || "someone" : "the system", main: "", kind: "", owner: "", parts: [], restored: true };
    const isMain = !b.main || r.table_name === "items" || r.table_name === "threads" || r.table_name === "posts";
    if (isMain && (r.table_name === "items" || !b.kind || b.kind === "Photo" || b.kind === "Video")) {
      b.main = r.title || ""; b.kind = KIND[r.table_name] || r.table_name;
      const d = r.data as { owner_id?: string; author_id?: string; price?: number; sku?: string };
      b.owner = d.owner_id ? name.get(d.owner_id) || "" : d.author_id ? name.get(d.author_id) || "" : "";
      if (d.sku) b.main = `${b.main} (${d.sku}${d.price != null ? `, $${d.price}` : ""})`;
    }
    b.parts.push(KIND[r.table_name] || r.table_name);
    if (!r.restored_at) b.restored = false;
    batches.set(r.batch, b);
  }
  const list = [...batches.values()].map((b) => {
    const counts: Record<string, number> = {};
    for (const p of b.parts) counts[p] = (counts[p] || 0) + 1;
    return { ...b, parts: Object.entries(counts).map(([k, n]) => `${n} ${k.toLowerCase()}${n > 1 ? "s" : ""}`).join(", ") };
  });
  return <TrashClient batches={list} archived={(archived || []).map((a) => ({ ...a, owner: name.get(a.owner_id) || "" }))} />;
}
