import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { registerAutomations, EMAIL_SAMPLES } from "@/lib/automations";
import OpsClient from "./OpsClient";
import { opsLists } from "@/lib/ops-lists";

export const metadata = { title: "Operations" };

export default async function OpsPage() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  await registerAutomations();
  const supabase = await createClient();
  const now = new Date(new Date().toISOString()).getTime();
  const [lists, { data: stats }, { data: autos }, { data: tasks }, { data: emails }, { data: posts }, { data: ints }] = await Promise.all([
    opsLists().catch(() => ({})),
    supabase.rpc("ops_stats"),
    supabase.from("automations").select("*").order("sort_order"),
    supabase.from("ops_tasks").select("*").order("sort_order"),
    supabase.from("email_log").select("kind, sent_at, ok").gte("sent_at", new Date(now - 7 * 86400_000).toISOString()).order("sent_at", { ascending: false }).limit(500),
    supabase.from("posts").select("slug, title, published_at").order("published_at", { ascending: false }).limit(5),
    supabase.from("integrations").select("*").order("sort_order"),
  ]);
  // Funnel: where new people drop off, from first try to paying Pro.
  const svc = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ data: tries }, { data: sellersRows }, { data: itemOwners }, { data: soldOwners }] = await Promise.all([
    svc.from("settings").select("value").like("key", "try:result:%").limit(5000),
    svc.from("profiles").select("id, plan, comped").in("role", ["consignor"]).limit(5000),
    svc.from("items").select("owner_id, status").neq("status", "archived").limit(10000),
    svc.from("orders").select("seller_id").in("status", ["paid", "released"]).limit(10000),
  ]);
  const sellerIds = new Set((sellersRows || []).map((p) => p.id));
  const withItem = new Set((itemOwners || []).filter((i) => sellerIds.has(i.owner_id)).map((i) => i.owner_id));
  const withLive = new Set((itemOwners || []).filter((i) => sellerIds.has(i.owner_id) && ["active", "reserved", "sold", "shipped"].includes(i.status)).map((i) => i.owner_id));
  const withSale = new Set((soldOwners || []).filter((o) => sellerIds.has(o.seller_id)).map((o) => o.seller_id));
  const funnel = [
    { label: "Tried it free (no account)", n: (tries || []).length, tip: "Picked a photo on /try and got a listing." },
    { label: "Kept it (made an account from a try)", n: (tries || []).filter((t) => (t.value as { claimed_by?: string }).claimed_by).length, tip: "Tapped Keep this listing and signed up." },
    { label: "Seller accounts", n: sellerIds.size, tip: "Everyone who signed up to sell, any way." },
    { label: "Added an item", n: withItem.size, tip: "Sellers with at least one item, draft or live." },
    { label: "Has something live", n: withLive.size, tip: "Sellers with an item buyers can see (or already sold)." },
    { label: "Made a sale here", n: withSale.size, tip: "Sellers with a paid order in our store." },
    { label: "Paying Pro", n: (sellersRows || []).filter((p) => p.plan === "pro" && !p.comped).length, tip: "Paying $15/month." },
  ];
  const byKind: Record<string, number> = {};
  for (const e of emails || []) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return <OpsClient stats={(stats as Record<string, number>) || {}} automations={autos || []} tasks={tasks || []} emailsByKind={byKind} posts={posts || []} now={now} integrations={ints || []} emailSamples={EMAIL_SAMPLES} funnel={funnel} lists={lists as Record<string, { line: string; href?: string }[]>} />;
}
