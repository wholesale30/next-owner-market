import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import NewDeep from "./NewDeep";

export const metadata = { title: "Advanced What's it worth" };
export const dynamic = "force-dynamic";

/** 🔬 Advanced What's it worth (owner, Oct 26, 2026): his own deep lookups, saved, with test steps and a Word white paper. */
export default async function DeepPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/app"); // owner only for now; later a paid add-on
  const supabase = await createClient();
  const { data } = await supabase.from("deep_reports").select("id, title, photo_urls, created_at, report").order("created_at", { ascending: false }).limit(200);
  const rows = (data || []).map((r) => ({ id: r.id as string, title: (r.title as string) || "Untitled", photo: (r.photo_urls as string[])?.[0] || null, at: r.created_at as string, price: (r.report as { expected_price?: number } | null)?.expected_price || null }));
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">🔬 Advanced What&apos;s it worth</h1>
      <p className="text-sm muted">The deep version: real prices from live searches, how to test it step by step, known problems and fixes, manuals, parts, and a ready listing. Every report is saved here and downloads as a Word white paper.</p>
      <NewDeep meId={me.id} />
      <h2 className="text-lg font-bold">Saved reports ({rows.length})</h2>
      {rows.length === 0 && <p className="muted text-sm">None yet. Your first one shows up here.</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}><Link href={`/app/deep/${r.id}`} className="card p-2 flex items-center gap-3">
            {r.photo ? <img src={r.photo} alt="" className="w-14 h-14 object-cover rounded-lg" /> : <span className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl" style={{ background: "var(--line)" }}>🔬</span>}
            <span className="flex-1 min-w-0"><span className="block font-semibold line-clamp-2">{r.title}</span><span className="text-xs muted">{new Date(r.at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}{r.price ? ` · about $${Math.round(r.price).toLocaleString()}` : ""}</span></span>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}
