import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import ImportClient from "./ImportClient";

export const metadata = { title: "Bring in my Facebook ads" };

export default async function ImportPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("fb_old_url").not("fb_old_url", "is", null).limit(5000);
  return <ImportClient userId={me.id} already={(data || []).map((r) => r.fb_old_url as string)} />;
}
