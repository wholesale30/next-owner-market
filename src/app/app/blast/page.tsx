import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import BlastClient from "./BlastClient";

export const metadata = { title: "New arrivals email" };

export default async function BlastPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const [{ data: items }, { count }, { data: last }] = await Promise.all([
    supabase.from("items").select("id, sku, title, price, listed_at, item_photos(url, is_primary)").eq("status", "active").order("listed_at", { ascending: false }).limit(60),
    supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("unsubscribed", false).not("email", "is", null),
    supabase.from("blasts").select("subject, recipients, sent, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  return <BlastClient items={(items || []) as never} subscriberCount={count || 0} history={last || []} />;
}
