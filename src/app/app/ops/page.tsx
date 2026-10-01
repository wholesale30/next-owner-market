import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { registerAutomations } from "@/lib/automations";
import OpsClient from "./OpsClient";

export const metadata = { title: "Operations" };

export default async function OpsPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  await registerAutomations();
  const supabase = await createClient();
  const now = new Date(new Date().toISOString()).getTime();
  const [{ data: stats }, { data: autos }, { data: tasks }, { data: emails }, { data: posts }] = await Promise.all([
    supabase.rpc("ops_stats"),
    supabase.from("automations").select("*").order("sort_order"),
    supabase.from("ops_tasks").select("*").order("sort_order"),
    supabase.from("email_log").select("kind, sent_at, ok").gte("sent_at", new Date(now - 7 * 86400_000).toISOString()).order("sent_at", { ascending: false }).limit(500),
    supabase.from("posts").select("slug, title, published_at").order("published_at", { ascending: false }).limit(5),
  ]);
  const byKind: Record<string, number> = {};
  for (const e of emails || []) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return <OpsClient stats={(stats as Record<string, number>) || {}} automations={autos || []} tasks={tasks || []} emailsByKind={byKind} posts={posts || []} now={now} />;
}
