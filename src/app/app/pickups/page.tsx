import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import PickupsClient from "./PickupsClient";

export const metadata = { title: "Pickups" };

export default async function PickupsPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const since = new Date(new Date().getTime() - 86400000).toISOString();
  const [{ data: slots }, { data: pickups }] = await Promise.all([
    supabase.from("pickup_slots").select("*").gte("ends_at", since).order("starts_at"),
    supabase.from("pickups").select("*, items(sku, title), pickup_slots(starts_at, ends_at)").order("created_at", { ascending: false }).limit(100),
  ]);
  return <PickupsClient slots={slots || []} pickups={(pickups || []) as never} />;
}
