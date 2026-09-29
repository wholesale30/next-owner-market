import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value");
  const get = (k: string) => data?.find((s) => s.key === k)?.value;
  return (
    <SettingsForm
      business={(get("business") as Record<string, string>) || {}}
      tiers={(get("commission_tiers") as Record<string, number>) || {}}
    />
  );
}
