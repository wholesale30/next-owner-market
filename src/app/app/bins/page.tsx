import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import LocationsClient from "./LocationsClient";

export const metadata = { title: "Bins & pallets" };

export default async function LocationsPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const [{ data: locations }, { data: counts }] = await Promise.all([
    supabase.from("locations").select("*").order("sorted").order("code"),
    supabase.from("items").select("location_id, status").neq("status", "archived"),
  ]);
  const tally = new Map<string, { total: number; active: number; sold: number }>();
  for (const c of counts || []) {
    if (!c.location_id) continue;
    const t = tally.get(c.location_id) || { total: 0, active: 0, sold: 0 };
    t.total++;
    if (c.status === "active") t.active++;
    if (c.status === "sold" || c.status === "shipped") t.sold++;
    tally.set(c.location_id, t);
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Bins &amp; pallets</h1>
        <p className="muted text-sm">Pallet mode: open a box, add a code here, then add items to it. Mark it sorted when you&apos;ve been through it.</p>
      </div>
      <LocationsClient locations={(locations || []).map((l) => ({ ...l, ...(tally.get(l.id) || { total: 0, active: 0, sold: 0 }) }))} />
      <Link href="/app" className="text-sm muted">← Inventory</Link>
    </div>
  );
}
