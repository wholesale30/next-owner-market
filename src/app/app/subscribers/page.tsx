import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";

export const metadata = { title: "Email & text list" };

export default async function SubscribersPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin" && me.role !== "staff") redirect("/app");
  const supabase = await createClient();
  const { data: subs } = await supabase.from("subscribers").select("*").eq("unsubscribed", false).order("created_at", { ascending: false }).limit(1000);
  const emails = (subs || []).filter((s) => s.email).length;
  const phones = (subs || []).filter((s) => s.phone).length;
  const bySource = (subs || []).reduce<Record<string, number>>((a, s) => ((a[s.source] = (a[s.source] || 0) + 1), a), {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Your list</h1><p className="muted text-sm">{emails} emails • {phones} phones</p></div>
        <a href="/api/export?what=subscribers" className="btn btn-secondary">⬇ CSV</a>
      </div>
      <div className="flex gap-1 flex-wrap text-xs">{Object.entries(bySource).map(([k, v]) => <span key={k} className="pill">{k}: {v}</span>)}</div>
      <p className="text-sm muted">Everyone who messages, requests a pickup, asks for something, signs up, or joins from the store lands here automatically. Export the CSV into Mailchimp, Gmail, or a texting service for a &quot;new arrivals&quot; blast. Never sell or share this list.</p>
      <div className="space-y-1">
        {(subs || []).map((s) => (
          <div key={s.id} className="card p-2 text-sm flex justify-between gap-2">
            <span className="truncate">{s.name ? `${s.name} • ` : ""}{s.email || s.phone}</span>
            <span className="muted shrink-0">{s.source} • {new Date(s.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
      <Link href="/app/inbox" className="text-sm muted">← Inbox</Link>
    </div>
  );
}
