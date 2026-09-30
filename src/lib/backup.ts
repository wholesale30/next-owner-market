import { createClient as createAdmin } from "@supabase/supabase-js";

const TABLES = ["profiles", "categories", "locations", "items", "item_photos", "item_videos", "lots", "lot_members", "listings", "sales", "payouts", "payout_sales", "sourcing_requests", "saved_searches", "favorites", "notifications", "auctions", "bids", "pickup_slots", "pickups", "activity_log", "settings", "subscribers", "conversations", "messages", "orders", "disputes", "dispute_messages", "ratings", "offers", "blasts"];

/** Dump every table to one JSON file in the private "backups" bucket. Photos live in item-photos already. */
export async function runBackup() {
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const dump: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(t).select("*").range(from, from + 999);
      if (error) { dump[`${t}__error`] = [error.message]; break; }
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    dump[t] = rows;
  }
  const name = `nom-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify({ taken_at: new Date().toISOString(), tables: dump });
  const { error } = await admin.storage.from("backups").upload(name, new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw error;
  // prune older than 30 days
  const { data: files } = await admin.storage.from("backups").list("", { limit: 200 });
  const cutoff = Date.now() - 30 * 86400000;
  const old = (files || []).filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff).map((f) => f.name);
  if (old.length) await admin.storage.from("backups").remove(old);
  return { file: name, bytes: body.length, tables: Object.keys(dump).length };
}
