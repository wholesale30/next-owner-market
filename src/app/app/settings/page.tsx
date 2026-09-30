import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import BackupBox from "./BackupBox";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value");
  const get = (k: string) => data?.find((s) => s.key === k)?.value;
  return (
    <div className="space-y-4">
    <SettingsForm
      business={(get("business") as Record<string, string | boolean>) || {}}
      tiers={(get("commission_tiers") as Record<string, number>) || {}}
    />
    <BackupBox />
    </div>
  );
}
