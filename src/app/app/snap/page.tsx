import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import SnapClient from "./SnapClient";

export const metadata = { title: "Snap mode" };

export default async function SnapPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const { data: bins } = await supabase.from("locations").select("id, code").eq("sorted", false).order("code");
  return <SnapClient userId={me.id} bins={bins || []} />;
}
