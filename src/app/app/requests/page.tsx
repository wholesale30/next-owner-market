import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { money } from "@/lib/listing";
import RequestRow from "./RequestRow";

export const metadata = { title: "Wanted" };

export default async function RequestsPage({ searchParams }: PageProps<"/app/requests">) {
  const profile = (await getProfile())!;
  if (profile.role !== "admin" && profile.role !== "staff") redirect("/app");
  const { show } = (await searchParams) as { show?: string };
  const supabase = await createClient();
  let q = supabase.from("sourcing_requests").select("*").order("created_at", { ascending: false });
  q = show === "all" ? q : q.in("status", ["open", "searching", "matched"]);
  const { data: reqs } = await q;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Wanted</h1>
        <p className="muted text-sm">What buyers are asking for. Carry this list when you&apos;re buying pallets.</p>
      </div>
      <div className="flex gap-1">
        <a href="/app/requests" className={`pill px-3 py-2 ${show !== "all" ? "pill-active" : ""}`}>Open</a>
        <a href="/app/requests?show=all" className={`pill px-3 py-2 ${show === "all" ? "pill-active" : ""}`}>All</a>
      </div>
      {!reqs?.length && <div className="card p-6 text-center muted text-sm">No requests yet. The &quot;Looking for something?&quot; form on the store feeds this list.</div>}
      {reqs?.map((r) => (
        <RequestRow key={r.id} r={{ ...r, budget: money(r.budget_max) }} />
      ))}
    </div>
  );
}
