import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";

export const metadata = { title: "Blog" };

export default async function BlogAdmin() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "staff")) redirect("/app");
  const supabase = await createClient();
  const [{ data: posts }, { data: reports }] = await Promise.all([
    supabase.from("posts").select("id, slug, title, published_at, updated_at").order("updated_at", { ascending: false }),
    supabase.from("reports").select("id, kind, target_id, reason, created_at").is("handled_at", null).order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Blog</h1><Link href="/app/blog/new" className="btn btn-primary">+ New post</Link></div>
      <p className="text-sm muted">Write in plain text; blank line between paragraphs. **bold**, ## headings, and - lists work. Shows at nextownermarket.com/blog.</p>
      {posts?.map((p) => (
        <Link key={p.id} href={`/app/blog/${p.id}`} className="card p-3 flex justify-between items-center gap-2">
          <div className="min-w-0"><p className="font-semibold truncate">{p.title}</p><p className="text-xs muted">{p.published_at ? `Published ${new Date(p.published_at).toLocaleDateString()}` : "Draft"} · /blog/{p.slug}</p></div>
          <span className={`pill ${p.published_at ? "pill-active" : "pill-draft"}`}>{p.published_at ? "Live" : "Draft"}</span>
        </Link>
      ))}
      {!posts?.length && <p className="card p-6 text-center muted">No posts yet. Ideas: &quot;What your old stereo is really worth&quot;, &quot;5 things at every estate sale worth grabbing&quot;, &quot;How we ship a 40-lb receiver without breaking it&quot;.</p>}

      <h2 className="text-xl font-bold pt-4">Community reports {reports?.length ? `(${reports.length})` : ""}</h2>
      {!reports?.length && <p className="text-sm muted">Nothing reported. <Link href="/community" className="underline">Open the community</Link>.</p>}
      {reports?.map((r) => (
        <Link key={r.id} href={r.kind === "thread" ? `/community/${r.target_id}` : r.kind === "item" ? `/app/items/${r.target_id}` : `/community`} className="card p-3 text-sm" style={{ borderColor: "var(--danger)" }}>
          <p className="font-semibold">⚑ {r.kind} reported</p><p className="muted">{r.reason || "(no reason given)"} · {new Date(r.created_at).toLocaleString()}</p>
        </Link>
      ))}
    </div>
  );
}
